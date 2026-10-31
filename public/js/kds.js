// OnesoftPOS v1.0 - Kitchen Display System (KDS) Controller (Rule 26)

window.kdsModule = {
  orders: [],
  currentFilter: 'ALL',
  pollInterval: null,
  isLoading: false,
  updatingItems: new Set(),

  init() {
    this.bindEvents();
    this.loadKdsOrders();
    this.startPolling();

    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadKdsOrders();
      }
    });
  },

  bindEvents() {
    const tabs = document.querySelectorAll('.kds-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.getAttribute('data-filter');
        this.loadKdsOrders();
      });
    });
  },

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Poll every 8 seconds for new kitchen tickets
    this.pollInterval = setInterval(() => {
      // Keep kitchen alerts working while staff use another view in the foreground.
      if (window.appState.user && window.appState.roleFeatures.KDS !== false && document.visibilityState !== 'hidden') {
        this.loadKdsOrders(true);
      }
    }, 8000);
  },

  speakAnnouncement(message) {
    window.audioModule?.speak(message, { kind: 'kitchen' });
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  },

  async loadKdsOrders(silent = false) {
    if (this.isLoading || this.updatingItems.size > 0) return;
    this.isLoading = true;
    const storeId = window.api.getCurrentStoreId();
    const filter = this.currentFilter;
    try {
      let url = '/kds/orders';
      if (filter !== 'ALL') {
        url += `?kitchen_type=${filter}`;
      }

      const res = await window.api.get(url);
      if (storeId !== window.api.getCurrentStoreId() || filter !== this.currentFilter) return;
      this.orders = res.orders || [];
      window.audioModule?.observeItems('new', this.orders, filter);
      this.renderOrders();
    } catch (err) {
      if (!silent) console.error('loadKdsOrders error:', err);
    } finally {
      this.isLoading = false;
    }
  },

  renderOrders() {
    const grid = document.getElementById('kdsOrdersGrid');
    if (!grid) return;
    const pendingOrders = this.orders.map(order => ({
      ...order,
      items: (order.items || []).filter(item => ['PENDING', 'PREPARING'].includes(item.status))
    })).filter(order => order.items.length > 0);
    const role = window.appState.user?.role;
    const canCancel = ['STORE_MANAGER', 'CASHIER'].includes(role)
      || (role === 'KITCHEN' && window.appState.storeSettings?.allow_cancel_item !== false);

    if (pendingOrders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center; width: 100%;">
          <i class="fa-solid fa-mug-hot" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p class="text-muted">Bếp đang trống. Chưa có đơn hàng nào cần chuẩn bị!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = pendingOrders.map(ord => {
      const elapsedMinutes = Math.floor((new Date() - new Date(ord.created_at)) / 60000);
      const isUrgent = elapsedMinutes >= 15;

      return `
        <div class="kds-card">
          <div class="kds-card-header">
            <div>
              <span class="kds-order-title">${this.escapeHtml(ord.order_code)}</span>
              <span style="font-size: 11px; margin-left: 6px; color: var(--text-muted);">
                (${ord.order_type === 'DINE_IN' ? this.escapeHtml(ord.table_code || 'Bàn') : ({SHIP_DELIVERY:'Ship mang về',CUSTOMER_PICKUP:'Khách tới lấy',APP_DELIVERY:'Ship qua app'}[ord.fulfillment_type] || 'Mang đi')})
              </span>
            </div>
            <span class="kds-timer" style="${isUrgent ? 'color: var(--danger); font-weight: 800;' : ''}">
              <i class="fa-regular fa-clock"></i> ${elapsedMinutes} phút trước
            </span>
          </div>
          <div class="kds-card-items">
            ${(ord.items || []).map(item => {
              return `
                <div class="kds-item-row">
                  <div class="kds-item-left">
                    <span class="kds-qty-circle">${item.quantity}</span>
                    <div>
                      <strong style="font-size: 13px;">${this.escapeHtml(item.product_name)}</strong>
                      ${item.variant_name ? `<span style="font-size: 11px; color: var(--primary);"> (${this.escapeHtml(item.variant_name)})</span>` : ''}
                      ${(item.options || []).map(o => `<div style="font-size: 10px; color: var(--text-muted);">+ ${this.escapeHtml(o.option_name)}</div>`).join('')}
                      ${item.note ? `<div style="font-size: 11px; color: var(--accent);"><i class="fa-regular fa-note-sticky"></i> ${this.escapeHtml(item.note)}</div>` : ''}
                    </div>
                  </div>
                  <div class="kds-item-actions">
                    <button type="button" class="btn-kds-action" data-item-id="${item.id}" data-next="READY">
                      Xong món
                    </button>
                    ${canCancel && ['PENDING', 'PREPARING', 'READY'].includes(item.status) ? `
                      <button type="button" class="btn-kds-cancel" data-cancel-item-id="${item.id}" data-item-name="${this.escapeHtml(item.product_name)}" title="Hủy món" aria-label="Hủy món">
                        <i class="fa-solid fa-ban" aria-hidden="true"></i>
                      </button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to item status action buttons
    grid.querySelectorAll('.btn-kds-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-item-id');
        const nextStatus = btn.getAttribute('data-next');
        if (this.updatingItems.has(itemId)) return;
        this.updatingItems.add(itemId);
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Đang cập nhật...';
        try {
          const result = await window.api.put(`/kds/items/${itemId}/status`, { status: nextStatus });
          const order = this.orders.find(current => (current.items || []).some(item => String(item.id) === String(itemId)));
          const target = order?.items?.find(item => String(item.id) === String(itemId));
          if (target) target.status = result.item?.status || nextStatus;
          if (order && result.order?.order_status) order.order_status = result.order.order_status;
          this.renderOrders();
          this.updatingItems.delete(itemId);
          await this.loadKdsOrders(true);
          if (result.announcement && (!window.audioModule || window.audioModule.track('done', itemId))) this.speakAnnouncement(result.announcement);
          window.api.showToast('Đã cập nhật trạng thái món', 'success');
        } catch (err) {
          window.api.showToast('Lỗi cập nhật: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = oldText;
        } finally {
          this.updatingItems.delete(itemId);
        }
      });
    });

    grid.querySelectorAll('.btn-kds-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-cancel-item-id');
        const itemName = btn.getAttribute('data-item-name') || 'món này';
        if (this.updatingItems.has(itemId) || !confirm(`Xác nhận hủy ${itemName}? Thao tác này không thể hoàn tác.`)) return;
        this.updatingItems.add(itemId);
        btn.disabled = true;
        try {
          await window.api.put(`/order-items/${itemId}/cancel`, {});
          window.api.showToast('Đã hủy món và cập nhật tổng tiền đơn', 'success');
          this.updatingItems.delete(itemId);
          await this.loadKdsOrders(true);
        } catch (err) {
          btn.disabled = false;
          window.api.showToast('Không thể hủy món: ' + err.message, 'error');
        } finally {
          this.updatingItems.delete(itemId);
        }
      });
    });
  }
};
