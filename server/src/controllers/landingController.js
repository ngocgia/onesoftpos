const db = require('../config/db');
const { randomInt } = require('node:crypto');
const catalog = require('../../../public/data/landing-fields.json');
const fields = new Map(catalog.map(field => [field.key, field]));

function safeLink(value) {
  if (/^[\u0000-\u0020]|[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith('#') || /^\/(?!\/)/.test(value)) return true;
  try { return ['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(value).protocol); }
  catch { return false; }
}
function validateOverrides(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Nội dung không hợp lệ');
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    const field = fields.get(key);
    if (!field || typeof value !== 'string' || value.length > 3000) throw new Error('Trường nội dung không hợp lệ: ' + key);
    if (field.type === 'link' && !safeLink(value)) throw new Error('Liên kết không hợp lệ: ' + field.label);
    if (value !== field.value) clean[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(clean)) > 80000) throw new Error('Nội dung quá lớn (tối đa 80 KB)');
  return clean;
}
function available(res) {
  if (db.isPostgresConnected()) return true;
  res.status(503).json({ message: 'Database chưa kết nối. Chưa thể lưu hoặc tải nội dung.' });
  return false;
}
async function readContent() {
  const result = await db.pool.query('SELECT payload FROM menu_preferences WHERE owner_type=$1 AND owner_id=$2 AND section=$3', ['system', 0, 'landing']);
  return result.rows.length ? validateOverrides(JSON.parse(result.rows[0].payload)) : {};
}
async function get(req, res) {
  res.set('Cache-Control', 'no-store');
  if (!available(res)) return;
  try { res.json({ overrides: await readContent(), ...(req.path.startsWith('/admin/') ? { fields: catalog } : {}) }); }
  catch { res.status(500).json({ message: 'Không tải được nội dung trang giới thiệu' }); }
}
async function put(req, res) {
  if (!available(res)) return;
  let clean;
  try { clean = validateOverrides(req.body.overrides); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    await db.pool.query(`INSERT INTO menu_preferences (owner_type,owner_id,section,payload) VALUES ($1,$2,$3,$4)
      ON CONFLICT (owner_type,owner_id,section) DO UPDATE SET payload=$4, updated_at=CURRENT_TIMESTAMP`, ['system', 0, 'landing', JSON.stringify(clean)]);
    res.json({ success: true, overrides: clean });
  } catch { res.status(500).json({ message: 'Không lưu được nội dung vào database' }); }
}
function validateLead(body) {
  const limits = { name: 120, phone: 30, store: 200, industry: 120, package: 120, note: 2000 };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !Object.hasOwn(limits, key))) throw new Error('Thông tin liên hệ không hợp lệ');
  const lead = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof body[key] !== 'string' || body[key].length > limit) throw new Error('Thông tin liên hệ quá dài hoặc không hợp lệ');
    lead[key] = body[key].trim();
  }
  if (lead.name.length < 2 || lead.store.length < 2 || !/^[0-9+\s()-]{9,20}$/.test(lead.phone)) throw new Error('Vui lòng kiểm tra tên, số điện thoại và cửa hàng');
  return lead;
}
// Bounded per-process anti-spam, independent of authenticated POS traffic.
const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now(), key = req.ip;
  for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 5 || (!attempts.has(key) && attempts.size >= 5000)) return res.status(429).json({ message: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' });
  entry.count++;
  attempts.set(key, entry);
  next();
}
async function contact(req, res) {
  if (!available(res)) return;
  let lead;
  try { lead = validateLead(req.body); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    await db.pool.query('INSERT INTO menu_preferences (owner_type,owner_id,section,payload) VALUES ($1,$2,$3,$4)', ['lead', randomInt(1, 2147483647), 'landing', JSON.stringify(lead)]);
    res.status(201).json({ success: true });
  } catch { res.status(500).json({ message: 'Chưa lưu được yêu cầu. Vui lòng thử lại.' }); }
}
async function leads(req, res) {
  res.set('Cache-Control', 'no-store');
  if (!available(res)) return;
  try {
    const result = await db.pool.query('SELECT owner_id,payload,updated_at FROM menu_preferences WHERE owner_type=$1 AND section=$2 ORDER BY updated_at DESC LIMIT 100', ['lead', 'landing']);
    res.json({ leads: result.rows.map(row => ({ id: row.owner_id, createdAt: row.updated_at, ...JSON.parse(row.payload) })) });
  } catch { res.status(500).json({ message: 'Không tải được danh sách liên hệ' }); }
}
module.exports = { get, put, contact, leads, rateLimit, validateOverrides, validateLead, safeLink };
