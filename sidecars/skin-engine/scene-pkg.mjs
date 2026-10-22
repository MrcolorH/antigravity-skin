// ==========================================================
// Wallpaper Engine 场景包（scene.pkg）解包与静态画面提取
//
// 背景：Steam 创意工坊里的场景壁纸目录中，`preview.jpg/gif` 只是**正方形缩略图**
// （实测 176 个场景里，1024² 有 42 个，另有一批只有 160²~300²），
// 真正的画面在 `scene.pkg` 里。直接用缩略图当壁纸，必然出现
// 「只显示一部分 + 被放大到模糊」的观感。
//
// 本模块按 Wallpaper Engine 的真实封装格式解包，取出原生分辨率的画面：
//
//   PKG 容器（PKGV0001~0006）
//     ├─ uint32 magicLen + magic
//     ├─ int32  entryCount
//     ├─ entry × N : [int32 nameLen + name][int32 offset][int32 length]
//     └─ 数据区（各 entry 的 offset 相对 dataStart）
//
//   scene.json -> objects[].image (models/*.json)
//     -> { material: materials/*.json } -> passes[].textures[0]
//     -> materials/<name>.tex
//
//   TEX 纹理（TEXV0005 / TEXI0001）
//     ├─ format, flags, texW, texH, imgW, imgH, unknown
//     ├─ 容器 TEXB0001/0002/0003/0004
//     └─ mipmap × N : [w][h][isLZ4][decompressedLen][int32 dataLen + data]
//
//   mip0 的数据可能是：
//     a) 内嵌 JPEG / PNG —— 直接透传（实测 140/175 属于这类）
//     b) LZ4 压缩的 RGBA8888（decLen = w×h×4）—— 解压后编码成 PNG
//     c) DDS / 其它未支持格式 —— 返回 null 由上层回退缩略图
// ==========================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const MAX_PKG_ENTRIES = 100000;
const MAX_NAME_LEN = 1024;
const PKG_INDEX_CACHE = new Map();

// ---------------- PKG 容器 ----------------

function normalizeEntryName(name) {
  return String(name || '').replace(/\\/g, '/');
}

/** 解析 pkg 目录（只读头部，不载入数据区），按 mtime+size 缓存索引 */
function parsePkgIndex(pkgPath) {
  let st;
  try { st = fs.statSync(pkgPath); } catch (_) { return null; }
  const cacheKey = pkgPath + ':' + st.size + ':' + st.mtimeMs;
  const cached = PKG_INDEX_CACHE.get(cacheKey);
  if (cached) return cached;

  let fd;
  try {
    fd = fs.openSync(pkgPath, 'r');
    const readAt = (n, at) => {
      const b = Buffer.allocUnsafe(n);
      const got = fs.readSync(fd, b, 0, n, at);
      return got === n ? b : b.slice(0, got);
    };
    const i32 = (at) => {
      const b = readAt(4, at);
      return b.length === 4 ? b.readInt32LE(0) : NaN;
    };

    const magicLen = i32(0);
    if (!Number.isFinite(magicLen) || magicLen < 4 || magicLen > 32) return null;
    const magic = readAt(magicLen, 4).toString('latin1');
    if (!magic.startsWith('PKGV')) return null;

    let pos = 4 + magicLen;
    const entryCount = i32(pos);
    pos += 4;
    if (!Number.isFinite(entryCount) || entryCount < 0 || entryCount > MAX_PKG_ENTRIES) return null;

    const entries = new Map();
    for (let i = 0; i < entryCount; i++) {
      const nameLen = i32(pos);
      pos += 4;
      if (!Number.isFinite(nameLen) || nameLen < 0 || nameLen > MAX_NAME_LEN) return null;
      const name = readAt(nameLen, pos).toString('utf8');
      pos += nameLen;
      const offset = i32(pos);
      pos += 4;
      const length = i32(pos);
      pos += 4;
      if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length < 0) return null;
      entries.set(normalizeEntryName(name), { offset, length });
    }

    const idx = {
      pkgPath,
      magic,
      dataStart: pos,
      entries,
      mtimeMs: st.mtimeMs,
      size: st.size
    };
    if (PKG_INDEX_CACHE.size > 64) PKG_INDEX_CACHE.clear();
    PKG_INDEX_CACHE.set(cacheKey, idx);
    return idx;
  } catch (_) {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

function readPkgEntry(idx, name) {
  if (!idx) return null;
  const e = idx.entries.get(normalizeEntryName(name));
  if (!e) return null;
  let fd;
  try {
    fd = fs.openSync(idx.pkgPath, 'r');
    const buf = Buffer.allocUnsafe(e.length);
    const got = fs.readSync(fd, buf, 0, e.length, idx.dataStart + e.offset);
    return got === e.length ? buf : buf.slice(0, got);
  } catch (_) {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

// ---------------- 图像格式嗅探 ----------------

function sniffImageMime(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  return null;
}

// ---------------- LZ4 块解压 ----------------
// Wallpaper Engine 用的是 LZ4 block 格式（无帧头），标准解码循环：
//   token = 高 4 位字面量长度 / 低 4 位匹配长度，长度 15 时后续字节累加

function lz4DecompressBlock(src, expectedSize) {
  const dst = Buffer.allocUnsafe(expectedSize);
  const srcEnd = src.length;
  let ip = 0;
  let op = 0;

  while (ip < srcEnd) {
    const token = src[ip++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      let b;
      do {
        if (ip >= srcEnd) break;
        b = src[ip++];
        litLen += b;
      } while (b === 255);
    }
    if (litLen > 0) {
      if (ip + litLen > srcEnd || op + litLen > expectedSize) break;
      src.copy(dst, op, ip, ip + litLen);
      ip += litLen;
      op += litLen;
    }
    if (ip >= srcEnd) break;

    if (ip + 2 > srcEnd) break;
    const offset = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (offset === 0 || offset > op) break;

    let matchLen = token & 0x0f;
    if (matchLen === 15) {
      let b;
      do {
        if (ip >= srcEnd) break;
        b = src[ip++];
        matchLen += b;
      } while (b === 255);
    }
    matchLen += 4;
    if (op + matchLen > expectedSize) matchLen = expectedSize - op;

    // 重叠复制必须逐字节（LZ4 允许 match 区与输出区重叠）
    let from = op - offset;
    for (let i = 0; i < matchLen; i++) dst[op++] = dst[from++];
  }
  return op === expectedSize ? dst : dst.slice(0, op);
}

// ---------------- PNG 编码（无外部依赖） ----------------

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}

function crc32(buf) {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.allocUnsafe(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * 把 RGBA 像素编码成 PNG
 * 使用 filter 2（Up，行内减去上一行）：照片类内容比 filter 0 小 25% 左右，
 * 而耗时几乎相同（实测 3840×2130：11.1MB → 8.1MB，311ms → 317ms）。
 * @param {Buffer} rgba 像素数据（RGBA8888）
 * @param {number} width
 * @param {number} height
 * @param {{ swapRB?: boolean, level?: number }} [options]
 */
function encodePngFromRgba(rgba, width, height, options = {}) {
  const swapRB = options.swapRB === true;
  const level = options.level === undefined ? 4 : options.level;
  const stride = width * 4;
  const outStride = stride + 1;
  const raw = Buffer.allocUnsafe(outStride * height);
  const prevRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const outBase = y * outStride;
    raw[outBase] = 2; // filter: Up
    const srcBase = y * stride;
    const row = raw.subarray(outBase + 1, outBase + 1 + stride);
    if (!swapRB) {
      for (let i = 0; i < stride; i++) {
        row[i] = (rgba[srcBase + i] - prevRow[i]) & 0xff;
      }
      rgba.copy(prevRow, 0, srcBase, srcBase + stride);
    } else {
      for (let x = 0; x < width; x++) {
        const s = srcBase + x * 4;
        const d = x * 4;
        row[d] = (rgba[s + 2] - prevRow[d]) & 0xff;
        row[d + 1] = (rgba[s + 1] - prevRow[d + 1]) & 0xff;
        row[d + 2] = (rgba[s] - prevRow[d + 2]) & 0xff;
        row[d + 3] = (rgba[s + 3] - prevRow[d + 3]) & 0xff;
      }
      rgba.copy(prevRow, 0, srcBase, srcBase + stride);
    }
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const idat = zlib.deflateSync(raw, { level });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------- TEX 纹理 ----------------

function readNullString(buf, start, maxLen = 32) {
  const limit = Math.min(buf.length, start + maxLen);
  for (let i = start; i < limit; i++) {
    if (buf[i] === 0) return { value: buf.slice(start, i).toString('latin1'), next: i + 1 };
  }
  return null;
}

/**
 * 解析 .tex 并取出 mip0
 * @returns {{ container:string, texWidth:number, texHeight:number, imageWidth:number, imageHeight:number,
 *             bytes:Buffer, mime:string|null, lz4:boolean, decompressedSize:number } | null}
 */
export function parseTex(buf) {
  if (!buf || buf.length < 32) return null;
  const m1 = readNullString(buf, 0, 16);
  if (!m1 || m1.value !== 'TEXV0005') return null;
  const m2 = readNullString(buf, m1.next, 16);
  if (!m2 || m2.value !== 'TEXI0001') return null;

  let p = m2.next;
  const need = (n) => (p + n <= buf.length);
  if (!need(7 * 4)) return null;
  p += 4;                                   // format
  p += 4;                                   // flags
  const texWidth = buf.readInt32LE(p); p += 4;
  const texHeight = buf.readInt32LE(p); p += 4;
  const imageWidth = buf.readInt32LE(p); p += 4;
  const imageHeight = buf.readInt32LE(p); p += 4;
  p += 4;                                   // unknown

  const c = readNullString(buf, p, 16);
  if (!c) return null;
  const container = c.value;
  p = c.next;
  if (!['TEXB0001', 'TEXB0002', 'TEXB0003', 'TEXB0004'].includes(container)) return null;

  let imageFormat = null;
  if (container === 'TEXB0003') { if (!need(4)) return null; imageFormat = buf.readInt32LE(p); p += 4; }
  else if (container === 'TEXB0004') { if (!need(8)) return null; imageFormat = buf.readInt32LE(p); p += 8; }

  if (!need(8)) return null;
  const imageCount = buf.readInt32LE(p); p += 4;
  const mipCount = buf.readInt32LE(p); p += 4;
  if (imageCount < 1 || mipCount < 1 || mipCount > 64) return null;

  // 只取 mip0（最大的一级）
  if (!need(16)) return null;
  const mipW = buf.readInt32LE(p); p += 4;
  const mipH = buf.readInt32LE(p); p += 4;
  let lz4 = false;
  let decompressedSize = 0;
  if (container !== 'TEXB0001') {
    lz4 = buf.readInt32LE(p) === 1; p += 4;
    decompressedSize = buf.readInt32LE(p); p += 4;
  }
  if (!need(4)) return null;
  const dataLen = buf.readInt32LE(p); p += 4;
  if (dataLen < 0 || p + dataLen > buf.length) return null;
  const bytes = buf.slice(p, p + dataLen);

  return {
    container,
    imageFormat,
    texWidth,
    texHeight,
    imageWidth: imageWidth > 0 ? imageWidth : mipW,
    imageHeight: imageHeight > 0 ? imageHeight : mipH,
    mipWidth: mipW,
    mipHeight: mipH,
    bytes,
    mime: sniffImageMime(bytes),
    lz4,
    decompressedSize
  };
}

/** mip0 是内嵌 JPEG/PNG 时直接返回；是 LZ4 压缩的 RGBA 时解压并编码 PNG */
function texToImage(tex, options = {}) {
  if (!tex) return null;
  if (tex.mime === 'image/jpeg' || tex.mime === 'image/png') {
    return { buffer: tex.bytes, mime: tex.mime, width: tex.imageWidth, height: tex.imageHeight, mode: 'passthrough' };
  }
  const w = tex.mipWidth > 0 ? tex.mipWidth : tex.texWidth;
  const h = tex.mipHeight > 0 ? tex.mipHeight : tex.texHeight;
  if (!w || !h) return null;
  const expected = w * h * 4;

  let raw = tex.bytes;
  if (tex.lz4) {
    const size = tex.decompressedSize > 0 ? tex.decompressedSize : expected;
    if (size < 16 || size > 512 * 1024 * 1024) return null;
    raw = lz4DecompressBlock(tex.bytes, size);
  }
  if (!raw || raw.length < expected) return null;

  // 纹理可能被填充到 2 的幂，实际画面是 imageWidth × imageHeight，需要裁切
  const outW = tex.imageWidth > 0 && tex.imageWidth <= w ? tex.imageWidth : w;
  const outH = tex.imageHeight > 0 && tex.imageHeight <= h ? tex.imageHeight : h;
  let pixels = raw;
  if (outW !== w || outH !== h) {
    const cropped = Buffer.allocUnsafe(outW * outH * 4);
    for (let y = 0; y < outH; y++) {
      raw.copy(cropped, y * outW * 4, y * w * 4, y * w * 4 + outW * 4);
    }
    pixels = cropped;
  }

  const png = encodePngFromRgba(pixels, outW, outH, {
    swapRB: options.swapRB === true,
    level: options.level
  });
  return { buffer: png, mime: 'image/png', width: outW, height: outH, mode: 'rgba->png' };
}

// ---------------- 从 scene.json 找主画面层 ----------------

function parseVec3(str) {
  const parts = String(str || '').trim().split(/\s+/).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function layerArea(obj) {
  const size = parseVec3(obj.size);
  const scale = parseVec3(obj.scale || '1 1 1');
  // 未写 size 的图层（例如部分 sprite）按 0 处理，会被排到后面
  return Math.abs(size[0] * scale[0]) * Math.abs(size[1] * scale[1]);
}

/** 把 image 字段解析到 pkg 内的纹理名（可能经过 models -> materials 两级间接） */
function resolveTextureName(idx, imagePath) {
  let cur = normalizeEntryName(imagePath);
  for (let hop = 0; hop < 4 && cur; hop++) {
    const raw = readPkgEntry(idx, cur);
    if (!raw) return null;
    const directMime = sniffImageMime(raw);
    if (directMime) return { name: cur, direct: true, mime: directMime, bytes: raw };

    let json;
    try { json = JSON.parse(raw.toString('utf8')); } catch (_) { return null; }

    if (Array.isArray(json.passes)) {
      const dir = path.posix.dirname(cur);
      for (const pass of json.passes) {
        const texRef = Array.isArray(pass.textures) ? pass.textures[0] : null;
        if (!texRef) continue;
        const candidates = [
          'materials/' + texRef + '.tex',
          dir + '/' + texRef + '.tex',
          texRef + '.tex'
        ];
        for (const cand of candidates) {
          if (idx.entries.has(normalizeEntryName(cand))) {
            return { name: cand, direct: false, mime: null, bytes: null };
          }
        }
      }
      return null;
    }
    if (json.material) { cur = normalizeEntryName(json.material); continue; }
    return null;
  }
  return null;
}

// ---------------- 对外主入口 ----------------

/**
 * 提取场景壁纸的静态主画面（原生分辨率）
 * @param {string} pkgPath scene.pkg 绝对路径
 * @param {{ swapRB?: boolean, level?: number }} [options]
 * @returns {{ buffer:Buffer, mime:string, width:number, height:number, layer:string, mode:string, layers:number } | null}
 */
export function extractScenePoster(pkgPath, options = {}) {
  const idx = parsePkgIndex(pkgPath);
  if (!idx) return null;

  const sceneRaw = readPkgEntry(idx, 'scene.json');
  if (!sceneRaw) return null;
  let scene;
  try { scene = JSON.parse(sceneRaw.toString('utf8')); } catch (_) { return null; }

  const imageLayers = (Array.isArray(scene.objects) ? scene.objects : [])
    .filter(o => o && o.image && o.visible !== false);
  if (!imageLayers.length) return null;

  // 取覆盖面积最大的一层作为「主画面」
  const ranked = imageLayers
    .map(o => ({ obj: o, area: layerArea(o) }))
    .sort((a, b) => b.area - a.area);

  for (const { obj } of ranked) {
    const resolved = resolveTextureName(idx, obj.image);
    if (!resolved) continue;

    let image = null;
    if (resolved.direct) {
      image = {
        buffer: resolved.bytes,
        mime: resolved.mime,
        width: 0,
        height: 0,
        mode: 'direct-entry'
      };
    } else {
      const texBuf = readPkgEntry(idx, resolved.name);
      const tex = parseTex(texBuf);
      image = texToImage(tex, options);
    }
    if (!image || !image.buffer || !image.buffer.length) continue;

    return {
      ...image,
      layer: String(obj.name || ''),
      layers: imageLayers.length,
      source: resolved.name
    };
  }
  return null;
}

// ---------------- 磁盘缓存 ----------------

const DEFAULT_CACHE_DIR = path.join(os.tmpdir(), 'agy-scene-poster');
const CACHE_MAX_BYTES = 768 * 1024 * 1024;
const CACHE_MAX_FILES = 80;

/** 缓存回收：按 mtime 从旧到新删，控制在体积与数量上限内（避免 4K 原件把磁盘吃满） */
function prunePosterCache(cacheDir) {
  let names;
  try { names = fs.readdirSync(cacheDir); } catch (_) { return; }
  const imgs = [];
  for (const n of names) {
    if (!n.endsWith('.img')) continue;
    try {
      const p = path.join(cacheDir, n);
      const st = fs.statSync(p);
      imgs.push({ p, size: st.size, mtime: st.mtimeMs, meta: path.join(cacheDir, n.replace(/\.img$/, '.json')) });
    } catch (_) {}
  }
  imgs.sort((a, b) => b.mtime - a.mtime); // 新 → 旧
  let total = 0;
  for (let i = 0; i < imgs.length; i++) {
    total += imgs[i].size;
    if (i >= CACHE_MAX_FILES || total > CACHE_MAX_BYTES) {
      for (let j = i; j < imgs.length; j++) {
        try { fs.unlinkSync(imgs[j].p); } catch (_) {}
        try { fs.unlinkSync(imgs[j].meta); } catch (_) {}
      }
      break;
    }
  }
}

/**
 * 带磁盘缓存的取图：同一壁纸只在首次请求时解包，之后直接读缓存
 * @param {string} pkgPath
 * @param {{ cacheDir?: string, refresh?: boolean, swapRB?: boolean, level?: number }} [options]
 */
export function getScenePoster(pkgPath, options = {}) {
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  let st;
  try { st = fs.statSync(pkgPath); } catch (_) { return null; }

  const key = crypto
    .createHash('sha1')
    .update(pkgPath + ':' + st.size + ':' + st.mtimeMs + ':' + (options.swapRB ? 'bgr' : 'rgb'))
    .digest('hex')
    .slice(0, 20);

  const metaFile = path.join(cacheDir, key + '.json');
  const imgFile = path.join(cacheDir, key + '.img');

  if (!options.refresh) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      const buffer = fs.readFileSync(imgFile);
      if (buffer.length === meta.bytes) {
        return { ...meta, buffer, cached: true };
      }
    } catch (_) {}
  }

  const poster = extractScenePoster(pkgPath, options);
  if (!poster) return null;

  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(imgFile, poster.buffer);
    const meta = {
      mime: poster.mime,
      width: poster.width,
      height: poster.height,
      layer: poster.layer,
      layers: poster.layers,
      source: poster.source,
      mode: poster.mode,
      bytes: poster.buffer.length
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    prunePosterCache(cacheDir);
    return { ...poster, cached: false };
  } catch (_) {
    return { ...poster, cached: false };
  }
}

export { DEFAULT_CACHE_DIR };
