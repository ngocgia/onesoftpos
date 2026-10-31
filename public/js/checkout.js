// OnesoftPOS v1.0 - Checkout & Payment Controller (Rule 27, 28)

window.checkoutModule = {
  currentOrder: null,
  selectedMethod: 'CASH',
  totalAmount: 0,
  cashReceived: 0,
  openedFromExistingOrder: false,
  isRepayment: false,
  isProcessing: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Close modal
    const btnClose = document.getElementById('btnCloseCheckoutModal');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        document.getElementById('checkoutModal').style.display = 'none';
      });
    }

    // Payment method selector
    const methodBtns = document.querySelectorAll('.pay-method-btn');
    methodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        methodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMethod = btn.getAttribute('data-method');
        this.switchPaymentPanel(this.selectedMethod);
      });
    });

    // Cash received input
    const cashInput = document.getElementById('cashReceivedInput');
    if (cashInput) {
      cashInput.addEventListener('input', (e) => {
        this.cashReceived = parseFloat(e.target.value) || 0;
        this.calculateChange();
      });
    }

    // Quick cash denomination tags
    const cashTags = document.querySelectorAll('.cash-tag');
    cashTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const val = tag.getAttribute('data-val');
        if (val === 'exact') {
          this.cashReceived = this.totalAmount;
        } else {
          this.cashReceived = parseFloat(val);
        }
        if (cashInput) cashInput.value = this.cashReceived;
        this.calculateChange();
      });
    });

    // Confirm complete payment button
    const btnConfirm = document.getElementById('btnConfirmCompletePayment');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this.executePayment());
    }
  },

  async openCheckoutModal(existingOrder = null, options = {}) {
    const isRepayment = !!options.repayment;
    if (existingOrder?.payment_status === 'PAID' && !isRepayment) {
      window.api.showToast('Đơn hàng này đã được thanh toán', 'info');
      return;
    }
    if (existingOrder?.order_status === 'CANCELLED') {
      window.api.showToast('Không thể thanh toán đơn hàng đã hủy', 'error');
      return;
    }
    // Reuse the draft order already created for this cart (e.g. retrying a
    // failed payment) so one cart never spawns more than one order before it
    // is paid. Only drop the reference when the cart has changed since the
    // order was created.
    if (existingOrder) {
      this.currentOrder = existingOrder;
    } else if (this.currentOrder && this.currentOrderCartSignature !== this.getCartSignature()) {
      this.currentOrder = null;
    }
    this.openedFromExistingOrder = !!existingOrder;
    this.isRepayment = isRepayment;
    this.selectedMethod = 'CASH';

    if (existingOrder) {
      this.totalAmount = parseFloat(existingOrder.total_amount);
    } else {
      this.totalAmount = window.appState.getCartGrandTotal();
    }

    this.cashReceived = this.totalAmount;

    const modal = document.getElementById('checkoutModal');
    const orderCodeEl = document.getElementById('checkoutOrderCode');
    const totalPayableEl = document.getElementById('checkoutTotalPayable');
    const cashInput = document.getElementById('cashReceivedInput');
    const transactionCodeInput = document.getElementById('transactionCodeInput');
    const modalTitle = modal?.querySelector('.modal-title-box h3');
    const confirmButton = document.getElementById('btnConfirmCompletePayment');

    if (orderCodeEl) {
      orderCodeEl.textContent = existingOrder ? existingOrder.order_code : 'Đơn mới';
    }
    if (totalPayableEl) {
      totalPayableEl.textContent = window.api.formatMoney(this.totalAmount);
    }
    if (cashInput) {
      cashInput.value = this.totalAmount;
    }
    if (transactionCodeInput) transactionCodeInput.value = '';
    if (modalTitle) modalTitle.textContent = isRepayment ? 'Thanh toán lại' : 'Thanh toán đơn hàng';
    if (confirmButton) confirmButton.innerHTML = isRepayment
      ? '<i class="fa-solid fa-rotate"></i> XÁC NHẬN THANH TOÁN LẠI'
      : '<i class="fa-solid fa-check"></i> XÁC NHẬN ĐÃ THANH TOÁN';

    this.calculateChange();
    this.switchPaymentPanel('CASH');

    if (modal) modal.style.display = 'flex';
  },

  switchPaymentPanel(method) {
    const payPanelCash = document.getElementById('payPanelCash');
    const payPanelQr = document.getElementById('payPanelQr');
    const payPanelCard = document.getElementById('payPanelCard');

    if (payPanelCash) payPanelCash.style.display = method === 'CASH' ? 'block' : 'none';
    if (payPanelQr) payPanelQr.style.display = method === 'QR' ? 'block' : 'none';
    if (payPanelCard) payPanelCard.style.display = (method === 'CARD' || method === 'BANK_TRANSFER') ? 'block' : 'none';

    if (method === 'QR') {
      this.loadDynamicVietQR();
    }
  },

  calculateChange() {
    const change = Math.max(0, this.cashReceived - this.totalAmount);
    const changeEl = document.getElementById('cashChangeAmount');
    if (changeEl) {
      changeEl.textContent = window.api.formatMoney(change);
    }
  },

  // Snapshot of every cart field that feeds the POST /orders payload. Used to
  // detect whether the draft order (currentOrder) still matches the cart.
  getCartSignature() {
    const cart = window.appState.cart;
    return JSON.stringify({
      orderType: cart.orderType,
      tableId: cart.selectedTable?.id || null,
      existingOrderId: cart.existingOrderId || null,
      items: cart.items,
      discountCash: cart.discountCash,
      discountPercent: cart.discountPercent,
      note: cart.note,
      fulfillmentType: cart.fulfillmentType,
      customerName: cart.customerName,
      customerPhone: cart.customerPhone,
      deliveryAddress: cart.deliveryAddress,
      scheduledAt: cart.scheduledAt
    });
  },

  async loadDynamicVietQR() {
    const qrImg = document.getElementById('vietQrImg');
    const qrLoading = document.getElementById('vietQrLoading');
    const qrBankName = document.getElementById('qrBankName');
    const qrAccountNo = document.getElementById('qrAccountNo');
    const qrAccountHolder = document.getElementById('qrAccountHolder');
    const qrMemo = document.getElementById('qrMemo');

    if (qrLoading) qrLoading.style.display = 'block';
    if (qrImg) qrImg.style.display = 'none';

    try {
      // Preview only. This must never create a real order: closing the modal
      // without paying would leave an orphan UNPAID order behind. The order is
      // created in executePayment when the cashier confirms the payment.
      let qrData;
      let isEstimate = false;
      if (this.currentOrder?.id) {
        // An order already exists for this cart (e.g. retrying a failed
        // payment): reuse it instead of creating a duplicate.
        qrData = await window.api.get(`/payments/vietqr/${this.currentOrder.id}`);
        const orderCodeEl = document.getElementById('checkoutOrderCode');
        if (orderCodeEl && this.currentOrder.order_code) orderCodeEl.textContent = this.currentOrder.order_code;
      } else {
        // No order yet: render a temporary estimate built from the cart total
        // via the order-less receipt preview API (POST /payments/vietqr/receipt).
        isEstimate = true;
        qrData = await window.api.post('/payments/vietqr/receipt', {
          amount: Math.round(this.totalAmount),
          memo: 'TAM TINH'
        });
        if (qrData.configured === false) {
          if (qrLoading) qrLoading.style.display = 'none';
          window.api.showToast('Cửa hàng chưa cấu hình tài khoản ngân hàng cho VietQR', 'error');
          return;
        }
      }

      if (qrImg) {
        qrImg.src = qrData.qrUrl;
        qrImg.onload = () => {
          if (qrLoading) qrLoading.style.display = 'none';
          qrImg.style.display = 'block';
        };
      }

      if (qrBankName) qrBankName.textContent = qrData.bankName;
      if (qrAccountNo) qrAccountNo.textContent = qrData.bankAccount;
      if (qrAccountHolder) qrAccountHolder.textContent = qrData.accountHolder;
      if (qrMemo) {
        qrMemo.textContent = isEstimate
          ? 'Tạm tính — mã chính thức sẽ tạo khi xác nhận thanh toán'
          : qrData.memo;
      }
    } catch (err) {
      if (qrLoading) qrLoading.style.display = 'none';
      window.api.showToast('Lỗi tạo mã VietQR: ' + err.message, 'error');
    }
  },

  async executePayment() {
    if (this.isProcessing) return;
    const confirmButton = document.getElementById('btnConfirmCompletePayment');
    const originalButtonHtml = confirmButton?.innerHTML;
    this.isProcessing = true;
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang thanh toán...';
    }
    try {
      let order = this.currentOrder;

      // If order not created yet, create it now (the only place a checkout
      // order is created — the VietQR preview never creates one).
      if (!order) {
        const orderPayload = {
          order_type: window.appState.cart.orderType,
          table_id: window.appState.cart.selectedTable ? window.appState.cart.selectedTable.id : null,
          existing_order_id: window.appState.cart.existingOrderId || null,
          note: window.appState.cart.note,
          discount_amount: window.appState.getCartDiscount(),
          items: window.appState.cart.items,
          ...(window.posModule?.getFulfillmentPayload?.() || {})
        };
        const orderRes = await window.api.post('/orders', orderPayload);
        order = orderRes.order;
        // Remember the order so payment retries and the QR preview reuse it
        // instead of creating a duplicate for the same cart.
        this.currentOrder = order;
        this.currentOrderCartSignature = this.getCartSignature();
      }

      const transactionCodeInput = document.getElementById('transactionCodeInput');
      const transactionCode = transactionCodeInput ? transactionCodeInput.value.trim() : null;

      const payPayload = {
        order_id: order.id,
        payment_method: this.selectedMethod,
        amount: this.totalAmount,
        cash_received: this.cashReceived,
        transaction_code: transactionCode,
        replace_existing: this.isRepayment
      };

      const payRes = await window.api.post('/payments/process', payPayload);
      order = payRes.order || { ...order, payment_status: 'PAID', order_status: 'COMPLETED' };
      if (this.selectedMethod === 'QR' && order.payment_status === 'PAID') {
        const amount = Number(payRes.payment?.amount ?? order.total_amount ?? this.totalAmount);
        if (Number.isFinite(amount)) window.audioModule?.speak(`Đã xác nhận thanh toán ${amount.toLocaleString('vi-VN')} đồng qua VietQR.`, { kind: 'qr' });
      }

      window.api.showToast(this.isRepayment ? 'Đã cập nhật giao dịch thanh toán!' : 'Thanh toán thành công, đơn hàng đã hoàn tất!', 'success');
      document.getElementById('checkoutModal').style.display = 'none';

      // Complete only the active Takeaway draft; other customers remain open.
      if (!this.openedFromExistingOrder && window.appState.isTakeawayOnlyStore()) {
        window.appState.completeActiveTakeawayDraft();
        window.posModule?.renderFulfillmentFields?.();
        window.posModule?.setTakeawayPane?.('orders');
      } else if (!this.openedFromExistingOrder) {
        window.appState.clearCart();
      }
      // Only reset the table selection when no takeaway draft is active:
      // setSelectedTable(null) replaces appState.cart with a brand-new cart
      // object, which would sever the link between the active takeaway draft
      // and the cart that completeActiveTakeawayDraft/activateTakeawayDraft
      // just set up (the draft would keep holding the old cart object).
      if (!window.appState.getActiveTakeawayDraft()) {
        window.appState.setSelectedTable(null);
      }

      this.currentOrder = null;
      this.currentOrderCartSignature = null;
      this.openedFromExistingOrder = false;
      this.isRepayment = false;
      const tableModal = document.getElementById('tableActionModal');
      if (tableModal) tableModal.style.display = 'none';
      // Refresh failures must never turn a committed payment into a payment error.
      const refreshes = await Promise.allSettled([
        window.tablesModule?.loadAreasAndTables(),
        window.ordersModule?.loadOrders(),
        window.completedItemsModule?.loadCompletedItems(true)
      ]);
      if (refreshes.some(result => result.status === 'rejected')) {
        window.api.showToast('Đã thanh toán. Chưa tải lại được danh sách; vui lòng làm mới màn hình.', 'info');
      }
      if (window.invoiceModule) {
        await window.invoiceModule.showReceipt(order, payRes.payment, payRes.change, { autoPrint: true, forcePrint: true });
      }
    } catch (err) {
      window.api.showToast('Lỗi thanh toán: ' + err.message, 'error');
    } finally {
      this.isProcessing = false;
      if (confirmButton) {
        confirmButton.disabled = false;
        if (originalButtonHtml) confirmButton.innerHTML = originalButtonHtml;
      }
    }
  }
};
