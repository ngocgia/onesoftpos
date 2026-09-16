// ThichGaPOS v1.0 - Global State Management (Rule 46: Dynamic UI by Store Type Features)

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
    enableInventory: true
  },
  currentShift: null,

  // Active Cart state
  cart: {
    orderType: 'TAKEAWAY', // 'TAKEAWAY' or 'DINE_IN'
    selectedTable: null,   // { id, code, name }
    items: [],             // [{ product_id, product_name, variant_id, variant_name, unit_price, quantity, subtotal, note, kitchen_type, options: [] }]
    discountCash: 0,
    discountPercent: 0,
    note: ''
  },

  // State listeners
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  },

  // Rule 46: Cập nhật giao diện động theo STORE_TYPE_FEATURES
  // Tuyệt đối không hard-code if(store.name === ...) hay if(store.id === 1)
  applyStoreFeatures(features) {
    if (!features) return;
    this.features = { ...this.features, ...features };

    const btnDineInTab = document.getElementById('btnDineInTab');
    const navItemTables = document.getElementById('navItemTables');
    const navItemKds = document.getElementById('navItemKds');
    const selectedTablePill = document.getElementById('selectedTablePill');
    const featurePillsContainer = document.getElementById('featurePillsContainer');

    // 1. Kiểm tra tính năng Tại Chỗ (Dine-in) & Quản lý bàn (Table)
    if (this.features.enableDineIn && this.features.enableTable) {
      if (btnDineInTab) btnDineInTab.style.display = 'inline-flex';
      if (navItemTables) navItemTables.style.display = 'flex';
    } else {
      if (btnDineInTab) btnDineInTab.style.display = 'none';
      if (navItemTables) navItemTables.style.display = 'none';
      // Tự động chuyển về Mang đi nếu tính năng Tại chỗ bị tắt
      this.setOrderType('TAKEAWAY');
    }

    // 2. Kiểm tra tính năng KDS
    if (navItemKds) {
      navItemKds.style.display = this.features.enableKds ? 'flex' : 'none';
    }

    // 3. Render feature chips lên banner
    if (featurePillsContainer) {
      featurePillsContainer.innerHTML = `
        <span class="feature-chip ${this.features.enableTakeaway ? 'active' : ''}">
          <i class="fa-solid fa-bag-shopping"></i> Mang đi
        </span>
        <span class="feature-chip ${this.features.enableDineIn ? 'active' : ''}">
          <i class="fa-solid fa-utensils"></i> Tại chỗ
        </span>
        <span class="feature-chip ${this.features.enableTable ? 'active' : ''}">
          <i class="fa-solid fa-chair"></i> Bàn
        </span>
        <span class="feature-chip ${this.features.enableKds ? 'active' : ''}">
          <i class="fa-solid fa-kitchen-set"></i> KDS
        </span>
        <span class="feature-chip ${this.features.enableQrPayment ? 'active' : ''}">
          <i class="fa-solid fa-qrcode"></i> VietQR
        </span>
      `;
    }

    this.notify('features_updated', this.features);
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
      btnSendKitchen.style.display = (type === 'DINE_IN' && this.features.enableKds) ? 'inline-flex' : 'none';
    }

    this.notify('order_type_changed', type);
  },

  setSelectedTable(table) {
    this.cart.selectedTable = table;
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
  },

  clearCart() {
    this.cart.items = [];
    this.cart.discountCash = 0;
    this.cart.discountPercent = 0;
    this.cart.note = '';
    this.notify('cart_updated', this.cart);
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
