// ThichGaPOS v1.0 - Kitchen Display System (KDS) Controller (Rule 26)

window.kdsModule = {
  orders: [],
  currentFilter: 'ALL',
  pollInterval: null,

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
      // Only poll if currently in KDS view
      const kdsView = document.getElementById('viewKds');
      if (kdsView && kdsView.classList.contains('active-view')) {
        this.loadKdsOrders(true);
      }
    }, 8000);
  },

  async loadKdsOrders(silent = false) {
    try {
      let url = '/kds/orders';
      if (this.currentFilter !== 'ALL') {
        url += `?kitchen_type=${this.currentFilter}`;
      }

      const res = await window.api.get(url);
      this.orders = res.orders || [];
      this.renderOrders();
    } catch (err) {
      if (!silent) console.error('loadKdsOrders error:', err);
    }
  },

  renderOrders() {
    const grid = document.getElementById('kdsOrdersGrid');
    if (!grid) return;

    if (this.orders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center; width: 100%;">
          <i class="fa-solid fa-mug-hot" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p class="text-muted">Bếp đang trống. Chưa có đơn hàng nào cần chuẩn bị!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.orders.map(ord => {
      const elapsedMinutes = Math.floor((new Date() - new Date(ord.created_at)) / 60000);
      const isUrgent = elapsedMinutes >= 15;

      return `
        <div class="kds-card">
          <div class="kds-card-header">
            <div>
              <span class="kds-order-title">${ord.order_code}</span>
              <span style="font-size: 11px; margin-left: 6px; color: var(--text-muted);">
                (${ord.order_type === 'DINE_IN' ? (ord.table_code || 'Bàn') : 'Mang đi'})
              </span>
            </div>
            <span class="kds-timer" style="${isUrgent ? 'color: var(--danger); font-weight: 800;' : ''}">
              <i class="fa-regular fa-clock"></i> ${elapsedMinutes} phút trước
            </span>
          </div>
          <div class="kds-card-items">
            ${(ord.items || []).map(item => {
              let actionBtnText = 'Bắt đầu làm';
              let nextStatus = 'PREPARING';

              if (item.status === 'PREPARING') {
                actionBtnText = 'Xong món';
                nextStatus = 'READY';
              } else if (item.status === 'READY') {
                actionBtnText = 'Đã trả món';
                nextStatus = 'SERVED';
              }

              return `
                <div class="kds-item-row">
                  <div class="kds-item-left">
                    <span class="kds-qty-circle">${item.quantity}</span>
                    <div>
                      <strong style="font-size: 13px;">${item.product_name}</strong>
                      ${item.variant_name ? `<span style="font-size: 11px; color: var(--primary);"> (${item.variant_name})</span>` : ''}
                      ${(item.options || []).map(o => `<div style="font-size: 10px; color: var(--text-muted);">+ ${o.option_name}</div>`).join('')}
                      ${item.note ? `<div style="font-size: 11px; color: var(--accent);"><i class="fa-regular fa-note-sticky"></i> ${item.note}</div>` : ''}
                    </div>
                  </div>
                  <button type="button" class="btn-kds-action status-${item.status}" data-item-id="${item.id}" data-next="${nextStatus}">
                    ${actionBtnText}
                  </button>
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
        try {
          await window.api.put(`/kds/items/${itemId}/status`, { status: nextStatus });
          await this.loadKdsOrders(true);
          window.api.showToast('Đã cập nhật trạng thái món', 'success');
        } catch (err) {
          window.api.showToast('Lỗi cập nhật: ' + err.message, 'error');
        }
      });
    });
  }
};
