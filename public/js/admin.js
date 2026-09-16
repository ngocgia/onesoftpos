// ThichGaPOS v1.0 - Admin & Feature Flags Controller (Rule 7, 40, 46, 35)

window.adminModule = {
  storeTypes: [],
  stores: [],

  init() {
    this.bindEvents();
    this.loadReports();
    this.loadStoreTypesConfig();
    this.loadAdminStores();
    this.loadAdminProducts();

    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadReports();
        this.loadAdminProducts();
      }
    });
  },

  bindEvents() {
    // Admin Subnav tabs
    const navTabs = document.querySelectorAll('.admin-nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetId = tab.getAttribute('data-target');
        document.querySelectorAll('.admin-subview').forEach(view => {
          view.classList.toggle('active', view.id === targetId);
        });

        if (targetId === 'adminReports') this.loadReports();
        if (targetId === 'adminStoreTypes') this.loadStoreTypesConfig();
        if (targetId === 'adminStores') this.loadAdminStores();
        if (targetId === 'adminProducts') this.loadAdminProducts();
      });
    });
  },

  // 1. Reports Dashboard (Rule 35)
  async loadReports() {
    try {
      const res = await window.api.get('/reports/summary?range=today');
      
      const revEl = document.getElementById('repRevenue');
      const orderCountEl = document.getElementById('repOrderCount');
      const avgOrderEl = document.getElementById('repAvgOrder');
      const topList = document.getElementById('topProductsList');
      const payList = document.getElementById('paymentBreakdownList');

      if (revEl) revEl.textContent = window.api.formatMoney(res.revenue);
      if (orderCountEl) orderCountEl.textContent = `${res.orderCount} đơn`;
      if (avgOrderEl) avgOrderEl.textContent = window.api.formatMoney(res.avgOrderValue);

      if (topList) {
        if (!res.topProducts || res.topProducts.length === 0) {
          topList.innerHTML = '<p class="text-muted">Chưa có dữ liệu bán hàng hôm nay</p>';
        } else {
          topList.innerHTML = res.topProducts.map(p => `
            <div class="top-prod-row">
              <span><strong>${p.product_name}</strong> (${p.total_qty} phần)</span>
              <strong class="text-primary">${window.api.formatMoney(p.total_revenue)}</strong>
            </div>
          `).join('');
        }
      }

      if (payList) {
        const bd = res.paymentBreakdown || {};
        payList.innerHTML = `
          <div class="pay-row"><span>Tiền mặt (CASH)</span><strong>${window.api.formatMoney(bd.CASH || 0)}</strong></div>
          <div class="pay-row"><span>VietQR (Napas 247)</span><strong>${window.api.formatMoney(bd.QR || 0)}</strong></div>
          <div class="pay-row"><span>Chuyển khoản</span><strong>${window.api.formatMoney(bd.BANK_TRANSFER || 0)}</strong></div>
          <div class="pay-row"><span>Thẻ ngân hàng (POS)</span><strong>${window.api.formatMoney(bd.CARD || 0)}</strong></div>
        `;
      }
    } catch (err) {
      console.error('loadReports error:', err);
    }
  },

  // 2. Store Types & Feature Flags Manager (Rule 7, 40, 46)
  async loadStoreTypesConfig() {
    const container = document.getElementById('storeTypesConfigContainer');
    if (!container) return;

    try {
      const res = await window.api.get('/store-types');
      this.storeTypes = res.storeTypes || [];

      const featureLabels = {
        'SALE': 'Bán hàng (POS)',
        'TAKEAWAY': 'Bán mang đi',
        'DINE_IN': 'Bán tại chỗ',
        'TABLE': 'Quản lý bàn & phòng',
        'KDS': 'Màn hình bếp (KDS)',
        'INVOICE': 'In hóa đơn nhiệt',
        'QR_PAYMENT': 'Thanh toán VietQR',
        'INVENTORY': 'Quản lý kho'
      };

      container.innerHTML = this.storeTypes.map(st => `
        <div class="store-type-card" data-type-id="${st.id}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="font-size: 15px; font-weight: 800;">[${st.code}] ${st.name}</h4>
              <p class="text-muted" style="font-size: 12px;">${st.description || ''}</p>
            </div>
            <span class="badge-pill" style="background: var(--primary-light); color: var(--primary-hover);">
              Rule 40 & 46
            </span>
          </div>

          <div class="features-toggle-grid">
            ${(st.features || []).map(f => `
              <div class="feature-toggle-item">
                <span>${featureLabels[f.feature_code] || f.feature_code}</span>
                <label class="switch-input">
                  <input type="checkbox" class="feature-switch" 
                    data-type-id="${st.id}" 
                    data-feature="${f.feature_code}" 
                    ${f.enabled ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

      // Attach switch event listener
      container.querySelectorAll('.feature-switch').forEach(switchInput => {
        switchInput.addEventListener('change', async (e) => {
          const typeId = switchInput.getAttribute('data-type-id');
          const featureCode = switchInput.getAttribute('data-feature');
          const enabled = e.target.checked;

          try {
            await window.api.put(`/store-types/${typeId}/features`, {
              feature_code: featureCode,
              enabled
            });

            window.api.showToast(`Đã ${enabled ? 'bật' : 'tắt'} tính năng [${featureCode}]`, 'success');

            // Refresh current store features to update UI immediately
            if (window.appState.currentStore && window.appState.currentStore.store_type_id === parseInt(typeId, 10)) {
              await window.appNavigation.reloadCurrentStoreFeatures();
            }
          } catch (err) {
            e.target.checked = !enabled; // revert
            window.api.showToast('Lỗi cập nhật tính năng: ' + err.message, 'error');
          }
        });
      });
    } catch (err) {
      console.error('loadStoreTypesConfig error:', err);
    }
  },

  // 3. Stores List (Rule 5)
  async loadAdminStores() {
    const grid = document.getElementById('adminStoresGrid');
    if (!grid) return;

    try {
      const res = await window.api.get('/stores');
      this.stores = res.stores || [];

      grid.innerHTML = this.stores.map(s => `
        <div class="store-type-card" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="font-size: 15px; font-weight: 800;">${s.name}</h4>
              <p class="text-muted" style="font-size: 12px;"><i class="fa-solid fa-location-dot"></i> ${s.address || 'Chưa cập nhật địa chỉ'}</p>
              <p class="text-muted" style="font-size: 11px;"><i class="fa-solid fa-phone"></i> ${s.phone || 'N/A'}</p>
            </div>
            <span class="badge-pill" style="background: var(--success-light); color: #065f46;">
              ${s.store_type_name || 'Cửa hàng'}
            </span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('loadAdminStores error:', err);
    }
  },

  // 4. Products List
  async loadAdminProducts() {
    const tbody = document.getElementById('adminProductsTableBody');
    if (!tbody) return;

    try {
      const res = await window.api.get('/products');
      const products = res.products || [];

      tbody.innerHTML = products.map(p => `
        <tr>
          <td><strong>${p.code}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${p.image_url || '🍗'}</span>
              <span>${p.name}</span>
            </div>
          </td>
          <td>${p.category_name || '-'}</td>
          <td><strong class="text-primary">${window.api.formatMoney(p.price)}</strong></td>
          <td>${p.kitchen_type === 'BAR' ? 'Quầy Pha Chế' : 'Bếp Đồ Ăn'}</td>
          <td>
            <span class="badge-pill" style="background: var(--success-light); color: #065f46;">
              Đang bán
            </span>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('loadAdminProducts error:', err);
    }
  }
};
