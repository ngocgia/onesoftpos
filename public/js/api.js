// ThichGaPOS v1.0 - API Client

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('thichgapos_token') || '';
}

function setToken(token) {
  localStorage.setItem('thichgapos_token', token);
}

function removeToken() {
  localStorage.removeItem('thichgapos_token');
}

function getCurrentStoreId() {
  return localStorage.getItem('thichgapos_store_id') || '';
}

function setCurrentStoreId(storeId) {
  localStorage.setItem('thichgapos_store_id', storeId);
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const storeId = getCurrentStoreId();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (storeId) {
    headers['X-Store-Id'] = storeId;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Trigger login modal if unauthorized
        if (window.showLoginModal) {
          window.showLoginModal();
        }
      }
      throw new Error(data.message || 'Đã có lỗi xảy ra');
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check text-success"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation text-danger"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Currency format helper
function formatMoney(amount = 0) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(amount)
    .replace('₫', 'đ');
}

window.api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  del: (url) => apiRequest(url, { method: 'DELETE' }),
  getToken,
  setToken,
  removeToken,
  getCurrentStoreId,
  setCurrentStoreId,
  showToast,
  formatMoney
};
