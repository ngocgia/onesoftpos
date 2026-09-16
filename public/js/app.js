// ThichGaPOS v1.0 - Main Application Entrypoint & Navigation

window.appNavigation = {
  currentView: 'viewPos',

  switchView(viewId) {
    this.currentView = viewId;

    // Toggle active view
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.toggle('active-view', view.id === viewId);
    });

    // Toggle active bottom nav button
    document.querySelectorAll('.bottom-nav-bar .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    // View specific activations
    if (viewId === 'viewTables' && window.tablesModule) {
      window.tablesModule.loadAreasAndTables();
    } else if (viewId === 'viewKds' && window.kdsModule) {
      window.kdsModule.loadKdsOrders();
    } else if (viewId === 'viewOrders' && window.ordersModule) {
      window.ordersModule.loadOrders();
    } else if (viewId === 'viewAdmin' && window.adminModule) {
      window.adminModule.loadReports();
    }
  },

  async reloadCurrentStoreFeatures() {
    const storeId = window.appState.currentStore?.id;
    if (!storeId) return;

    try {
      const res = await window.api.get(`/stores/${storeId}`);
      window.appState.currentStore = res.store;
      window.appState.storeSettings = res.settings;
      window.appState.storeType = res.storeType;
      window.appState.applyStoreFeatures(res.features);

      const storeTypeBadge = document.getElementById('storeTypeBadge');
      const storeAddressText = document.getElementById('storeAddressText');

      if (storeTypeBadge) storeTypeBadge.textContent = res.storeType ? res.storeType.name.toUpperCase() : 'CỬA HÀNG';
      if (storeAddressText) storeAddressText.textContent = res.store ? res.store.address : '';
    } catch (err) {
      console.error('reloadCurrentStoreFeatures error:', err);
    }
  }
};

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  bindGlobalEvents();

  // Auto login or check existing token
  await initAuth();

  // Initialize modules
  if (window.posModule) await window.posModule.init();
  if (window.tablesModule) await window.tablesModule.init();
  if (window.kdsModule) window.kdsModule.init();
  if (window.ordersModule) window.ordersModule.init();
  if (window.checkoutModule) window.checkoutModule.init();
  if (window.invoiceModule) window.invoiceModule.init();
  if (window.shiftsModule) window.shiftsModule.init();
  if (window.adminModule) window.adminModule.init();
});

// Authentication Initialization
async function initAuth() {
  let token = window.api.getToken();

  if (!token) {
    // Perform auto-login with default cashier for seamless testing
    try {
      const loginRes = await window.api.post('/auth/login', { username: 'cashier', password: '123456' });
      token = loginRes.token;
      window.api.setToken(token);
      window.appState.user = loginRes.user;
      window.appState.stores = loginRes.stores;
      
      const defaultStoreId = loginRes.defaultStore ? loginRes.defaultStore.id : (loginRes.stores[0]?.id || 1);
      window.api.setCurrentStoreId(defaultStoreId);
    } catch (err) {
      console.warn('Auto login failed:', err);
      showLoginModal();
      return;
    }
  }

  // Fetch current user and stores
  try {
    const meRes = await window.api.get('/auth/me');
    window.appState.user = meRes.user;
    window.appState.stores = meRes.stores || [];

    updateUserProfileUI();
    populateStoreSelector();

    // Load active store features
    await window.appNavigation.reloadCurrentStoreFeatures();
  } catch (err) {
    console.error('Auth verification failed:', err);
    showLoginModal();
  }
}

function updateUserProfileUI() {
  const user = window.appState.user;
  if (!user) return;

  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');

  if (userName) userName.textContent = user.full_name || user.username;
  if (userRole) userRole.textContent = user.role;
  if (userAvatar) {
    const initials = (user.full_name || user.username).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    userAvatar.textContent = initials || 'TG';
  }
}

function populateStoreSelector() {
  const select = document.getElementById('storeSelector');
  if (!select) return;

  const stores = window.appState.stores || [];
  const currentStoreId = parseInt(window.api.getCurrentStoreId(), 10);

  select.innerHTML = stores.map(s => `
    <option value="${s.id}" ${s.id === currentStoreId ? 'selected' : ''}>
      ${s.name} (${s.store_type_name || ''})
    </option>
  `).join('');

  // Set default currentStore in state
  const active = stores.find(s => s.id === currentStoreId) || stores[0];
  window.appState.currentStore = active;

  select.addEventListener('change', async (e) => {
    const newStoreId = parseInt(e.target.value, 10);
    window.api.setCurrentStoreId(newStoreId);
    const newStore = stores.find(s => s.id === newStoreId);
    window.appState.currentStore = newStore;

    // Reset table selection and cart
    window.appState.clearCart();
    window.appState.setSelectedTable(null);

    // Reload features and notify all modules
    await window.appNavigation.reloadCurrentStoreFeatures();
    window.appState.notify('store_changed', newStore);
    window.api.showToast(`Đã chuyển sang: ${newStore.name}`, 'info');
  });
}

// Theme (Dark / Light Mode)
function initTheme() {
  const savedTheme = localStorage.getItem('thichgapos_theme') || 'light';
  document.body.className = `theme-${savedTheme}`;
  updateThemeIcon(savedTheme);

  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'light' : 'dark';
      document.body.className = `theme-${newTheme}`;
      localStorage.setItem('thichgapos_theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.innerHTML = theme === 'dark' 
      ? '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>' 
      : '<i class="fa-solid fa-moon"></i>';
  }
}

// Global Event Bindings
function bindGlobalEvents() {
  // Bottom nav switching
  const navItems = document.querySelectorAll('.bottom-nav-bar .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      window.appNavigation.switchView(viewId);
    });
  });

  // Logout button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Bạn có muốn đăng xuất khỏi hệ thống?')) {
        window.api.removeToken();
        showLoginModal();
      }
    });
  }

  // Discount Modal
  const btnOpenDiscount = document.getElementById('btnOpenDiscountModal');
  const modalDiscount = document.getElementById('discountModal');
  const btnCloseDiscount = document.getElementById('btnCloseDiscountModal');
  const btnApplyDiscount = document.getElementById('btnApplyDiscount');

  if (btnOpenDiscount && modalDiscount) {
    btnOpenDiscount.addEventListener('click', () => {
      modalDiscount.style.display = 'flex';
    });
  }
  if (btnCloseDiscount && modalDiscount) {
    btnCloseDiscount.addEventListener('click', () => {
      modalDiscount.style.display = 'none';
    });
  }
  if (btnApplyDiscount) {
    btnApplyDiscount.addEventListener('click', () => {
      const cashVal = parseFloat(document.getElementById('discountCashInput')?.value || 0);
      const percentVal = parseFloat(document.getElementById('discountPercentInput')?.value || 0);

      window.appState.cart.discountCash = cashVal;
      window.appState.cart.discountPercent = percentVal;

      const label = document.getElementById('discountBtnLabel');
      if (label) {
        if (cashVal > 0) label.textContent = `Giảm -${window.api.formatMoney(cashVal)}`;
        else if (percentVal > 0) label.textContent = `Giảm -${percentVal}%`;
        else label.textContent = 'Giảm giá';
      }

      window.appState.notify('cart_updated', window.appState.cart);
      modalDiscount.style.display = 'none';
      window.api.showToast('Đã áp dụng giảm giá', 'success');
    });
  }

  // Note Modal
  const btnOpenNote = document.getElementById('btnOpenNoteModal');
  const modalNote = document.getElementById('noteModal');
  const btnCloseNote = document.getElementById('btnCloseNoteModal');
  const btnApplyNote = document.getElementById('btnApplyOrderNote');

  if (btnOpenNote && modalNote) {
    btnOpenNote.addEventListener('click', () => {
      const noteInput = document.getElementById('orderGeneralNote');
      if (noteInput) noteInput.value = window.appState.cart.note || '';
      modalNote.style.display = 'flex';
    });
  }
  if (btnCloseNote && modalNote) {
    btnCloseNote.addEventListener('click', () => {
      modalNote.style.display = 'none';
    });
  }
  if (btnApplyNote) {
    btnApplyNote.addEventListener('click', () => {
      const noteInput = document.getElementById('orderGeneralNote');
      window.appState.cart.note = noteInput?.value.trim() || '';

      const label = document.getElementById('noteBtnLabel');
      if (label) {
        label.textContent = window.appState.cart.note ? 'Có ghi chú' : 'Ghi chú';
      }

      modalNote.style.display = 'none';
      window.api.showToast('Đã lưu ghi chú đơn', 'success');
    });
  }

  // Quick Login Modal Buttons
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  const btnCloseLogin = document.getElementById('btnCloseLoginModal');

  if (btnCloseLogin) {
    btnCloseLogin.addEventListener('click', () => {
      document.getElementById('loginModal').style.display = 'none';
    });
  }

  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
      const u = document.getElementById('loginUsername')?.value.trim();
      const p = document.getElementById('loginPassword')?.value.trim();
      await executeLogin(u, p);
    });
  }

  document.querySelectorAll('.btn-quick-login').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userType = btn.getAttribute('data-user');
      await executeLogin(userType, '123456');
    });
  });
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'flex';
}

window.showLoginModal = showLoginModal;

async function executeLogin(username, password) {
  try {
    const res = await window.api.post('/auth/login', { username, password });
    window.api.setToken(res.token);
    window.appState.user = res.user;
    window.appState.stores = res.stores || [];

    const defaultStoreId = res.defaultStore ? res.defaultStore.id : (res.stores[0]?.id || 1);
    window.api.setCurrentStoreId(defaultStoreId);

    updateUserProfileUI();
    populateStoreSelector();
    await window.appNavigation.reloadCurrentStoreFeatures();

    document.getElementById('loginModal').style.display = 'none';
    window.api.showToast(`Chào mừng ${res.user.full_name} (${res.user.role})!`, 'success');

    // Refresh view
    window.appNavigation.switchView('viewPos');
    if (window.posModule) window.posModule.loadCatalog();
  } catch (err) {
    window.api.showToast('Đăng nhập thất bại: ' + err.message, 'error');
  }
}
