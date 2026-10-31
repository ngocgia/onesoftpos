const DEFAULT_SESSION_DAYS = 7;
const MAX_SESSION_DAYS = 3650;

function validSessionDays(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SESSION_DAYS;
}

function parseSessionDays(value) {
  if (value === undefined) return undefined;
  const days = Number(value);
  if (!['string', 'number'].includes(typeof value) || !validSessionDays(days)) {
    const error = new Error(`Thời gian đăng nhập phải là số nguyên từ 1 đến ${MAX_SESSION_DAYS} ngày`);
    error.statusCode = 400;
    throw error;
  }
  return days;
}

function getSessionDays(value) {
  const days = Number(value);
  return validSessionDays(days) ? days : DEFAULT_SESSION_DAYS;
}

module.exports = { DEFAULT_SESSION_DAYS, parseSessionDays, getSessionDays };
