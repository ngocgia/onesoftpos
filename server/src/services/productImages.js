const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const imageDirectory = path.resolve(process.env.PRODUCT_IMAGE_STORAGE_DIR || path.join(__dirname, '../../data/product-images'));
const MAX_IMAGE_BYTES = 1024 * 1024;

function decodeImage(dataUrl) {
  const invalid = message => Object.assign(new Error(message), { status: 400 });
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 40) {
    throw invalid('Ảnh phải có dung lượng tối đa 1 MB sau khi tối ưu');
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw invalid('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) {
    throw invalid('Dữ liệu ảnh không hợp lệ hoặc vượt quá 1 MB');
  }
  const valid = match[1] === 'jpeg'
    ? bytes.length > 4 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
    : match[1] === 'png'
      ? bytes.length > 32 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR'
      : bytes.length > 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw invalid('Nội dung file không đúng định dạng ảnh');
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1] };
}

function createImageStorage({ env = process.env, directory = imageDirectory, createR2Uploader = (...args) => require('./r2ProductImages').createR2Uploader(...args) } = {}) {
  let upload;
  return async function saveImage(storeId, dataUrl) {
    if (!Number.isSafeInteger(storeId) || storeId <= 0) throw Object.assign(new Error('Cửa hàng không hợp lệ'), { status: 400 });
    const { bytes, extension } = decodeImage(dataUrl);
    const filename = `${randomUUID()}.${extension}`;
    const storage = env.PRODUCT_IMAGE_STORAGE || 'local';
    if (storage === 'r2') {
      upload ||= createR2Uploader(env);
      return upload(`products/${storeId}/${filename}`, bytes, `image/${extension === 'jpg' ? 'jpeg' : extension}`);
    }
    if (storage !== 'local') throw new Error('PRODUCT_IMAGE_STORAGE phải là local hoặc r2');
    const folder = path.join(directory, String(storeId));
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, filename), bytes, { flag: 'wx' });
    return `/uploads/products/${storeId}/${filename}`;
  };
}

const defaultSaveImage = createImageStorage();
async function saveImage(storeId, dataUrl, directory) {
  return directory === undefined
    ? defaultSaveImage(storeId, dataUrl)
    : createImageStorage({ env: { PRODUCT_IMAGE_STORAGE: 'local' }, directory })(storeId, dataUrl);
}

module.exports = { imageDirectory, MAX_IMAGE_BYTES, decodeImage, saveImage, createImageStorage };
