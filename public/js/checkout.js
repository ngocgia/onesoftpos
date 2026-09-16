// ThichGaPOS v1.0 - Checkout & Payment Controller (Rule 27, 28)

window.checkoutModule = {
  currentOrder: null,
  selectedMethod: 'CASH',
  totalAmount: 0,
  cashReceived: 0,

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

  async openCheckoutModal(existingOrder = null) {
    this.currentOrder = existingOrder;
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

    if (orderCodeEl) {
      orderCodeEl.textContent = existingOrder ? existingOrder.order_code : 'Đơn mới';
    }
    if (totalPayableEl) {
      totalPayableEl.textContent = window.api.formatMoney(this.totalAmount);
    }
    if (cashInput) {
      cashInput.value = this.totalAmount;
    }

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
      let orderId = this.currentOrder ? this.currentOrder.id : null;

      // If no order yet, create order first
      if (!orderId) {
        const orderPayload = {
          order_type: window.appState.cart.orderType,
          table_id: window.appState.cart.selectedTable ? window.appState.cart.selectedTable.id : null,
          note: window.appState.cart.note,
          discount_amount: window.appState.getCartDiscount(),
          items: window.appState.cart.items
        };
        const orderRes = await window.api.post('/orders', orderPayload);
        this.currentOrder = orderRes.order;
        orderId = this.currentOrder.id;

        const orderCodeEl = document.getElementById('checkoutOrderCode');
        if (orderCodeEl) orderCodeEl.textContent = this.currentOrder.order_code;
      }

      const qrData = await window.api.get(`/payments/vietqr/${orderId}`);

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
      if (qrMemo) qrMemo.textContent = qrData.memo;
    } catch (err) {
      if (qrLoading) qrLoading.style.display = 'none';
      window.api.showToast('Lỗi tạo mã VietQR: ' + err.message, 'error');
    }
  },

  async executePayment() {
    try {
      let order = this.currentOrder;

      // If order not created yet, create it now
      if (!order) {
        const orderPayload = {
          order_type: window.appState.cart.orderType,
          table_id: window.appState.cart.selectedTable ? window.appState.cart.selectedTable.id : null,
          note: window.appState.cart.note,
          discount_amount: window.appState.getCartDiscount(),
          items: window.appState.cart.items
        };
        const orderRes = await window.api.post('/orders', orderPayload);
        order = orderRes.order;
      }

      const transactionCodeInput = document.getElementById('transactionCodeInput');
      const transactionCode = transactionCodeInput ? transactionCodeInput.value.trim() : null;

      const payPayload = {
        order_id: order.id,
        payment_method: this.selectedMethod,
        amount: this.totalAmount,
        cash_received: this.cashReceived,
        transaction_code: transactionCode
      };

      const payRes = await window.api.post('/payments/process', payPayload);

      window.api.showToast('Thanh toán thành công!', 'success');
      document.getElementById('checkoutModal').style.display = 'none';

      // Clear cart
      window.appState.clearCart();
      window.appState.setSelectedTable(null);

      // Open printable receipt (Rule 29)
      if (window.invoiceModule) {
        window.invoiceModule.showReceipt(order, payRes.payment, payRes.change);
      }

      // Refresh table status
      if (window.tablesModule) {
        window.tablesModule.loadAreasAndTables();
      }
    } catch (err) {
      window.api.showToast('Lỗi thanh toán: ' + err.message, 'error');
    }
  }
};
