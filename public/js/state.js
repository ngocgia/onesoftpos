// ThichGaPOS v1.0 - Global State Management (Rule 46: Dynamic UI by Store Type Features)

const createEmptyPosCart = () => ({
  orderType: 'TAKEAWAY',
  selectedTable: null,
  existingOrderId: null,
  fulfillmentType: '',
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  scheduledAt: '',
  items: [],
  discountCash: 0,
  discountPercent: 0,
  note: ''
});

window.appState = {
  user: null,
  stores: [],
  currentStore: null,
  storeSettings: null,
  storeType: null,
  features: {
    enableSale: true,
    enableTakeaway: true,
    enableDineIn: false,
    enableTable: false,
    enableKds: true,
    enableInvoice: true,
    enableQrPayment: true,
    enableInventory: true,
    enableTakeawayWorkspace: false
  },
  currentShift: null,
  roleFeatures: {
    POS: true,
    TABLES: true,
    KDS: true,
    ORDERS: true,
    HISTORY: true,
    PAYMENT: true,
    ADMIN: true,
    SHIFT: true,
    DISCOUNT: true,
    COMPLETED_ITEMS: true
  },

  // Active Cart state
  cart: createEmptyPosCart(),
  takeawayDrafts: [],
  activeTakeawayDraftId: null,
  takeawayDraftSequence: 0,

  // State listeners
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  },

  isTakeawayOnlyStore() {
    return this.features.enableTakeawayWorkspace === true;
  },

  getActiveTakeawayDraft() {
    return this.takeawayDrafts.find(draft => draft.id === this.activeTakeawayDraftId) || null;
  },

  ensureTakeawayDraft() {
    if (!this.isTakeawayOnlyStore()) return null;
    let draft = this.getActiveTakeawayDraft();
    if (!draft) {
      draft = this.createTakeawayDraft({ activate: false });
      this.activateTakeawayDraft(draft.id);
    }
    return draft;
  },

  createTakeawayDraft({ activate = true } = {}) {
    this.takeawayDraftSequence += 1;
    const draft = {
      id: `takeaway_${Date.now()}_${this.takeawayDraftSequence}`,
      number: this.takeawayDraftSequence,
      createdAt: new Date().toISOString(),
      cart: createEmptyPosCart()
    };
    this.takeawayDrafts.push(draft);
    if (activate) this.activateTakeawayDraft(draft.id);
    this.notify('takeaway_drafts_updated', this.takeawayDrafts);
    return draft;
  },

  activateTakeawayDraft(id) {
    const draft = this.takeawayDrafts.find(item => item.id === id);
    if (!draft) return false;
    this.activeTakeawayDraftId = draft.id;
    this.cart = draft.cart;
    this.notify('cart_updated', this.cart);
    this.notify('takeaway_drafts_updated', this.takeawayDrafts);
    return true;
  },

  removeTakeawayDraft(id) {
    const index = this.takeawayDrafts.findIndex(draft => draft.id === id);
    if (index < 0) return;
    const wasActive = this.activeTakeawayDraftId === id;
    this.takeawayDrafts.splice(index, 1);
    if (this.takeawayDrafts.length === 0) {
      this.createTakeawayDraft();
      return;
    }
    if (wasActive) {
      const next = this.takeawayDrafts[Math.min(index, this.takeawayDrafts.length - 1)];
      this.activateTakeawayDraft(next.id);
    }
    this.notify('takeaway_drafts_updated', this.takeawayDrafts);
  },

  completeActiveTakeawayDraft() {
    const completedId = this.activeTakeawayDraftId;
    if (completedId) this.removeTakeawayDraft(completedId);
  },

  resetTakeawayDrafts() {
    this.takeawayDrafts = [];
    this.activeTakeawayDraftId = null;
    this.takeawayDraftSequence = 0;
    this.cart = createEmptyPosCart();
    this.notify('cart_updated', this.cart);
    this.notify('takeaway_drafts_updated', this.takeawayDrafts);
  },

  applyRoleFeatures(features) {
    if (!features) return;
    this.roleFeatures = { ...this.roleFeatures, ...features };
    const visibility = {
      navItemPos: 'POS',
      navItemTables: 'TABLES',
      navItemKds: 'KDS',
      menuItemOrderHistory: 'HISTORY',
      navItemAdmin: 'ADMIN',
      btnShiftStatus: 'SHIFT',
      btnOpenDiscountModal: 'DISCOUNT'
    };
    Object.entries(visibility).forEach(([id, code]) => {
      const element = document.getElementById(id);
      if (element) {
        let isVisible = id === 'navItemAdmin'
          ? this.roleFeatures.ADMIN || this.roleFeatures.HISTORY
          : this.roleFeatures[code];
        // Override for TABLES if takeaway workspace is enabled
        if (id === 'navItemTables' && this.features?.enableTakeawayWorkspace) {
          isVisible = false;
        }
        element.style.display = isVisible ? '' : 'none';
      }
    });
    const checkoutButton = document.getElementById('btnProceedCheckout');
    if (checkoutButton) checkoutButton.style.display = this.roleFeatures.PAYMENT ? '' : 'none';
    window.completedItemsModule?.configureAccess();
    
    this.applyAdminTabsConfig();
    
    this.setOrderType(this.cart.orderType);
    this.notify('role_features_updated', this.roleFeatures);
  },

  applyAdminTabsConfig() {
    let adminTabs = this.storeSettings?.admin_tabs;
    if (typeof adminTabs === 'string') {
      try { adminTabs = JSON.parse(adminTabs); } catch (_) { adminTabs = null; }
    }
    const defaultTabs = { reports: true, stores: true, storeTypes: true, products: true, tables: true, staff: true, inventory: true };
    const settings = adminTabs || defaultTabs;
    // Store staff APIs are intentionally scoped to STORE_MANAGER. Keep this
    // operational tab available to that role even when an older admin_tabs
    // value accidentally persisted staff=false.
    const canManageStaff = this.user?.role === 'STORE_MANAGER';
    const canManageInventory = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(this.user?.role);
    
    const mapping = {
      tabAdminReports: settings.reports !== false,
      tabAdminStores: settings.stores !== false,
      tabAdminWorkflows: settings.storeTypes !== false,
      tabAdminProducts: settings.products !== false,
      tabAdminTables: settings.tables !== false && !this.features?.enableTakeawayWorkspace,
      tabAdminStaff: canManageStaff,
      tabAdminInventory: settings.inventory !== false && canManageInventory && this.features?.enableInventory !== false
    };
    
    Object.entries(mapping).forEach(([id, isVisible]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = isVisible ? '' : 'none';
    });

    const hub = document.getElementById('moreMenuHub');
    if (hub && hub.style.display !== 'none') {
      return;
    }

    const activeAdminTab = document.querySelector('.admin-nav-tab.active');
    if (activeAdminTab && activeAdminTab.style.display === 'none') {
      const firstVisibleTab = Array.from(document.querySelectorAll('.admin-nav-tab')).find(tab => tab.style.display !== 'none');
      if (firstVisibleTab) {
        firstVisibleTab.click?.();
        document.querySelectorAll('.admin-nav-tab').forEach(t => t.classList.remove('active'));
        firstVisibleTab.classList.add('active');
        const target = firstVisibleTab.dataset.target;
        document.querySelectorAll('.admin-subview').forEach(v => v.classList.toggle('active', v.id === target));
      }
    }
  },

  // Rule 46: Cập nhật giao diện động theo STORE_TYPE_FEATURES
  // Tuyệt đối không hard-code if(store.name === ...) hay if(store.id === 1)
  applyStoreFeatures(features) {
    if (!features) return;
    this.features = { ...this.features, ...features };
    // Also apply admin tabs config whenever store features are applied
    this.applyAdminTabsConfig();

    const btnDineInTab = document.getElementById('btnDineInTab');
    const navItemTables = document.getElementById('navItemTables');
    const navItemKds = document.getElementById('navItemKds');
    const selectedTablePill = document.getElementById('selectedTablePill');
    const featurePillsContainer = document.getElementById('featurePillsContainer');
    const canManageTables = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(this.user?.role)
      && this.roleFeatures.TABLES !== false
      && !this.features.enableTakeawayWorkspace;

    // 1. Kiểm tra tính năng Tại Chỗ (Dine-in) & Quản lý bàn (Table)
    if (this.features.enableTakeawayWorkspace) {
      if (btnDineInTab) btnDineInTab.style.display = 'none';
      if (navItemTables) navItemTables.style.display = 'none';
      this.setOrderType('TAKEAWAY');
    } else if (this.features.enableDineIn && this.features.enableTable && this.roleFeatures.TABLES) {
      if (btnDineInTab) btnDineInTab.style.display = 'inline-flex';
      if (navItemTables) navItemTables.style.display = 'flex';
      // Dine-in stores start new, empty orders in table-service mode.
      if (!this.cart.items.length && !this.cart.existingOrderId) this.setOrderType('DINE_IN');
    } else {
      if (btnDineInTab) btnDineInTab.style.display = 'none';
      if (navItemTables) navItemTables.style.display = canManageTables ? 'flex' : 'none';
      // Tự động chuyển về Mang đi nếu tính năng Tại chỗ bị tắt
      this.setOrderType('TAKEAWAY');
    }

    // 2. Kiểm tra tính năng KDS
    if (navItemKds) {
      navItemKds.style.display = (this.features.enableKds && this.roleFeatures.KDS) ? 'flex' : 'none';
    }

    // 3. Render feature chips lên banner
    if (featurePillsContainer) {
      featurePillsContainer.innerHTML = `
        <span class="feature-chip ${this.features.enableTakeaway ? 'active' : ''}" title="Mang đi" aria-label="Mang đi">
          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><span class="feature-chip-label">Mang đi</span>
        </span>
        <span class="feature-chip ${this.features.enableDineIn ? 'active' : ''}" title="Tại chỗ" aria-label="Tại chỗ">
          <i class="fa-solid fa-utensils" aria-hidden="true"></i><span class="feature-chip-label">Tại chỗ</span>
        </span>
        <span class="feature-chip ${this.features.enableTable ? 'active' : ''}" title="Bàn" aria-label="Bàn">
          <i class="fa-solid fa-chair" aria-hidden="true"></i><span class="feature-chip-label">Bàn</span>
        </span>
        <span class="feature-chip ${this.features.enableKds ? 'active' : ''}" title="KDS" aria-label="KDS">
          <i class="fa-solid fa-kitchen-set" aria-hidden="true"></i><span class="feature-chip-label">KDS</span>
        </span>
        <span class="feature-chip ${this.features.enableQrPayment ? 'active' : ''}" title="VietQR" aria-label="VietQR">
          <i class="fa-solid fa-qrcode" aria-hidden="true"></i><span class="feature-chip-label">VietQR</span>
        </span>
      `;
    }

    this.notify('features_updated', this.features);
  },

  applyOrderWorkflow() {
    const workflow = this.storeSettings?.workflow_definition;
    const checkoutButton = document.getElementById('btnProceedCheckout');

    // Cả hai luồng đều yêu cầu bếp hoàn tất trước khi thu tiền. Thanh toán
    // được thực hiện từ danh sách đơn sau khi đơn chuyển sang READY.
    if (checkoutButton) checkoutButton.style.display = 'none';

    this.setOrderType(this.cart.orderType);
    this.notify('order_workflow_updated', workflow);
  },

  setOrderType(type) {
    if (type === 'DINE_IN' && (!this.features.enableDineIn || !this.features.enableTable)) {
      window.api.showToast('Cửa hàng này không hỗ trợ bán tại bàn', 'error');
      return;
    }

    this.cart.orderType = type;
    const tabs = document.querySelectorAll('.type-tab-btn');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-type') === type);
    });

    const selectedTablePill = document.getElementById('selectedTablePill');
    if (selectedTablePill) {
      selectedTablePill.style.display = (type === 'DINE_IN' && this.cart.selectedTable) ? 'inline-flex' : 'none';
    }

    const btnSendKitchen = document.getElementById('btnSendKitchen');
    if (btnSendKitchen) {
      const workflow = this.storeSettings?.workflow_definition || { steps: [] };
      const role = this.user?.role;
      const createStep = workflow.steps?.[0];
      const nextStep = workflow.steps?.[1];
      const canCreate = role === 'SUPER_ADMIN' || (createStep
        ? createStep.roles?.includes(role)
        : this.roleFeatures.POS !== false);
      btnSendKitchen.style.display = canCreate ? 'inline-flex' : 'none';
      btnSendKitchen.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${nextStep ? `Chuyển: ${nextStep.name}` : 'Tạo đơn'}`;
    }

    this.notify('order_type_changed', type);
    window.posModule?.updateFulfillmentVisibility?.();
  },

  setSelectedTable(table) {
    this.cart.selectedTable = table;
    this.cart.existingOrderId = table?.current_order_id || null;
    const selectedTablePill = document.getElementById('selectedTablePill');
    const activeTableCode = document.getElementById('activeTableCode');

    if (table) {
      if (activeTableCode) activeTableCode.textContent = table.code;
      if (selectedTablePill) selectedTablePill.style.display = 'inline-flex';
      this.setOrderType('DINE_IN');
    } else {
      if (selectedTablePill) selectedTablePill.style.display = 'none';
    }

    this.notify('table_selected', table);
  },

  // Cart operations
  addToCart(item) {
    if (this.isTakeawayOnlyStore()) this.ensureTakeawayDraft();
    // Check if identical item (same product_id, variant_id, options, note) exists
    const optionsKey = (item.options || []).map(o => o.option_id || o.name).sort().join('_');
    const existingIndex = this.cart.items.findIndex(i => 
      i.product_id === item.product_id && 
      i.variant_id === item.variant_id && 
      (i.note || '') === (item.note || '') &&
      (i.options || []).map(o => o.option_id || o.name).sort().join('_') === optionsKey
    );

    if (existingIndex >= 0) {
      this.cart.items[existingIndex].quantity += (item.quantity || 1);
      this.cart.items[existingIndex].subtotal = this.cart.items[existingIndex].unit_price_with_options * this.cart.items[existingIndex].quantity;
    } else {
      const unitWithOptions = item.unit_price + (item.options || []).reduce((s, o) => s + (o.price || 0), 0);
      this.cart.items.push({
        ...item,
        unit_price_with_options: unitWithOptions,
        subtotal: unitWithOptions * (item.quantity || 1)
      });
    }

    this.notify('cart_updated', this.cart);
    if (this.isTakeawayOnlyStore()) this.notify('takeaway_drafts_updated', this.takeawayDrafts);
  },

  updateCartItemQty(index, delta) {
    if (!this.cart.items[index]) return;
    this.cart.items[index].quantity += delta;
    if (this.cart.items[index].quantity <= 0) {
      this.cart.items.splice(index, 1);
    } else {
      this.cart.items[index].subtotal = this.cart.items[index].unit_price_with_options * this.cart.items[index].quantity;
    }
    this.notify('cart_updated', this.cart);
    if (this.isTakeawayOnlyStore()) this.notify('takeaway_drafts_updated', this.takeawayDrafts);
  },

  clearCart() {
    this.cart.items = [];
    this.cart.discountCash = 0;
    this.cart.discountPercent = 0;
    this.cart.note = '';
    this.cart.fulfillmentType = '';
    this.cart.customerName = '';
    this.cart.customerPhone = '';
    this.cart.deliveryAddress = '';
    this.cart.scheduledAt = '';
    window.posModule?.resetFulfillmentForm?.();
    this.notify('cart_updated', this.cart);
    if (this.isTakeawayOnlyStore()) this.notify('takeaway_drafts_updated', this.takeawayDrafts);
  },

  getCartSubtotal() {
    return this.cart.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  },

  getCartDiscount() {
    const subtotal = this.getCartSubtotal();
    let discount = this.cart.discountCash || 0;
    if (this.cart.discountPercent > 0) {
      discount += (subtotal * this.cart.discountPercent) / 100;
    }
    return Math.min(subtotal, discount);
  },

  getCartGrandTotal() {
    return Math.max(0, this.getCartSubtotal() - this.getCartDiscount());
  },

  getCartItemCount() {
    return this.cart.items.reduce((cnt, item) => cnt + (item.quantity || 1), 0);
  }
};
