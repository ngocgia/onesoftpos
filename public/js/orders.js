// ThichGaPOS v1.0 - Orders History Controller (Rule 25, 24)

window.ordersModule = {
  orders: [],
  currentStatusFilter: '',
  esc(value='') { const node=document.createElement('div');node.textContent=String(value??'');return node.innerHTML; },
  isKitchenHistory() { return window.appState.user?.role === 'KITCHEN'; },

  init() {
    this.configureView();
    this.bindEvents();
    this.loadOrders();

    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadOrders();
      } else if (event === 'role_features_updated') {
        this.configureView();
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
      if (this.isKitchenHistory()) {
        const res = await window.api.get('/kds/history');
        this.orders = res.items || [];
        this.renderKitchenHistory();
        return;
      }
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

  configureView() {
    const header = document.querySelector('#viewOrders .header-info h2');
    const description = document.querySelector('#viewOrders .header-info p');
    const tabs = document.getElementById('orderStatusTabs');
    const navLabel = document.querySelector('#navItemOrders span');
    const thead = document.querySelector('#ordersTable thead');
    if (!this.isKitchenHistory()) {
      const isTakeaway = window.appState.isTakeawayOnlyStore?.();
      if (header) header.textContent = isTakeaway ? 'Lịch sử đơn Takeaway' : 'Lịch sử đơn hàng';
      if (description) description.textContent = isTakeaway
        ? 'Theo dõi đơn mang đi, thanh toán và in lại biên lai'
        : 'Theo dõi danh sách hóa đơn, thanh toán và in lại biên lai';
      if (tabs) tabs.style.display = '';
      if (navLabel) navLabel.textContent = 'Lịch sử';
      if (thead) thead.innerHTML = `<tr>
        <th>Mã đơn</th><th>Thời gian</th><th>Loại đơn</th><th>Bàn / Khách</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Thao tác</th>
      </tr>`;
      return;
    }
    if (header) header.textContent = 'Lịch sử món đã làm';
    if (description) description.textContent = 'Các món do chính bạn hoàn thành tại cửa hàng hiện tại';
    if (tabs) tabs.style.display = 'none';
    if (navLabel) navLabel.textContent = 'Lịch sử';
    if (thead) thead.innerHTML = `<tr>
      <th>Món đã làm</th><th>Số lượng</th><th>Mã đơn</th><th>Bàn / Khách</th><th>Khu vực</th><th>Hoàn thành lúc</th>
    </tr>`;
  },

  renderKitchenHistory() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    if (!this.orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px" class="text-muted">Bạn chưa hoàn thành món nào</td></tr>`;
      return;
    }
    tbody.innerHTML = this.orders.map(item => {
      const finishedAt = item.prepared_at
        ? new Date(item.prepared_at).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' })
        : '-';
      const destination = item.order_type === 'DINE_IN'
        ? (item.table_code || item.table_name || 'Tại bàn')
        : (item.customer_name || item.order_code || 'Mang đi');
      return `<tr>
        <td><strong>${this.esc(item.product_name)}</strong>${item.variant_name ? `<br><small>${this.esc(item.variant_name)}</small>` : ''}${item.note ? `<br><small class="text-muted">${this.esc(item.note)}</small>` : ''}</td>
        <td><strong>${Number(item.quantity) || 1}</strong></td>
        <td><strong>#${this.esc(item.order_code)}</strong></td>
        <td>${this.esc(destination)}</td>
        <td><span class="badge-pill" style="background:var(--primary-light);color:var(--primary-hover)">${item.kitchen_type === 'BAR' ? 'Pha chế' : 'Bếp'}</span></td>
        <td>${finishedAt}</td>
      </tr>`;
    }).join('');
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
      const fulfillmentLabels = { SHIP_DELIVERY:'Ship mang về', CUSTOMER_PICKUP:'Khách tới lấy', APP_DELIVERY:'Ship qua app' };
      const typeText = o.order_type === 'DINE_IN' ? 'Tại chỗ' : (fulfillmentLabels[o.fulfillment_type] || 'Mang đi');
      const scheduledText = o.scheduled_at ? new Date(o.scheduled_at).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) : '';
      let locationText = o.order_type === 'DINE_IN' ? (o.table_code || 'Bàn') : (o.customer_name || 'Khách lẻ');
      if (o.fulfillment_type === 'SHIP_DELIVERY') locationText = `<strong>${this.esc(o.customer_name)}</strong><br><small>${this.esc(o.customer_phone)} · ${this.esc(o.delivery_address)}${scheduledText?` · Hẹn ${scheduledText}`:''}</small>`;
      if (o.fulfillment_type === 'CUSTOMER_PICKUP') locationText = `<strong>${this.esc(o.customer_name)}</strong><br><small>${this.esc(o.customer_phone)}${scheduledText?` · Đến lấy ${scheduledText}`:''}</small>`;
      if (o.fulfillment_type === 'APP_DELIVERY') locationText = scheduledText ? `App đến lấy ${scheduledText}` : 'Ship qua app';
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
      } else if (o.order_status === 'READY') {
        statusBadge = `<span class="badge-pill" style="background: #dbeafe; color: #1d4ed8;">Sẵn sàng thanh toán</span>`;
      }

      if (o.workflow_step?.name) {
        statusBadge = `<span class="badge-pill" style="background: var(--primary-light); color: var(--primary-hover);">${o.workflow_step.name}</span>`;
      }
      const canConfirm = !!o.can_advance;
      const role = window.appState.user?.role;
      const hasPaymentAccess = role === 'SUPER_ADMIN' || (role === 'CASHIER' && window.appState.roleFeatures.PAYMENT !== false);
      const canPay = !isPaid && o.order_status !== 'CANCELLED' && o.workflow_step?.type === 'PAYMENT' &&
        (role === 'SUPER_ADMIN' || (o.workflow_step.roles || []).includes(role)) && window.appState.roleFeatures.PAYMENT !== false;
      const canRepay = isPaid && o.order_status !== 'CANCELLED' && hasPaymentAccess;
      const paymentAction = canPay || canRepay ? `
        <button type="button" class="btn-sm btn-primary btn-pay-now ${canRepay ? 'is-repayment' : ''}" data-id="${o.id}" data-repayment="${canRepay}" title="${canRepay ? 'Thay thế giao dịch thanh toán hiện tại' : 'Thanh toán đơn chưa thu tiền'}">
          <i class="fa-solid fa-credit-card"></i>
          <span>${canRepay ? 'Thanh toán lại' : 'Thanh toán'}</span>
        </button>
      ` : '';

      return `
        <tr class="order-history-row">
          <td class="order-code-cell"><strong>#${this.esc(o.order_code)}</strong></td>
          <td class="order-time-cell"><i class="fa-regular fa-clock"></i> ${timeStr}</td>
          <td class="order-type-cell"><span class="order-type-chip">${typeText}</span></td>
          <td class="order-customer-cell">${locationText}</td>
          <td class="order-total-cell"><span class="order-cell-label">Tổng tiền</span><strong class="text-primary">${window.api.formatMoney(o.total_amount)}</strong></td>
          <td class="order-payment-cell">
            <span class="badge-pill" style="${isPaid ? 'background: var(--success-light); color: #065f46;' : 'background: var(--danger-light); color: #991b1b;'}">
              ${isPaid ? 'Đã thanh toán' : 'Chưa thu tiền'}
            </span>
          </td>
          <td class="order-status-cell">${statusBadge}</td>
          <td class="order-actions-cell">
            <div class="order-row-actions">
              <button type="button" class="btn-sm btn-secondary btn-reprint" data-id="${o.id}" title="In lại bill">
                <i class="fa-solid fa-print"></i>
                <span class="action-label">In biên lai</span>
              </button>
              ${canConfirm ? `
                <button type="button" class="btn-sm btn-primary btn-confirm-order" data-id="${o.id}">
                  Hoàn tất bước
                </button>
              ` : ''}
              ${paymentAction}
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
          const isRepayment = btn.getAttribute('data-repayment') === 'true';
          window.checkoutModule.openCheckoutModal(order, { repayment: isRepayment });
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
