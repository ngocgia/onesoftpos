// ThichGaPOS v1.0 - Orders History Controller (Rule 25, 24)

window.ordersModule = {
  orders: [],
  currentStatusFilter: '',

  init() {
    this.bindEvents();
    this.loadOrders();

    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadOrders();
      }
    });
  },

  bindEvents() {
    const tabs = document.querySelectorAll('#orderStatusTabs .status-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentStatusFilter = tab.getAttribute('data-status');
        this.loadOrders();
      });
    });
  },

  async loadOrders() {
    try {
      let url = '/orders';
      if (this.currentStatusFilter) {
        url += `?status=${this.currentStatusFilter}`;
      }

      const res = await window.api.get(url);
      this.orders = res.orders || [];
      this.renderOrdersTable();
    } catch (err) {
      console.error('loadOrders error:', err);
    }
  },

  renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 24px;" class="text-muted">
            Chưa có đơn hàng nào
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.orders.map(o => {
      const isPaid = o.payment_status === 'PAID';
      const typeText = o.order_type === 'DINE_IN' ? 'Tại chỗ' : 'Mang đi';
      const locationText = o.order_type === 'DINE_IN' ? (o.table_code || 'Bàn') : (o.customer_name || 'Khách lẻ');
      const timeStr = new Date(o.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      let statusBadge = `<span class="badge-pill" style="background: var(--bg-muted); color: var(--text-muted);">${o.order_status}</span>`;
      if (o.order_status === 'COMPLETED') {
        statusBadge = `<span class="badge-pill" style="background: var(--success-light); color: #065f46;">Hoàn tất</span>`;
      } else if (o.order_status === 'CONFIRMED' || o.order_status === 'PREPARING') {
        statusBadge = `<span class="badge-pill" style="background: var(--primary-light); color: var(--primary-hover);">Đang phục vụ</span>`;
      } else if (o.order_status === 'CANCELLED') {
        statusBadge = `<span class="badge-pill" style="background: var(--danger-light); color: #991b1b;">Đã hủy</span>`;
      } else if (o.order_status === 'PENDING_CONFIRMATION') {
        statusBadge = `<span class="badge-pill" style="background: #fef3c7; color: #92400e;">Chờ thu ngân xác nhận</span>`;
      }

      if (o.workflow_step?.name) {
        statusBadge = `<span class="badge-pill" style="background: var(--primary-light); color: var(--primary-hover);">${o.workflow_step.name}</span>`;
      }
      const canConfirm = !!o.can_advance;
      const canPay = !isPaid && o.workflow_step?.type === 'PAYMENT' &&
        (window.appState.user?.role === 'SUPER_ADMIN' || (o.workflow_step.roles || []).includes(window.appState.user?.role)) && window.appState.roleFeatures.PAYMENT;

      return `
        <tr>
          <td><strong>#${o.order_code}</strong></td>
          <td>${timeStr}</td>
          <td>${typeText}</td>
          <td>${locationText}</td>
          <td><strong class="text-primary">${window.api.formatMoney(o.total_amount)}</strong></td>
          <td>
            <span class="badge-pill" style="${isPaid ? 'background: var(--success-light); color: #065f46;' : 'background: var(--danger-light); color: #991b1b;'}">
              ${isPaid ? 'Đã thanh toán' : 'Chưa thu tiền'}
            </span>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn-sm btn-secondary btn-reprint" data-id="${o.id}" title="In lại bill">
                <i class="fa-solid fa-print"></i>
              </button>
              ${canConfirm ? `
                <button type="button" class="btn-sm btn-primary btn-confirm-order" data-id="${o.id}">
                  Hoàn tất bước
                </button>
              ` : ''}
              ${canPay ? `
                <button type="button" class="btn-sm btn-primary btn-pay-now" data-id="${o.id}">
                  Thu tiền
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach action events
    tbody.querySelectorAll('.btn-reprint').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = parseInt(btn.getAttribute('data-id'), 10);
        const order = this.orders.find(o => o.id === orderId);
        if (order && window.invoiceModule) {
          window.invoiceModule.showReceipt(order);
        }
      });
    });

    tbody.querySelectorAll('.btn-pay-now').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = parseInt(btn.getAttribute('data-id'), 10);
        const order = this.orders.find(o => o.id === orderId);
        if (order && window.checkoutModule) {
          window.checkoutModule.openCheckoutModal(order);
        }
      });
    });

    tbody.querySelectorAll('.btn-confirm-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = parseInt(btn.getAttribute('data-id'), 10);
        btn.disabled = true;
        try {
          const result = await window.api.post(`/orders/${orderId}/advance`, {});
          window.api.showToast(result.message || 'Đã chuyển sang bước tiếp theo', 'success');
          await this.loadOrders();
        } catch (err) {
          btn.disabled = false;
          window.api.showToast('Không thể xác nhận đơn: ' + err.message, 'error');
        }
      });
    });
  }
};
