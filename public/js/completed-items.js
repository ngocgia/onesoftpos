// Completed kitchen items visible to the front-of-house team until payment.
window.completedItemsModule = {
  orders: [],
  initialized: false,
  isLoading: false,
  pollInterval: null,

  canView() {
    return window.appState.roleFeatures.COMPLETED_ITEMS !== false;
  },

  init() {
    if (!this.initialized) {
      this.initialized = true;
      document.getElementById('btnRefreshCompletedItems')?.addEventListener('click', () => this.loadCompletedItems());
      window.appState.subscribe(event => {
        if (event === 'store_changed' && this.canView()) this.loadCompletedItems(true);
      });
      this.startPolling();
    }
    this.configureAccess();
    if (this.canView()) this.loadCompletedItems(true);
  },

  configureAccess() {
    const allowed = this.canView();
    const navItem = document.getElementById('navItemCompletedItems');
    if (navItem) navItem.style.display = allowed ? 'flex' : 'none';
    if (!allowed && window.appNavigation?.currentView === 'viewCompletedItems') {
      const fallback = [
        ['TABLES', 'viewTables'], ['POS', 'viewPos'], ['KDS', 'viewKds'], ['HISTORY', 'viewOrders']
      ].find(([feature]) => window.appState.roleFeatures[feature] !== false)?.[1];
      if (fallback) window.appNavigation.switchView(fallback);
    }
  },

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      const view = document.getElementById('viewCompletedItems');
      if (this.canView() && view?.classList.contains('active-view')) this.loadCompletedItems(true);
    }, 8000);
  },

  async loadCompletedItems(silent = false) {
    if (!this.canView() || this.isLoading) return;
    this.isLoading = true;
    try {
      const result = await window.api.get('/kds/completed-items');
      this.orders = result.orders || [];
      this.render();
    } catch (error) {
      if (!silent) window.api.showToast(`Không thể tải món đã xong: ${error.message}`, 'error');
    } finally {
      this.isLoading = false;
    }
  },

  escape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  },

  formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  },

  orderPlace(order) {
    if (order.order_type === 'DINE_IN') return order.table_code || order.table_name || 'Chưa xác định bàn';
    return order.customer_name ? `Khách: ${order.customer_name}` : 'Đơn mang đi';
  },

  render() {
    const grid = document.getElementById('completedItemsGrid');
    const summary = document.getElementById('completedItemsSummary');
    if (!grid || !summary) return;

    const itemCount = this.orders.reduce((total, order) => total + (order.items || []).length, 0);
    summary.innerHTML = `
      <span class="completed-summary-chip"><strong>${this.orders.length}</strong> đơn đang chờ</span>
      <span class="completed-summary-chip"><strong>${itemCount}</strong> món đã xong</span>
    `;

    if (!this.orders.length) {
      grid.innerHTML = `
        <div class="empty-state" style="padding:48px 20px;text-align:center;grid-column:1/-1">
          <i class="fa-solid fa-circle-check" style="font-size:42px;color:var(--success);margin-bottom:12px"></i>
          <p><strong>Không còn món nào đang chờ</strong></p>
          <p class="text-muted">Món mới bếp làm xong sẽ tự động xuất hiện tại đây.</p>
        </div>`;
      return;
    }

    grid.innerHTML = this.orders.map(order => `
      <article class="completed-order-card">
        <header class="completed-order-header">
          <div>
            <strong>${this.escape(order.order_code)}</strong>
            <span class="completed-order-place"><i class="fa-solid ${order.order_type === 'DINE_IN' ? 'fa-chair' : 'fa-bag-shopping'}"></i> ${this.escape(this.orderPlace(order))}</span>
          </div>
          <span class="completed-order-time"><i class="fa-regular fa-clock"></i> ${this.escape(this.formatTime(order.latest_prepared_at))}</span>
        </header>
        <div class="completed-order-items">
          ${(order.items || []).map(item => {
            const details = [item.variant_name, ...(item.options || []).map(option => option.option_name)].filter(Boolean);
            return `
              <div class="completed-item-row">
                <span class="kds-qty-circle">${this.escape(item.quantity)}</span>
                <div class="completed-item-details">
                  <strong>${this.escape(item.product_name)}</strong>
                  ${details.length ? `<small>${details.map(value => this.escape(value)).join(' · ')}</small>` : ''}
                  ${item.note ? `<small><i class="fa-regular fa-note-sticky"></i> ${this.escape(item.note)}</small>` : ''}
                </div>
                <span class="completed-status-badge">Đã xong</span>
              </div>`;
          }).join('')}
        </div>
      </article>
    `).join('');
  }
};
