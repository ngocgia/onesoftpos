// ThichGaPOS v1.0 - Kitchen Display System (KDS) Controller (Rule 26)

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
      // Only poll if currently in KDS view
      const kdsView = document.getElementById('viewKds');
      if (kdsView && kdsView.classList.contains('active-view')) {
        this.loadKdsOrders(true);
      }
    }, 8000);
  },

  speakAnnouncement(message) {
    if (!message || !('speechSynthesis' in window)) {
      if (message) window.api.showToast('Thiết bị không hỗ trợ đọc thông báo bằng loa', 'error');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    const vietnameseVoice = window.speechSynthesis.getVoices()
      .find(voice => String(voice.lang || '').toLowerCase().startsWith('vi'));
    if (vietnameseVoice) utterance.voice = vietnameseVoice;
    window.speechSynthesis.speak(utterance);
  },

  async loadKdsOrders(silent = false) {
    if (this.isLoading || this.updatingItems.size > 0) return;
    this.isLoading = true;
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
    } finally {
      this.isLoading = false;
    }
  },

  renderOrders() {
    const grid = document.getElementById('kdsOrdersGrid');
    if (!grid) return;
    const canCancel = ['STORE_MANAGER', 'CASHIER', 'KITCHEN'].includes(window.appState.user?.role);

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
                (${ord.order_type === 'DINE_IN' ? (ord.table_code || 'Bàn') : ({SHIP_DELIVERY:'Ship mang về',CUSTOMER_PICKUP:'Khách tới lấy',APP_DELIVERY:'Ship qua app'}[ord.fulfillment_type] || 'Mang đi')})
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
                  <div class="kds-item-actions">
                    <button type="button" class="btn-kds-action status-${item.status}" data-item-id="${item.id}" data-next="${nextStatus}">
                      ${actionBtnText}
                    </button>
                    ${canCancel && ['PENDING', 'PREPARING', 'READY'].includes(item.status) ? `
                      <button type="button" class="btn-kds-cancel" data-cancel-item-id="${item.id}" data-item-name="${item.product_name}">
                        <i class="fa-solid fa-ban"></i> Hủy
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
          if (result.announcement) this.speakAnnouncement(result.announcement);
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
