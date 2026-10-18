const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function fail(message, status = 400) { return Object.assign(new Error(message), { status }); }

async function validateApk(file) {
  // Inspect ZIP32 metadata only. Never extract or decompress an uploaded APK.
  // Android APK signing blocks can sit before the central directory.
  const handle = await fsp.open(file, 'r');
  const invalid = () => fail('File APK không hợp lệ hoặc bị lỗi cấu trúc ZIP');
  try {
    const { size } = await handle.stat();
    const read = async (offset, length) => {
      if (offset < 0 || length < 0 || offset + length > size) throw invalid();
      const buffer = Buffer.alloc(length);
      let received = 0;
      while (received < length) {
        const result = await handle.read(buffer, received, length - received, offset + received);
        if (!result.bytesRead) throw invalid();
        received += result.bytesRead;
      }
      return buffer;
    };
    if (size < 22) throw invalid();
    const tail = await read(Math.max(0, size - 65557), Math.min(size, 65557));
    let end = -1;
    for (let offset = tail.length - 22; offset >= 0; offset--) {
      if (tail.readUInt32LE(offset) === 0x06054b50 && offset + 22 + tail.readUInt16LE(offset + 20) === tail.length) {
        end = offset; break;
      }
    }
    if (end < 0) throw invalid();
    const count = tail.readUInt16LE(end + 10);
    const directorySize = tail.readUInt32LE(end + 12);
    const directoryOffset = tail.readUInt32LE(end + 16);
    const endOffset = size - tail.length + end;
    if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      throw fail('Không hỗ trợ APK sử dụng ZIP64. Vui lòng tải APK ZIP32 tiêu chuẩn.');
    }
    if (!count || tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0 ||
        tail.readUInt16LE(end + 8) !== count || directorySize > 16 * 1024 * 1024 ||
        directoryOffset + directorySize !== endOffset) throw invalid();
    const directory = await read(directoryOffset, directorySize);
    let cursor = 0, manifest = false;
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) throw invalid();
      const flags = directory.readUInt16LE(cursor + 8);
      const method = directory.readUInt16LE(cursor + 10);
      const compressed = directory.readUInt32LE(cursor + 20);
      const uncompressed = directory.readUInt32LE(cursor + 24);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const disk = directory.readUInt16LE(cursor + 34);
      const localOffset = directory.readUInt32LE(cursor + 42);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      if (!nameLength || next > directory.length || disk !== 0 || (flags & 1) || ![0, 8].includes(method) ||
          compressed === 0xffffffff || uncompressed === 0xffffffff ||
          localOffset + 30 + compressed > directoryOffset || (method === 0 && compressed !== uncompressed)) throw invalid();
      const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      if (name.includes('\0') || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..')) throw invalid();
      if (name === 'AndroidManifest.xml') {
        if (manifest || !uncompressed || !compressed) throw invalid();
        const local = await read(localOffset, 30);
        const localNameLength = local.readUInt16LE(26);
        const localExtraLength = local.readUInt16LE(28);
        if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method ||
            localNameLength !== nameLength || localOffset + 30 + localNameLength + localExtraLength + compressed > directoryOffset) throw invalid();
        const localName = await read(localOffset + 30, localNameLength);
        if (localName.toString('utf8') !== name) throw invalid();
        manifest = true;
      }
      cursor = next;
    }
    if (cursor !== directory.length) throw invalid();
    if (!manifest) throw fail('APK thiếu AndroidManifest.xml');
  } finally { await handle.close(); }
}

class ApkRepository {
  constructor(directory, maxSize = 150 * 1024 * 1024) {
    this.directory = path.resolve(directory);
    this.maxSize = maxSize;
    this.queue = Promise.resolve();
  }
  async read() {
    try { return JSON.parse(await fsp.readFile(path.join(this.directory, 'releases.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { defaultId: null, releases: [] }; throw error; }
  }
  async save(data) {
    await fsp.mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, `${randomUUID()}.json.tmp`);
    try {
      await fsp.writeFile(temporary, JSON.stringify(data, null, 2));
      await fsp.rename(temporary, path.join(this.directory, 'releases.json'));
    } finally { await fsp.rm(temporary, { force: true }); }
  }
  mutate(callback) {
    const operation = this.queue.then(async () => {
      const data = await this.read();
      const result = await callback(data);
      await this.save(data);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  filePath(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw fail('Không tìm thấy phiên bản APK', 404);
    return path.join(this.directory, `${id}.apk`);
  }
  async list() {
    const data = await this.read();
    return data.releases.map(item => ({ ...item, isDefault: data.defaultId === item.id,
      downloadUrl: `/download?version=${encodeURIComponent(item.version)}` }));
  }
  async upload(stream, { version, filename, enabled, isDefault, uploadedBy, contentLength }) {
    if (typeof version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,49}$/.test(version)) throw fail('Phiên bản chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới hoặc dấu cộng (tối đa 50 ký tự)');
    if (!filename || !/\.apk$/i.test(filename)) throw fail('Vui lòng chọn file .apk');
    if (typeof enabled !== 'boolean' || typeof isDefault !== 'boolean' || (isDefault && !enabled)) throw fail('Phiên bản mặc định phải được cho phép tải');
    if (Number(contentLength) > this.maxSize) throw fail('File APK vượt giới hạn 150 MB', 413);
    await fsp.mkdir(this.directory, { recursive: true });
    const id = randomUUID(), target = this.filePath(id), temporary = `${target}.upload`;
    let size = 0, committed = false;
    const hash = createHash('sha256');
    try {
      await pipeline(stream, new Transform({ transform: (chunk, encoding, done) => {
        size += chunk.length;
        if (size > this.maxSize) return done(fail('File APK vượt giới hạn 150 MB', 413));
        hash.update(chunk); done(null, chunk);
      } }), fs.createWriteStream(temporary, { flags: 'wx' }));
      await validateApk(temporary);
      const release = { id, version, filename: `Onesoft-POS-${version}.apk`, size, sha256: hash.digest('hex'),
        enabled, uploadedBy, createdAt: new Date().toISOString() };
      await this.mutate(async data => {
        if (data.releases.some(item => item.version === version)) throw fail('Phiên bản này đã tồn tại', 409);
        await fsp.rename(temporary, target);
        data.releases.unshift(release);
        if (isDefault) data.defaultId = id;
      });
      committed = true;
      return release;
    } finally {
      await fsp.rm(temporary, { force: true });
      if (!committed) await fsp.rm(target, { force: true });
    }
  }
  async update(id, patch) {
    if (!patch || Object.keys(patch).length === 0 || Object.keys(patch).some(key => !['enabled', 'isDefault'].includes(key) || typeof patch[key] !== 'boolean')) throw fail('Cấu hình APK không hợp lệ');
    return this.mutate(data => {
      const item = data.releases.find(entry => entry.id === id);
      if (!item) throw fail('Không tìm thấy phiên bản APK', 404);
      if (patch.isDefault === true && (patch.enabled ?? item.enabled) !== true) throw fail('Hãy cho phép tải phiên bản trước khi đặt mặc định');
      if (patch.enabled !== undefined) item.enabled = patch.enabled;
      if (patch.isDefault === true) data.defaultId = id;
      if ((patch.isDefault === false || !item.enabled) && data.defaultId === id) data.defaultId = null;
      return item;
    });
  }
  async remove(id) {
    await this.mutate(data => {
      if (!data.releases.some(item => item.id === id)) throw fail('Không tìm thấy phiên bản APK', 404);
      data.releases = data.releases.filter(item => item.id !== id);
      if (data.defaultId === id) data.defaultId = null;
    });
    await fsp.rm(this.filePath(id), { force: true });
  }
  async download(version) {
    const data = await this.read();
    const item = data.releases.find(entry => version === undefined ? entry.id === data.defaultId : entry.version === version);
    if (!item?.enabled) throw fail('Phiên bản APK này chưa được cho phép tải hoặc chưa có bản mặc định', 404);
    const file = this.filePath(item.id);
    try { await fsp.access(file); } catch { throw fail('File APK hiện không khả dụng', 404); }
    return { ...item, file };
  }
}
module.exports = { ApkRepository };
