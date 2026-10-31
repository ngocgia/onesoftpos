function storeAccessState(store, now = Date.now()) {
  if (store.status !== 'ACTIVE') return 'LOCKED';
  if (store.expires_at && now >= new Date(store.expires_at).getTime()) return 'EXPIRED';
  if (store.activation_at && now < new Date(store.activation_at).getTime()) return 'NOT_STARTED';
  return 'ACTIVE';
}

const accessMessages = {
  LOCKED: 'Cửa hàng đang tạm khóa. Vui lòng liên hệ quản trị viên.',
  EXPIRED: 'Cửa hàng đã hết thời gian sử dụng. Vui lòng liên hệ quản trị viên để gia hạn.',
  NOT_STARTED: 'Cửa hàng chưa đến thời gian kích hoạt.'
};

function publicStoreLifecycle(store) {
  return { ...store, usage_type: store.usage_type || 'OFFICIAL', access_status: storeAccessState(store) };
}

function parseLifecycle(body, current = {}) {
  const invalid = message => Object.assign(new Error(message), { statusCode: 400 });
  const patch = {};
  if (body.usage_type !== undefined) {
    if (!['TRIAL', 'OFFICIAL'].includes(body.usage_type)) throw invalid('Hình thức sử dụng phải là Thử nghiệm hoặc Chính thức');
    patch.usage_type = body.usage_type;
  }
  if (body.status !== undefined && !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(body.status)) throw invalid('Trạng thái cửa hàng không hợp lệ');
  for (const field of ['activation_at', 'expires_at']) {
    if (body[field] === undefined) continue;
    const value = body[field];
    if (value === null || value === '') { patch[field] = null; continue; }
    // API dates must have an explicit timezone; HTML datetime-local values are converted by the UI.
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
      throw invalid('Thời gian kích hoạt/kết thúc không hợp lệ hoặc thiếu múi giờ');
    }
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw invalid('Ngày kích hoạt/kết thúc không hợp lệ');
    patch[field] = new Date(value).toISOString();
  }
  const merged = { ...current, ...patch };
  if (merged.activation_at && merged.expires_at && new Date(merged.expires_at) <= new Date(merged.activation_at)) {
    throw invalid('Thời gian kết thúc phải sau thời gian kích hoạt');
  }
  return patch;
}

module.exports = { storeAccessState, accessMessages, publicStoreLifecycle, parseLifecycle };
