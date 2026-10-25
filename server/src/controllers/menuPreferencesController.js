const db = require('../config/db');
const bcrypt = require('bcryptjs');
const MAX_PAYMENT_QR_IMAGE_LENGTH = 2 * 1024 * 1024;

const fields = {
  printer: { paperSize: ['K58', 'K80', 'K85', 'A4'], connectionType: ['browser', 'usb', 'lan', 'bluetooth', 'network', 'rawbt'], ipAddress: 'string', autoPrintOnPayment: 'boolean', autoPrintOrderSlipOnTransfer: 'boolean', autoCutPaper: 'boolean', printKitchenSeparate: 'boolean' },
  workflow: { enableDineIn: 'boolean', enableTakeaway: 'boolean', enableDelivery: 'boolean', enableKds: 'boolean' },
  shipping: { ahamove: 'boolean', grab: 'boolean', be: 'boolean', ghtk: 'boolean', own: 'boolean', fee: 'nonnegative' },
  number: { currencySymbol: 'string', symbolPosition: ['before', 'after'], thousandSeparator: ['.', ','], rounding: ['none', '100', '1000'] },
  einvoice: { provider: ['vnpt', 'viettel', 'misa', 'bkav'], taxCode: 'string', template: 'string', series: 'string', autoIssue: 'boolean' },
  website: { allowOrdering: 'boolean' },
  loyalty: { enabled: 'boolean', earnAmount: 'positive', redeemAmount: 'nonnegative', combineVoucher: 'boolean' },
  speaker: { enableNewOrderSound: 'boolean', enableKitchenDoneSound: 'boolean', enableVietQRSpeech: 'boolean', volume: 'volume' },
  header: { wishesText: 'string', avatarType: 'string', avatarSrc: 'image', bgTheme: 'string', showDecor: 'boolean' },
  current_store: { store_id: 'positive' },
  deletion_request: { status: ['PENDING'], reason: 'string' }
};

function validate(section, data) {
  if (section === 'printer' && data && Object.hasOwn(data, 'paymentQr')) {
    const { paymentQr, ...rest } = data;
    if (!paymentQr || typeof paymentQr !== 'object' || Array.isArray(paymentQr)
        || Object.keys(paymentQr).sort().join(',') !== 'image,source'
        || !['vietqr', 'upload'].includes(paymentQr.source)
        || typeof paymentQr.image !== 'string' || paymentQr.image.length > MAX_PAYMENT_QR_IMAGE_LENGTH) throw new Error('Cấu hình ảnh QR không hợp lệ');
    if (paymentQr.image) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(paymentQr.image);
      if (!match || match[2].length % 4 !== 0) throw new Error('Ảnh QR phải là PNG, JPG hoặc WebP');
      const bytes = Buffer.from(match[2], 'base64');
      const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid) throw new Error('Dữ liệu ảnh QR không hợp lệ');
    }
    if (paymentQr.source === 'upload' && !paymentQr.image && rest.invoiceOptions?.qr !== false) throw new Error('Vui lòng tải ảnh QR thanh toán lên');
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_PAYMENT_QR_IMAGE_LENGTH + 60000) throw new Error('Cấu hình hoặc ảnh quá lớn');
    return { ...validate('printer', rest), paymentQr };
  }
  if (section === 'printer' && data && Object.hasOwn(data, 'invoiceOptions')) {
    const { invoiceOptions: savedOptions, ...rest } = data;
    if (!savedOptions || typeof savedOptions !== 'object' || Array.isArray(savedOptions)) throw new Error('Tùy chọn in hóa đơn không hợp lệ');
    // Existing clients have six options; preserve the two newly configurable fields.
    const invoiceOptions = { printCount: true, orderCode: true, ...savedOptions };
    const keys = ['qr', 'notes', 'tax', 'checkIn', 'checkOut', 'staff', 'printCount', 'orderCode'];
    if (Object.keys(invoiceOptions).length !== keys.length
        || keys.some(key => typeof invoiceOptions[key] !== 'boolean')) throw new Error('Tùy chọn in hóa đơn không hợp lệ');
    return { ...validate('printer', rest), invoiceOptions };
  }
  if (section === 'printer' && data && Object.hasOwn(data, 'profiles')) {
    const { profiles, ...legacy } = data;
    validate('printer', legacy);
    if (!profiles || Array.isArray(profiles) || typeof profiles !== 'object'
        || Object.keys(profiles).sort().join(',') !== 'barcode,invoice,kitchen,label') throw new Error('Cần đủ 4 nhóm máy in');
    for (const profile of Object.values(profiles)) {
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)
          || Object.keys(profile).sort().join(',') !== 'autoCutPaper,configured,connectionType,enabled,ipAddress,name,paperSize'
          || typeof profile.configured !== 'boolean' || typeof profile.enabled !== 'boolean'
          || (profile.enabled && !profile.configured)
          || typeof profile.name !== 'string' || profile.name.length > 100) throw new Error('Cấu hình nhóm máy in không hợp lệ');
      validate('printer', { ...legacy, paperSize: profile.paperSize, connectionType: profile.connectionType,
        ipAddress: profile.ipAddress, autoCutPaper: profile.autoCutPaper });
    }
    return { ...validate('printer', legacy), profiles };
  }
  // Older clients do not send the new, opt-in order slip setting.
  if (section === 'printer' && data && typeof data === 'object' && !Array.isArray(data) && !Object.hasOwn(data, 'autoPrintOrderSlipOnTransfer')) {
    data = { ...data, autoPrintOrderSlipOnTransfer: false };
  }
  const spec = fields[section];
  if (!spec || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Cấu hình không hợp lệ');
  if (Object.keys(data).length !== Object.keys(spec).length) throw new Error('Thiếu hoặc thừa trường cấu hình');
  for (const [key, rule] of Object.entries(spec)) {
    const value = data[key];
    const valid = Array.isArray(rule) ? rule.includes(value)
      : rule === 'boolean' ? typeof value === 'boolean'
      : rule === 'string' ? typeof value === 'string' && value.length <= 2000
      : rule === 'image' ? typeof value === 'string' && value.length <= 50000 && (!value || /^(data:image\/(png|jpeg|webp|gif);base64,|https?:\/\/|images\/)/.test(value))
      : typeof value === 'number' && Number.isFinite(value) && (rule === 'positive' ? value > 0 : value >= 0) && (rule !== 'volume' || value <= 100);
    if (!valid) throw new Error(`Giá trị ${key} không hợp lệ`);
  }
  if (section === 'workflow' && !data.enableDineIn && !data.enableTakeaway) throw new Error('Phải bật ít nhất một kênh bán');
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 60000) throw new Error('Cấu hình hoặc ảnh quá lớn');
  return data;
}

function context(req, res) {
  if (!db.isPostgresConnected()) {
    res.status(503).json({ success: false, message: 'Database chưa kết nối; cấu hình chưa được lưu' });
    return null;
  }
  const userScope = req.path.startsWith('/auth/');
  const section = req.params.section;
  if (!fields[section] || (userScope !== ['header', 'deletion_request', 'current_store'].includes(section))) {
    res.status(400).json({ success: false, message: 'Nhóm cấu hình không hợp lệ' });
    return null;
  }
  return [userScope ? 'user' : 'store', userScope ? req.user.id : req.storeId, section];
}

async function get(req, res) {
  const args = context(req, res); if (!args) return;
  try {
    const result = await db.pool.query('SELECT payload FROM menu_preferences WHERE owner_type=$1 AND owner_id=$2 AND section=$3', args);
    res.json({ success: true, settings: result.rows[0] ? JSON.parse(result.rows[0].payload) : null });
  } catch (error) { res.status(500).json({ success: false, message: 'Không thể đọc cấu hình từ database' }); }
}

async function getStoreSettings(req, res) {
  if (!db.isPostgresConnected()) return res.status(503).json({ success: false, message: 'Database chưa kết nối' });
  try {
    const result = await db.pool.query("SELECT section,payload FROM menu_preferences WHERE owner_type='store' AND owner_id=$1", [req.storeId]);
    res.json({ success: true, settings: Object.fromEntries(result.rows.filter(row => fields[row.section]).map(row => [row.section, JSON.parse(row.payload)])) });
  } catch (error) { res.status(500).json({ success: false, message: 'Không thể tải cấu hình cửa hàng' }); }
}

async function put(req, res) {
  const args = context(req, res); if (!args) return;
  let data;
  try { data = validate(args[2], req.body); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    if (args[2] === 'current_store') {
      if (!Number.isInteger(data.store_id)) return res.status(400).json({ success: false, message: 'Mã cửa hàng không hợp lệ' });
      const access = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)
        ? await db.pool.query("SELECT id FROM stores WHERE id=$1 AND status='ACTIVE'", [data.store_id])
        : await db.pool.query("SELECT s.id FROM stores s JOIN user_stores us ON us.store_id=s.id WHERE s.id=$1 AND us.user_id=$2 AND s.status='ACTIVE'", [data.store_id, req.user.id]);
      if (!access.rows.length) return res.status(403).json({ success: false, message: 'Không được truy cập cửa hàng này' });
    }
    await db.pool.query(`INSERT INTO menu_preferences (owner_type,owner_id,section,payload) VALUES ($1,$2,$3,$4)
      ON CONFLICT (owner_type,owner_id,section) DO UPDATE SET payload=$4, updated_at=CURRENT_TIMESTAMP`, [...args, JSON.stringify(data)]);
    res.json({ success: true, settings: data });
  } catch (error) { res.status(500).json({ success: false, message: 'Không thể lưu cấu hình vào database' }); }
}

async function changePassword(req, res) {
  if (!db.isPostgresConnected()) return res.status(503).json({ success: false, message: 'Database chưa kết nối' });
  const { old_password, new_password } = req.body;
  if (typeof old_password !== 'string' || typeof new_password !== 'string' || new_password.length < 6 || Buffer.byteLength(new_password) > 72 || Buffer.byteLength(old_password) > 72) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới cần ít nhất 6 ký tự và tối đa 72 byte' });
  }
  try {
    const result = await db.pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const hash = result.rows[0]?.password_hash;
    if (!hash || !await bcrypt.compare(old_password, hash)) return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    const nextHash = await bcrypt.hash(new_password, 10);
    const updated = await db.pool.query('UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND password_hash=$3', [nextHash, req.user.id, hash]);
    if (!updated.rowCount) return res.status(409).json({ success: false, message: 'Mật khẩu đã thay đổi; vui lòng thử lại' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu' }); }
}
module.exports = { get, put, getStoreSettings, changePassword, validate };
