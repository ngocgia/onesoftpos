// ThichGaPOS v1.0 - Invoice & Receipt Controller (Rule 29: 58mm / 80mm Print)

window.invoiceModule = {
  currentOrder: null,
  receiptStoreId: null,
  printing: false,
  receiptText: '',
  receiptKind: 'invoice',
  receiptQrUrl: '',
  receiptFooterText: '',
  printCounts: new Map(),
  renderVersion: 0,

  async loadReceiptQr(order, storeId, version) {
    this.receiptQrUrl = '';
    const block = document.getElementById('receiptPaymentQr');
    const notice = document.getElementById('receiptQrNotice');
    const image = document.getElementById('receiptQrImage');
    block.style.display = 'none';
    notice.style.display = 'none';
    image.removeAttribute?.('src');
    if (Number(order.total_amount) <= 0) return;
    try {
      const data = await window.api.post('/payments/vietqr/receipt', {
        amount: Math.round(Number(order.total_amount)), memo: order.order_code || `DON-${order.id}`
      });
      if (version !== this.renderVersion) return;
      if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi');
      if (!data.configured) {
        notice.textContent = 'Cấu hình tài khoản ngân hàng của cửa hàng để hiển thị QR thanh toán.';
        notice.style.display = 'block';
        return;
      }
      // Use only the payment image service; never print arbitrary URLs from a response.
      const url = new URL(data.qrUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'img.vietqr.io') throw new Error('Địa chỉ QR không hợp lệ');
      image.src = url.href;
      if (image.decode) {
        let timeout;
        try {
          await Promise.race([
            image.decode(),
            new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Tải QR quá thời gian')), 15000); })
          ]);
        } finally { clearTimeout(timeout); }
      }
      if (version !== this.renderVersion) return;
      if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi');
      this.receiptQrUrl = url.href;
      document.getElementById('receiptQrBank').textContent = `${data.bankName} - ${data.accountHolder}`;
      document.getElementById('receiptQrAccount').textContent = `STK: ${data.bankAccount}`;
      document.getElementById('receiptQrMemo').textContent = `Nội dung: ${data.memo}`;
      block.style.display = 'block';
    } catch (error) {
      if (version !== this.renderVersion) return;
      this.receiptQrUrl = '';
      block.style.display = 'none';
      notice.textContent = 'Không tải được mã QR thanh toán. Vui lòng liên hệ thu ngân.';
      notice.style.display = 'block';
    }
  },

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
    if (label) label.textContent = `In ${this.receiptKind === 'orderSlip' ? 'phiếu đặt đồ' : 'Hóa Đơn'} (${({ K58: '58mm', K80: '80mm', K85: '85mm', A4: 'A4' })[settings.paperSize] || '80mm'})`;
    // The installed Android bridge reads this legacy field when window.print runs.
    window.appState.storeSettings ||= {};
    window.appState.storeSettings.receipt_paper_size = { K58: '58mm', K80: '80mm', K85: '85mm', A4: 'A4' }[settings.paperSize] || '80mm';
    window.appState.storeSettings.receipt_connection_type = settings.connectionType || 'browser';
    window.appState.storeSettings.receipt_auto_cut_paper = settings.autoCutPaper !== false;
    window.appState.storeSettings.receipt_ip_address = String(settings.ipAddress || '').trim();
    let style = document.getElementById('receiptPrintSettings');
    if (!style) {
      style = document.createElement('style');
      style.id = 'receiptPrintSettings';
      document.head.appendChild(style);
    }
    style.textContent = `
      #receiptPaper { width: ${layout.width}; max-width: 100%; box-sizing: border-box; font-size: ${layout.fontSize}; }
      #receiptPaper { font-family: Arial, sans-serif; color: #000; overflow-wrap: anywhere; }
      #receiptPaper table { width: 100%; table-layout: fixed; font-size: inherit; }
      #receiptPaper #receiptInvoiceContent table { font-size: .85em; }
      #receiptPaper #receiptInvoiceContent th, #receiptPaper #receiptInvoiceContent td { font-size: inherit; }
      #receiptInvoiceContent th { white-space: nowrap; }
      #receiptPaper th:first-child { width: 40%; }
      #receiptPaper th:nth-child(2) { width: 24%; }
      #receiptPaper th:nth-child(3) { width: 12%; }
      #receiptPaper th:last-child { width: 24%; }
      #receiptPaper tr { break-inside: avoid; }
      #receiptPaper #orderSlipContent { text-align: left; line-height: 1.4; }
      #receiptPaper #orderSlipContent h3 { text-align: center; font-size: 1.3em; margin: 8px 0 4px; }
      #receiptPaper #orderSlipContent .slip-heading { text-align: center; margin-bottom: 6px; }
      #receiptPaper #orderSlipContent .slip-time { display: flex; justify-content: space-between; gap: 8px; }
      #receiptPaper #orderSlipContent table { border-collapse: collapse; margin-top: 6px; }
      #receiptPaper #orderSlipContent th, #receiptPaper #orderSlipContent td { border: 1px solid #000; padding: 4px 2px; vertical-align: top; }
      #receiptPaper #orderSlipContent th { text-align: center; }
      #receiptPaper #orderSlipContent th:first-child { width: 9%; }
      #receiptPaper #orderSlipContent th:nth-child(2) { width: 61%; }
      #receiptPaper #orderSlipContent th:nth-child(3) { width: 10%; }
      #receiptPaper #orderSlipContent th:last-child { width: 20%; }
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
      if (auto && !(this.receiptKind === 'orderSlip' ? settings.autoPrintOrderSlipOnTransfer : settings.autoPrintOnPayment)) return;
      if (['lan', 'network'].includes(settings.connectionType)) {
        if (!window.onesoftNativeLanPrint) throw new Error('In LAN trực tiếp cần app Android Onesoft POS 1.3.7 trở lên. Trên web, chọn Trình duyệt và máy in đã cài driver, hoặc dùng app Android.');
        const parts = String(settings.ipAddress || '').trim().split('.');
        if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)
            || Number(parts[0]) === 0 || Number(parts[0]) >= 224 || Number(parts[3]) === 255) {
          throw new Error('Nhập IP máy in hợp lệ, ví dụ 192.168.1.27; không kèm http:// hoặc cổng');
        }
        if (settings.paperSize === 'A4') throw new Error('In LAN máy in nhiệt chỉ hỗ trợ K58, K80 hoặc K85');
      }
      if (settings.connectionType === 'rawbt') {
        if (!window.onesoftNativeRawBt) throw new Error('In RawBT cần cài ứng dụng Android Onesoft POS bản hỗ trợ RawBT; vui lòng cập nhật APK');
        if (settings.paperSize === 'A4') throw new Error('In RawBT chỉ hỗ trợ K58, K80 hoặc K85');
      }
      if (['bluetooth', 'usb'].includes(settings.connectionType) && !window.onesoftNativePrint) {
        if (settings.connectionType === 'bluetooth') throw new Error('In Bluetooth trực tiếp cần ứng dụng Android Onesoft POS bản mới');
        throw new Error('In USB trực tiếp cần app Android Onesoft POS. Trên web, chọn Trình duyệt và máy in đã cài driver USB.');
      }
      if (window.onesoftNativePrint && ['bluetooth', 'usb'].includes(settings.connectionType) && settings.paperSize === 'A4') {
        throw new Error('Máy in nhiệt Bluetooth/USB chỉ hỗ trợ K58, K80 hoặc K85');
      }
      if (this.receiptQrUrl && window.onesoftNativePrint && !window.onesoftNativeReceiptQr && ['bluetooth', 'usb'].includes(settings.connectionType)) {
        throw new Error('Vui lòng cập nhật ứng dụng Android để in hóa đơn có mã QR qua Bluetooth/USB');
      }
      if (document.fonts?.ready) await document.fonts.ready;
      // Android captures the WebView immediately; wait until the populated bill has painted.
      if (window.requestAnimationFrame) {
        await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      }
      if (storeId !== window.api.getCurrentStoreId() || this.receiptStoreId !== storeId || !this.currentOrder) {
        throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
      }
      if (this.receiptKind === 'invoice') {
        const key = `${storeId}:${this.currentOrder.id || this.currentOrder.order_code}`;
        const count = (this.printCounts.get(key) || 0) + 1;
        this.printCounts.set(key, count);
        document.getElementById('receiptPrintCount').textContent = `In lần ${count}`;
        document.getElementById('receiptPrintedAt').textContent = `Giờ in: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
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
      order_code: cart.sentOrder?.order_code || `TẠM-${activeDraft?.number || 1}`,
      created_at: cart.sentOrder?.created_at || new Date().toISOString(),
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

  async printCartOrderSlip() {
    if (window.posModule?.sendingOrder || this.printing) return;
    const cart = window.appState.cart;
    const items = cart.items.length ? cart.items : (cart.sentItems || []);
    return this.showOrderSlip({
      ...(cart.sentOrder || {}),
      table_name: cart.selectedTable?.name || cart.selectedTable?.code,
      order_type: cart.orderType,
      note: cart.note || cart.sentOrder?.note
    }, items);
  },

  async showOrderSlip(order, sourceItems, { auto = false, storeId = window.api.getCurrentStoreId() } = {}) {
    if (this.printing) return;
    const version = ++this.renderVersion;
    try {
      const settings = await this.loadPrinterSettings(storeId);
      if (version !== this.renderVersion) return;
      if (auto && !settings.autoPrintOrderSlipOnTransfer) return;
      const items = sourceItems.filter(item => item.status !== 'CANCELLED');
      if (!items.length) {
        if (!auto) window.api.showToast('Không có món để in phiếu đặt đồ', 'error');
        return;
      }
      const escape = value => this.escape(value);
      const time = new Date();
      const timeText = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateText = time.toLocaleDateString('vi-VN');
      const table = order.table_name || order.table_code || (order.order_type === 'TAKEAWAY' ? 'Mang đi' : 'Tại chỗ');
      const code = order.order_code || 'Chưa chuyển';
      const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const sequence = order.id || '—';
      const name = item => `${item.product_name || ''}${item.variant_name ? ` (${item.variant_name})` : ''}`;
      const unit = item => item.unit_name || item.unit || window.posModule?.products?.find(product => Number(product.id) === Number(item.product_id))?.unit || 'Món';
      document.getElementById('orderSlipContent').innerHTML = `
        <h3>PHIẾU ĐẶT ĐỒ</h3>
        <div class="slip-heading"><strong>${escape(table)}</strong><br><strong>Mã hóa đơn:</strong> ${escape(code)}</div>
        <div class="slip-time"><span>Giờ: <strong>${escape(timeText)}</strong></span><span>Ngày: <strong>${escape(dateText)}</strong></span></div>
        <div>Số thứ tự: ${escape(sequence)} (SL: ${escape(quantity)})</div>
        <table><thead><tr><th>STT</th><th>Tên món</th><th>SL</th><th>ĐVT</th></tr></thead><tbody>
          ${items.map((item, index) => `<tr><td style="text-align:center">${index + 1}</td><td>${escape(name(item))}
            ${(item.options || []).map(option => `<div>+ ${escape(option.option_name || option.name)}</div>`).join('')}
            ${item.note ? `<div>Ghi chú: ${escape(item.note)}</div>` : ''}</td>
            <td style="text-align:center">${escape(item.quantity)}</td><td style="text-align:center">${escape(unit(item))}</td></tr>`).join('')}
        </tbody></table>${order.note ? `<p>Ghi chú: ${escape(order.note)}</p>` : ''}`;
      this.receiptKind = 'orderSlip';
      this.receiptQrUrl = '';
      this.receiptFooterText = '';
      this.currentOrder = order;
      this.receiptStoreId = storeId;
      this.receiptText = [
        'PHIẾU ĐẶT ĐỒ', table, `Mã hóa đơn: ${code}`, `Giờ: ${timeText}   Ngày: ${dateText}`,
        `Số thứ tự: ${sequence} (SL: ${quantity})`, 'STT | Tên món | SL | ĐVT',
        ...items.flatMap((item, index) => [
          `${index + 1}. ${name(item)} | ${item.quantity} | ${unit(item)}`,
          ...(item.options || []).map(option => `  + ${option.option_name || option.name || ''}`),
          item.note ? `Ghi chú: ${item.note}` : ''
        ]), order.note ? `Ghi chú: ${order.note}` : ''
      ].filter(Boolean).join('\n');
      document.getElementById('receiptInvoiceContent').style.display = 'none';
      document.getElementById('orderSlipContent').style.display = 'block';
      document.getElementById('receiptModalTitle').textContent = 'Phiếu đặt đồ';
      this.applyPrinterSettings(settings);
      document.getElementById('receiptModal').style.display = 'flex';
      await this.printReceipt({ auto });
    } catch (error) {
      window.api.showToast(`Không thể in phiếu đặt đồ: ${error.message}`, 'error');
    }
  },

  async showReceipt(order, payment = null, change = 0, { autoPrint = false, forcePrint = false } = {}) {
    if (this.printing) return;
    const version = ++this.renderVersion;
    this.receiptKind = 'invoice';
    document.getElementById('receiptInvoiceContent').style.display = 'block';
    document.getElementById('orderSlipContent').style.display = 'none';
    document.getElementById('receiptModalTitle').textContent = 'Hóa đơn thanh toán';
    const storeId = window.api.getCurrentStoreId();
    this.currentOrder = null;
    this.receiptText = '';
    this.receiptQrUrl = '';
    this.receiptFooterText = '';
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
      if (version !== this.renderVersion) return;
      items = items.filter(item => item.status !== 'CANCELLED');
      if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
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
      if (receiptTitle) receiptTitle.textContent = isUnpaid ? 'HÓA ĐƠN TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN';
      document.getElementById('receiptTotalLabel').textContent = isUnpaid ? 'TỔNG TẠM TÍNH' : 'TỔNG CỘNG';
      document.getElementById('receiptSubtotalLabel').textContent = `Tiền hàng (${items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)})`;
      document.getElementById('receiptPrintCount').textContent = `In lần ${(this.printCounts.get(`${storeId}:${fullOrder.id || fullOrder.order_code}`) || 0) + 1}`;
      document.getElementById('receiptPrintedAt').textContent = `Giờ in: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      if (orderCodeText) orderCodeText.textContent = `Mã hóa đơn: #${fullOrder.order_code}`;
      if (dateTime) dateTime.textContent = `Giờ vào: ${new Date(fullOrder.created_at || Date.now()).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`;

      if (tableType) {
        const fulfillmentLabels = { SHIP_DELIVERY:'Ship mang về', CUSTOMER_PICKUP:'Khách tới lấy', APP_DELIVERY:'Ship qua app' };
        const schedule = fullOrder.scheduled_at ? new Date(fullOrder.scheduled_at).toLocaleString('vi-VN') : '';
        tableType.textContent = fullOrder.order_type === 'DINE_IN'
          ? `Bàn: ${fullOrder.table_name || fullOrder.table_code || 'Tại chỗ'} - Ăn tại quán`
          : `Đơn hàng: ${fulfillmentLabels[fullOrder.fulfillment_type] || 'Bán mang đi'}${fullOrder.customer_name ? ` - ${fullOrder.customer_name}` : ''}${fullOrder.customer_phone ? ` - ${fullOrder.customer_phone}` : ''}${fullOrder.delivery_address ? ` - ${fullOrder.delivery_address}` : ''}${schedule ? ` - ${schedule}` : ''}`;
      }

      if (itemsTbody) {
        const number = value => window.api.formatMoney(value).replace(/\s*(₫|đ|VND)\s*$/i, '').trim();
        itemsTbody.innerHTML = items.map(item => `
          <tr>
            <td class="text-left">
              <strong>${this.escape(item.product_name)}</strong>
              ${item.variant_name ? ` (${this.escape(item.variant_name)})` : ''}
              ${(item.options || []).map(o => `<div>+${this.escape(o.option_name || o.name)}</div>`).join('')}
              ${item.note ? `<div>Ghi chú: ${this.escape(item.note)}</div>` : ''}
            </td>
            <td class="text-right">${this.escape(number(item.unit_price_with_options ?? (Number(item.unit_price || 0) + (item.options || []).reduce((sum, option) => sum + Number(option.extra_price ?? option.price ?? 0), 0))))}</td>
            <td class="text-center">${this.escape(item.quantity)}</td>
            <td class="text-right">${this.escape(number(item.subtotal))}</td>
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
      const methodRow = document.getElementById('receiptMethodRow');
      if (methodRow) methodRow.style.display = isUnpaid ? 'none' : 'flex';

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
      await this.loadReceiptQr(fullOrder, storeId, version);
      if (version !== this.renderVersion) return;
      if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại phiếu');
      this.receiptFooterText = [settings?.receipt_footer || 'Cảm ơn Quý khách & Hẹn gặp lại!', 'Phần mềm ThichGaPOS Multi-Store v1.0'].join('\n');
      // Plain Unicode is rendered to raster on Android; never send UTF-8 to the printer's legacy fonts.
      const money = value => window.api.formatMoney(value);
      this.receiptText = [
        currentStore?.name?.toUpperCase() || 'THÍCH GÀ POS', currentStore?.address,
        currentStore?.phone ? `Hotline: ${currentStore.phone}` : '',
        isUnpaid ? 'HÓA ĐƠN TẠM TÍNH' : 'HÓA ĐƠN THANH TOÁN',
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
        `${isUnpaid ? 'TỔNG TẠM TÍNH' : 'TỔNG CỘNG'}: ${money(fullOrder.total_amount)}`, isUnpaid ? '' : `Thanh toán: ${methodText}`,
        !isUnpaid && payMethod === 'CASH' && payment ? `Tiền khách đưa: ${money(payment.cash_received ?? fullOrder.total_amount)}\nTiền thối: ${money(payment.cash_return ?? change ?? 0)}` : '',
        fullOrder.note ? `Ghi chú đơn: ${fullOrder.note}` : '',
        this.receiptQrUrl ? 'Quét mã QR để thanh toán' : '',
        this.receiptQrUrl ? document.getElementById('receiptQrBank').textContent : '',
        this.receiptQrUrl ? document.getElementById('receiptQrAccount').textContent : '',
        this.receiptQrUrl ? document.getElementById('receiptQrMemo').textContent : '',
        this.receiptQrUrl ? '' : this.receiptFooterText
      ].filter(value => value !== undefined && value !== null && value !== '').join('\n');

      this.currentOrder = fullOrder;
      document.getElementById('receiptModal').style.display = 'flex';
      if (autoPrint && !fullOrder.isDraft) {
        await this.printReceipt({ auto: !forcePrint });
      } else {
        try {
          this.applyPrinterSettings(await this.loadPrinterSettings(storeId));
        } catch (error) {
          window.api.showToast(`Không thể tải cấu hình máy in: ${error.message}`, 'error');
        }
      }
    } catch (err) {
      if (version !== this.renderVersion) return;
      this.currentOrder = null;
      this.receiptText = '';
      window.api.showToast(`Không thể mở hóa đơn: ${err.message}`, 'error');
      console.error('showReceipt error:', err);
    }
  }
};
