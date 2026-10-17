// ThichGaPOS v1.0 - Invoice & Receipt Controller (Rule 29: 58mm / 80mm Print)

window.invoiceModule = {
  currentOrder: null,
  receiptStoreId: null,
  printing: false,
  receiptText: '',

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  },

  getPrintLayout(paperSize) {
    return {
      K58: { width: '48mm', fontSize: '11px', page: '58mm 297mm', margin: '0' },
      K80: { width: '72mm', fontSize: '12px', page: '80mm 297mm', margin: '0' },
      K85: { width: '72mm', fontSize: '12px', page: '85mm 297mm', margin: '0' },
      A4: { width: '190mm', fontSize: '14px', page: 'A4', margin: '10mm' }
    }[paperSize] || this.getPrintLayout('K80');
  },

  async loadPrinterSettings(storeId) {
    const result = await window.api.get('/store/menu-settings/printer');
    if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
    return { ...window.moreMenuModule.defaultPrinterSettings, ...(result.settings || {}) };
  },

  applyPrinterSettings(settings) {
    const layout = this.getPrintLayout(settings.paperSize);
    const label = document.getElementById('receiptPrintLabel');
    if (label) label.textContent = `In Hóa Đơn (${({ K58: '58mm', K80: '80mm', K85: '85mm', A4: 'A4' })[settings.paperSize] || '80mm'})`;
    // The installed Android bridge reads this legacy field when window.print runs.
    window.appState.storeSettings ||= {};
    window.appState.storeSettings.receipt_paper_size = { K58: '58mm', K80: '80mm', K85: '85mm', A4: 'A4' }[settings.paperSize] || '80mm';
    window.appState.storeSettings.receipt_connection_type = settings.connectionType || 'browser';
    let style = document.getElementById('receiptPrintSettings');
    if (!style) {
      style = document.createElement('style');
      style.id = 'receiptPrintSettings';
      document.head.appendChild(style);
    }
    style.textContent = `
      #receiptPaper { width: ${layout.width}; max-width: 100%; box-sizing: border-box; font-size: ${layout.fontSize}; }
      #receiptPaper { font-family: Arial, sans-serif; color: #000; overflow-wrap: anywhere; }
      #receiptPaper table { width: 100%; table-layout: fixed; }
      #receiptPaper th:first-child { width: 52%; }
      #receiptPaper th:nth-child(2) { width: 12%; }
      #receiptPaper th:last-child { width: 36%; }
      #receiptPaper tr { break-inside: avoid; }
      @media print {
        @page { size: ${layout.page}; margin: ${layout.margin}; }
        html, body { height: auto !important; overflow: visible !important; margin: 0; padding: 0; background: #fff; }
        body > :not(#receiptModal) { display: none !important; }
        #receiptModal { position: static !important; display: block !important; background: #fff !important; padding: 0; overflow: visible !important; height: auto !important; max-height: none !important; }
        #receiptModal, #receiptModal * { animation: none !important; transition: none !important; transform: none !important; }
        #receiptModal .modal-dialog { width: auto; max-width: none; max-height: none; overflow: visible; margin: 0; padding: 0; box-shadow: none; display: block; }
        #receiptPaper { position: static; width: ${layout.width}; max-width: ${layout.width}; margin: 0; padding: 0; }
        #receiptPaper, #receiptPaper * { visibility: visible !important; color: #000 !important; text-shadow: none !important; background: #fff !important; }
        #receiptModal .modal-body { padding: 0; overflow: visible !important; height: auto !important; max-height: none !important; }
        #receiptModal .modal-header, #receiptModal .modal-footer { display: none !important; }
      }`;
  },

  async printReceipt({ auto = false } = {}) {
    if (this.printing) return;
    this.printing = true;
    try {
      const storeId = window.api.getCurrentStoreId();
      if (!this.currentOrder || this.receiptStoreId !== storeId) throw new Error('Vui lòng mở lại phiếu của cửa hàng hiện tại');
      // Refresh on every print so another cashier's saved changes also take effect.
      const settings = await this.loadPrinterSettings(storeId);
      this.applyPrinterSettings(settings);
      if (auto && !settings.autoPrintOnPayment) return;
      if (['bluetooth', 'usb'].includes(settings.connectionType) && !window.onesoftNativePrint) {
        if (settings.connectionType === 'bluetooth') throw new Error('In Bluetooth trực tiếp cần ứng dụng Android Onesoft POS bản mới');
      }
      if (window.onesoftNativePrint && ['bluetooth', 'usb'].includes(settings.connectionType) && settings.paperSize === 'A4') {
        throw new Error('Máy in nhiệt Bluetooth/USB chỉ hỗ trợ K58, K80 hoặc K85');
      }
      if (document.fonts?.ready) await document.fonts.ready;
      // Android captures the WebView immediately; wait until the populated bill has painted.
      if (window.requestAnimationFrame) {
        await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      }
      if (storeId !== window.api.getCurrentStoreId() || this.receiptStoreId !== storeId || !this.currentOrder) {
        throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
      }
      window.print();
    } catch (error) {
      window.api.showToast(`Không thể in phiếu: ${error.message}`, 'error');
    } finally {
      this.printing = false;
    }
  },

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
        return this.printReceipt();
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
      items: [...(cart.sentItems || []), ...cart.items],
      subtotal: subtotal + Number(cart.sentOrder?.subtotal || 0),
      discount_amount: discount + Number(cart.sentOrder?.discount_amount || 0),
      tax_amount: Number(cart.sentOrder?.tax_amount || 0),
      total_amount: window.appState.getCartGrandTotal() + Number(cart.sentOrder?.total_amount || 0),
      note: cart.note
    });
  },

  async showReceipt(order, payment = null, change = 0, { autoPrint = false } = {}) {
    const storeId = window.api.getCurrentStoreId();
    this.currentOrder = null;
    this.receiptText = '';
    const receiptModal = document.getElementById('receiptModal');
    if (receiptModal) receiptModal.style.display = 'none';

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
        if (!payment && fullOrder.payment_status === 'PAID') {
          payment = (res.payments || []).filter(entry => entry.status === 'SUCCESS')
            .sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
        }
      }
      // Món hủy vẫn được lưu trong đơn để truy vết, nhưng không được xuất hiện trên bill.
      items = items.filter(item => item.status !== 'CANCELLED');
      if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
      this.currentOrder = order;
      this.receiptStoreId = storeId;
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
      if (storePhone) storePhone.textContent = currentStore?.phone ? `Hotline: ${currentStore.phone}` : '';
      const isUnpaid = fullOrder.isDraft || fullOrder.payment_status !== 'PAID';
      if (receiptTitle) receiptTitle.textContent = isUnpaid ? 'PHIẾU TẠM TÍNH' : 'PHIẾU THANH TOÁN';
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
              <strong>${this.escape(item.product_name)}</strong>
              ${item.variant_name ? ` (${this.escape(item.variant_name)})` : ''}
              ${(item.options || []).map(o => `<div style="font-size: 10px;">+${this.escape(o.option_name || o.name)}</div>`).join('')}
              <div style="font-size: 10px;">Đơn giá: ${this.escape(window.api.formatMoney(item.unit_price_with_options ?? (Number(item.unit_price || 0) + (item.options || []).reduce((sum, option) => sum + Number(option.extra_price ?? option.price ?? 0), 0))))}</div>
              ${item.note ? `<div style="font-size: 10px;">Ghi chú: ${this.escape(item.note)}</div>` : ''}
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
      const tax = Number(fullOrder.tax_amount || 0);
      const taxRow = document.getElementById('receiptTaxRow');
      if (taxRow) taxRow.style.display = tax > 0 ? 'flex' : 'none';
      const taxEl = document.getElementById('receiptTax');
      if (taxEl) taxEl.textContent = window.api.formatMoney(tax);
      const noteEl = document.getElementById('receiptNote');
      if (noteEl) noteEl.textContent = fullOrder.note ? `Ghi chú đơn: ${fullOrder.note}` : '';
      const cashierEl = document.getElementById('receiptCashier');
      if (cashierEl) cashierEl.textContent = fullOrder.cashier_name ? `Nhân viên: ${fullOrder.cashier_name}` : '';
      
      const payMethod = isUnpaid ? 'UNPAID' : (payment?.payment_method || fullOrder.payment_method || 'UNKNOWN');
      let methodText = isUnpaid ? 'Chưa thanh toán' : 'Đã thanh toán';
      if (payMethod === 'CASH') methodText = 'Tiền mặt';
      if (payMethod === 'QR') methodText = 'VietQR';
      if (payMethod === 'CARD') methodText = 'Thẻ ngân hàng';
      if (payMethod === 'BANK_TRANSFER') methodText = 'Chuyển khoản';

      if (methodEl) methodEl.textContent = methodText;

      if (!fullOrder.isDraft && payMethod === 'CASH' && payment) {
        if (cashRow) cashRow.style.display = 'flex';
        if (changeRow) changeRow.style.display = 'flex';
        if (cashGivenEl) cashGivenEl.textContent = window.api.formatMoney(payment.cash_received ?? fullOrder.total_amount);
        if (cashReturnEl) cashReturnEl.textContent = window.api.formatMoney(payment.cash_return ?? change ?? 0);
      } else {
        if (cashRow) cashRow.style.display = 'none';
        if (changeRow) changeRow.style.display = 'none';
      }

      if (footerMsg) footerMsg.textContent = settings?.receipt_footer || 'Cảm ơn Quý khách & Hẹn gặp lại!';
      // Plain Unicode is rendered to raster on Android; never send UTF-8 to the printer's legacy fonts.
      const money = value => window.api.formatMoney(value);
      this.receiptText = [
        currentStore?.name?.toUpperCase() || 'THÍCH GÀ POS', currentStore?.address,
        currentStore?.phone ? `Hotline: ${currentStore.phone}` : '',
        isUnpaid ? 'PHIẾU TẠM TÍNH' : 'PHIẾU THANH TOÁN',
        `Mã đơn: #${fullOrder.order_code}`, dateTime?.textContent, tableType?.textContent,
        fullOrder.cashier_name ? `Nhân viên: ${fullOrder.cashier_name}` : '',
        '--------------------------------',
        ...items.flatMap(item => [
          `${item.quantity} × ${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ''}`,
          ...(item.options || []).map(option => `  + ${option.option_name || option.name || ''}`),
          `Đơn giá: ${money(item.unit_price_with_options ?? (Number(item.unit_price || 0) + (item.options || []).reduce((sum, option) => sum + Number(option.extra_price ?? option.price ?? 0), 0)))}`,
          `Thành tiền: ${money(item.subtotal)}`,
          item.note ? `Ghi chú: ${item.note}` : ''
        ]),
        '--------------------------------', `Tạm tính: ${money(fullOrder.subtotal)}`,
        discount > 0 ? `Giảm giá: -${money(discount)}` : '', tax > 0 ? `Thuế: ${money(tax)}` : '',
        `TỔNG CỘNG: ${money(fullOrder.total_amount)}`, `Thanh toán: ${methodText}`,
        !isUnpaid && payMethod === 'CASH' && payment ? `Tiền khách đưa: ${money(payment.cash_received ?? fullOrder.total_amount)}\nTiền thối: ${money(payment.cash_return ?? change ?? 0)}` : '',
        fullOrder.note ? `Ghi chú đơn: ${fullOrder.note}` : '',
        settings?.receipt_footer || 'Cảm ơn Quý khách & Hẹn gặp lại!'
      ].filter(value => value !== undefined && value !== null && value !== '').join('\n');

      document.getElementById('receiptModal').style.display = 'flex';
      if (autoPrint && !fullOrder.isDraft) {
        await this.printReceipt({ auto: true });
      } else {
        try {
          this.applyPrinterSettings(await this.loadPrinterSettings(storeId));
        } catch (error) {
          window.api.showToast(`Không thể tải cấu hình máy in: ${error.message}`, 'error');
        }
      }
    } catch (err) {
      this.currentOrder = null;
      this.receiptText = '';
      window.api.showToast(`Không thể mở hóa đơn: ${err.message}`, 'error');
      console.error('showReceipt error:', err);
    }
  }
};
