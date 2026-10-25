// OnesoftPOS v1.0 - Main Application Entrypoint & Navigation

window.appNavigation = {
  currentView: 'viewPos',

  switchView(viewId) {
    if (viewId === 'viewCompletedItems' && !window.completedItemsModule?.canView()) {
      window.api.showToast('Chức năng này chỉ dành cho quản lý, nhân viên order và thu ngân', 'error');
      return;
    }
    const featureByView = { viewPos: 'POS', viewTables: 'TABLES', viewKds: 'KDS', viewOrders: 'HISTORY', viewAdmin: 'ADMIN' };
    const requiredFeature = featureByView[viewId];
    const canOpenHistoryHub = viewId === 'viewAdmin' && window.appState.roleFeatures.HISTORY !== false;
    if (requiredFeature && window.appState.roleFeatures[requiredFeature] === false && !canOpenHistoryHub) {
      window.api.showToast('Nhóm người dùng của bạn không được cấp chức năng này', 'error');
      return;
    }
    this.currentView = viewId;

    // Toggle active view
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.toggle('active-view', view.id === viewId);
    });

    // Toggle active bottom nav button
    document.querySelectorAll('.bottom-nav-bar .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === (viewId === 'viewOrders' ? 'viewAdmin' : viewId));
    });

    // View specific activations
    if (viewId === 'viewTables' && window.tablesModule) {
      window.tablesModule.loadAreasAndTables();
    } else if (viewId === 'viewKds' && window.kdsModule) {
      window.kdsModule.loadKdsOrders();
    } else if (viewId === 'viewCompletedItems' && window.completedItemsModule) {
      window.completedItemsModule.loadCompletedItems();
    } else if (viewId === 'viewOrders' && window.ordersModule) {
      window.ordersModule.loadOrders();
    } else if (viewId === 'viewAdmin') {
      if (window.moreMenuModule) {
        window.moreMenuModule.showHub();
      } else if (window.adminModule) {
        window.appState.applyAdminTabsConfig();
        window.adminModule.loadReports();
      }
    }
  },

  async reloadCurrentStoreFeatures() {
    const storeId = window.appState.currentStore?.id;
    if (!storeId) return;

    try {
      const [res, me] = await Promise.all([window.api.get(`/stores/${storeId}`), window.api.get('/auth/me')]);
      window.appState.applyRoleFeatures(me.roleFeatures);
      window.appState.currentStore = res.store;
      window.appState.storeSettings = res.settings;
      window.appState.storeType = res.storeType;
      await window.menuPersistence.loadStore().catch(error => window.api.showToast(error.message, 'error'));
      window.appState.applyStoreFeatures(res.features);
      window.appState.applyOrderWorkflow();

      const storeTypeBadge = document.getElementById('storeTypeBadge');
      const storeAddressText = document.getElementById('storeAddressText');

      if (storeTypeBadge) storeTypeBadge.textContent = res.storeType ? res.storeType.name.toUpperCase() : 'CỬA HÀNG';
      if (storeAddressText) storeAddressText.textContent = res.store ? res.store.address : '';
    } catch (err) {
      console.error('reloadCurrentStoreFeatures error:', err);
    }
  }
};

const initializedAppModules = new Set();

async function initializeAvailableModules({ refreshInitialized = false } = {}) {
  const definitions = [
    {
      key: 'pos', feature: 'POS', get: () => window.posModule,
      refresh: async module => {
        await module.loadCatalog();
        module.configureTakeawayWorkspace();
        module.updateFulfillmentVisibility();
        module.renderCart();
      }
    },
    { key: 'tables', feature: 'TABLES', get: () => window.tablesModule, refresh: module => module.loadAreasAndTables() },
    { key: 'kds', feature: 'KDS', get: () => window.kdsModule, refresh: module => module.loadKdsOrders() },
    { key: 'completed-items', get: () => window.completedItemsModule, refresh: module => module.init() },
    {
      key: 'orders', feature: 'HISTORY', get: () => window.ordersModule,
      refresh: module => {
        module.configureView();
        return module.loadOrders();
      }
    },
    { key: 'checkout', feature: 'POS', get: () => window.checkoutModule },
    { key: 'invoice', feature: 'POS', get: () => window.invoiceModule },
    { key: 'shifts', feature: 'SHIFT', get: () => window.shiftsModule, refresh: module => module.loadCurrentShift() },
    { key: 'admin', feature: 'ADMIN', get: () => window.adminModule, refresh: module => module.refresh() }
  ];

  for (const definition of definitions) {
    if (definition.feature && window.appState.roleFeatures[definition.feature] === false) continue;
    const module = definition.get();
    if (!module) continue;
    if (!initializedAppModules.has(definition.key)) {
      await module.init();
      initializedAppModules.add(definition.key);
    } else if (refreshInitialized && definition.refresh) {
      await definition.refresh(module);
    }
  }
}

// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  bindGlobalEvents();

  // Only initialize POS modules after a valid session is available.
  if (await initAuth()) await initializeAvailableModules();
});

// Authentication Initialization
async function initAuth() {
  if (!window.api.getToken()) {
    showLoginModal();
    return false;
  }

  // Fetch current user and stores
  try {
    const meRes = await window.api.get('/auth/me');
    window.appState.user = meRes.user;
    window.appState.stores = meRes.stores || [];
    window.appState.applyRoleFeatures(meRes.roleFeatures);

    if (['SUPER_ADMIN', 'ADMIN'].includes(meRes.user.role) && new URLSearchParams(window.location.search).get('mode') !== 'pos') {
      window.location.replace('/admin.html');
      return false;
    }

    await window.menuPersistence.loadHeader().catch(error => window.api.showToast(error.message, 'error'));
    updateUserProfileUI();
    await initializeCurrentStore();

    // Load active store features
    await window.appNavigation.reloadCurrentStoreFeatures();

    const initialView = [
      ['TABLES', 'viewTables'], ['POS', 'viewPos'], ['KDS', 'viewKds'], ['HISTORY', 'viewOrders'], ['ADMIN', 'viewAdmin']
    ].find(([feature]) => window.appState.roleFeatures[feature] !== false)?.[1];
    if (initialView && window.appNavigation.currentView !== initialView) {
      window.appNavigation.switchView(initialView);
    }
    return true;
  } catch (err) {
    console.error('Auth verification failed:', err);
    window.api.removeToken();
    showLoginModal();
    return false;
  }
}

function updateUserProfileUI() {
  const user = window.appState.user;
  if (!user) return;

  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');

  if (userName) userName.textContent = user.full_name || user.username || 'Thảo ni';
  if (userAvatar) {
    const initials = (user.full_name || user.username || 'TN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    userAvatar.textContent = initials || 'TN';
  }
}

async function initializeCurrentStore() {
  const stores = window.appState.stores || [];
  let currentStoreId = Number(window.api.getCurrentStoreId());
  try {
    const saved = await window.api.get('/auth/preferences/current_store');
    if (saved.settings) currentStoreId = saved.settings.store_id;
  } catch (error) { window.api.showToast(error.message, 'error'); }
  const active = stores.find(store => Number(store.id) === currentStoreId) || stores[0] || null;
  window.appState.currentStore = active;
  // Restore a valid store context without a header selector.
  window.api.setCurrentStoreId(active ? active.id : '');
  const label = document.getElementById('headerCurrentStoreName');
  if (label) {
    label.textContent = active?.name || 'Chưa chọn cửa hàng';
    label.title = label.textContent;
  }
}

// Theme (Dark / Light Mode)
function initTheme() {
  const savedTheme = localStorage.getItem('onesoftpos_theme') || 'light';
  document.body.className = `theme-${savedTheme}`;
  updateThemeIcon(savedTheme);

  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'light' : 'dark';
      document.body.className = `theme-${newTheme}`;
      localStorage.setItem('onesoftpos_theme', newTheme);
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
        window.api.setCurrentStoreId('');
        window.location.replace('/?mode=pos');
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
      if (!window.api.getToken()) return;
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
  for (const id of ['loginUsername', 'loginPassword']) {
    document.getElementById(id)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') btnSubmitLogin?.click();
    });
  }
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'flex';
  const close = document.getElementById('btnCloseLoginModal');
  if (close) close.style.display = window.api.getToken() ? '' : 'none';
}

window.showLoginModal = showLoginModal;

async function executeLogin(username, password) {
  try {
    if (!username || !password) throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu');
    const res = await window.api.post('/auth/login', { username, password });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(res.user.role) && !res.stores?.length) {
      throw new Error('Tài khoản chưa được gán cửa hàng. Vui lòng liên hệ quản trị viên');
    }
    window.api.setToken(res.token);
    window.appState.user = res.user;
    window.appState.stores = res.stores || [];

    if (['SUPER_ADMIN', 'ADMIN'].includes(res.user.role)) {
      window.location.replace('/admin.html');
      return;
    }

    const defaultStoreId = res.defaultStore ? res.defaultStore.id : res.stores[0].id;
    window.api.setCurrentStoreId(defaultStoreId);
    window.appState.applyRoleFeatures(res.roleFeatures);

    await window.menuPersistence.loadHeader().catch(error => window.api.showToast(error.message, 'error'));
    updateUserProfileUI();
    await initializeCurrentStore();
    await window.appNavigation.reloadCurrentStoreFeatures();
    await initializeAvailableModules({ refreshInitialized: true });

    document.getElementById('loginModal').style.display = 'none';
    window.api.showToast(`Chào mừng ${res.user.full_name} (${res.user.role})!`, 'success');

    // Open the first feature available to this role.
    const firstView = [
      ['TABLES', 'viewTables'], ['POS', 'viewPos'], ['KDS', 'viewKds'], ['HISTORY', 'viewOrders'], ['ADMIN', 'viewAdmin']
    ].find(([feature]) => window.appState.roleFeatures[feature] !== false)?.[1] || 'viewPos';
    window.appNavigation.switchView(firstView);
    if (window.posModule) window.posModule.loadCatalog();
  } catch (err) {
    window.api.showToast('Đăng nhập thất bại: ' + err.message, 'error');
  }
}
