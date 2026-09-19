// ThichGaPOS v1.0 - Invoice & Receipt Controller (Rule 29: 58mm / 80mm Print)

window.invoiceModule = {
  currentOrder: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnCloseModal = document.getElementById('btnCloseReceiptModal');
    const btnCloseBtn = document.getElementById('btnCloseReceiptBtn');
    const btnPrint = document.getElementById('btnPrintReceiptBtn');

    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        document.getElementById('receiptModal').style.display = 'none';
      });
    }

    if (btnCloseBtn) {
      btnCloseBtn.addEventListener('click', () => {
        document.getElementById('receiptModal').style.display = 'none';
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }
  },

  showDraftReceipt() {
    const cart = window.appState.cart;
    const activeDraft = window.appState.getActiveTakeawayDraft?.();
    const subtotal = window.appState.getCartSubtotal();
    const discount = window.appState.getCartDiscount();
    return this.showReceipt({
      isDraft: true,
      order_code: `TẠM-${activeDraft?.number || 1}`,
      created_at: new Date().toISOString(),
      order_type: cart.orderType,
      fulfillment_type: cart.fulfillmentType,
      customer_name: cart.customerName,
      customer_phone: cart.customerPhone,
      delivery_address: cart.deliveryAddress,
      scheduled_at: cart.scheduledAt,
      table_name: cart.selectedTable?.name,
      table_code: cart.selectedTable?.code,
      subtotal,
      discount_amount: discount,
      total_amount: window.appState.getCartGrandTotal(),
      items: cart.items
    });
  },

  async showReceipt(order, payment = null, change = 0) {
    this.currentOrder = order;

    try {
      let fullOrder;
      let items;
      if (order.isDraft) {
        fullOrder = order;
        items = order.items || [];
      } else {
        // Fetch full order details with items
        const res = await window.api.get(`/orders/${order.id}`);
        fullOrder = res.order;
        items = res.items || [];
      }
      // Món hủy vẫn được lưu trong đơn để truy vết, nhưng không được xuất hiện trên bill.
      items = items.filter(item => item.status !== 'CANCELLED');
      const currentStore = window.appState.currentStore;
      const settings = window.appState.storeSettings;

      const storeName = document.getElementById('receiptStoreName');
      const storeAddress = document.getElementById('receiptStoreAddress');
      const storePhone = document.getElementById('receiptStorePhone');
      const orderCodeText = document.getElementById('receiptOrderCodeText');
      const dateTime = document.getElementById('receiptDateTime');
      const tableType = document.getElementById('receiptTableType');
      const itemsTbody = document.getElementById('receiptItemsTbody');
      const subtotalEl = document.getElementById('receiptSubtotal');
      const discountRow = document.getElementById('receiptDiscountRow');
      const discountEl = document.getElementById('receiptDiscount');
      const totalEl = document.getElementById('receiptTotal');
      const methodEl = document.getElementById('receiptMethod');
      const cashRow = document.getElementById('receiptCashRow');
      const changeRow = document.getElementById('receiptChangeRow');
      const cashGivenEl = document.getElementById('receiptCashGiven');
      const cashReturnEl = document.getElementById('receiptCashReturn');
      const footerMsg = document.getElementById('receiptFooterMessage');
      const receiptTitle = document.querySelector('#receiptPaper .receipt-title');

      if (storeName) storeName.textContent = currentStore ? currentStore.name.toUpperCase() : 'THÍCH GÀ POS';
      if (storeAddress) storeAddress.textContent = currentStore ? currentStore.address : '';
      if (storePhone) storePhone.textContent = currentStore ? `Hotline: ${currentStore.phone}` : '';
      if (receiptTitle) receiptTitle.textContent = fullOrder.isDraft ? 'BIÊN LAI TẠM' : 'PHIẾU THANH TOÁN';
      if (orderCodeText) orderCodeText.textContent = `${fullOrder.isDraft ? 'Mã tạm' : 'Mã đơn'}: #${fullOrder.order_code}`;
      if (dateTime) dateTime.textContent = `Ngày: ${new Date(fullOrder.created_at || Date.now()).toLocaleString('vi-VN')}`;

      if (tableType) {
        const fulfillmentLabels = { SHIP_DELIVERY:'Ship mang về', CUSTOMER_PICKUP:'Khách tới lấy', APP_DELIVERY:'Ship qua app' };
        const schedule = fullOrder.scheduled_at ? new Date(fullOrder.scheduled_at).toLocaleString('vi-VN') : '';
        tableType.textContent = fullOrder.order_type === 'DINE_IN'
          ? `Bàn: ${fullOrder.table_name || fullOrder.table_code || 'Tại chỗ'} - Ăn tại quán`
          : `Đơn hàng: ${fulfillmentLabels[fullOrder.fulfillment_type] || 'Bán mang đi'}${fullOrder.customer_name ? ` - ${fullOrder.customer_name}` : ''}${fullOrder.customer_phone ? ` - ${fullOrder.customer_phone}` : ''}${fullOrder.delivery_address ? ` - ${fullOrder.delivery_address}` : ''}${schedule ? ` - ${schedule}` : ''}`;
      }

      if (itemsTbody) {
        itemsTbody.innerHTML = items.map(item => `
          <tr>
            <td class="text-left">
              <strong>${item.product_name}</strong>
              ${item.variant_name ? ` (${item.variant_name})` : ''}
              ${(item.options || []).map(o => `<div style="font-size: 10px;">+${o.option_name}</div>`).join('')}
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${window.api.formatMoney(item.subtotal)}</td>
          </tr>
        `).join('');
      }

      if (subtotalEl) subtotalEl.textContent = window.api.formatMoney(fullOrder.subtotal);
      
      const discount = parseFloat(fullOrder.discount_amount || 0);
      if (discountRow && discountEl) {
        if (discount > 0) {
          discountRow.style.display = 'flex';
          discountEl.textContent = '-' + window.api.formatMoney(discount);
        } else {
          discountRow.style.display = 'none';
        }
      }

      if (totalEl) totalEl.textContent = window.api.formatMoney(fullOrder.total_amount);
      
      const payMethod = fullOrder.isDraft ? 'UNPAID' : (payment ? payment.payment_method : 'CASH');
      let methodText = fullOrder.isDraft ? 'Chưa thanh toán' : 'Tiền mặt';
      if (payMethod === 'QR') methodText = 'VietQR';
      if (payMethod === 'CARD') methodText = 'Thẻ ngân hàng';
      if (payMethod === 'BANK_TRANSFER') methodText = 'Chuyển khoản';

      if (methodEl) methodEl.textContent = methodText;

      if (!fullOrder.isDraft && payMethod === 'CASH' && payment) {
        if (cashRow) cashRow.style.display = 'flex';
        if (changeRow) changeRow.style.display = 'flex';
        if (cashGivenEl) cashGivenEl.textContent = window.api.formatMoney(payment.cash_received || fullOrder.total_amount);
        if (cashReturnEl) cashReturnEl.textContent = window.api.formatMoney(change || payment.cash_return || 0);
      } else {
        if (cashRow) cashRow.style.display = 'none';
        if (changeRow) changeRow.style.display = 'none';
      }

      if (footerMsg && settings && settings.receipt_footer) {
        footerMsg.textContent = settings.receipt_footer;
      }

      document.getElementById('receiptModal').style.display = 'flex';
    } catch (err) {
      console.error('showReceipt error:', err);
    }
  }
};
