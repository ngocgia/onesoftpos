/**
 * ThichGaPOS - More Menu Module (Menu Nhiều hơn)
 * Quản lý giao diện trung tâm chức năng "Nhiều hơn" và các cài đặt liên quan
 */

window.moreMenuModule = {
  maxPaymentQrImageLength: 2 * 1024 * 1024,
  defaultInvoiceOptions: { qr: true, notes: true, tax: true, checkIn: true, checkOut: true, staff: true, printCount: true, orderCode: true },
  // Cấu hình mặc định
  defaultPrinterSettings: {
    printerName: 'Máy in hóa đơn thu ngân (Mặc định)',
    paperSize: 'K80',
    connectionType: 'browser',
    ipAddress: '192.168.1.200',
    autoPrintOnPayment: true,
    autoPrintOrderSlipOnTransfer: false,
    autoCutPaper: true,
    openCashDrawer: true,
    printKitchenSeparate: true
  },

  defaultNumberSettings: {
    currencySymbol: '₫',
    symbolPosition: 'after', // 'after' | 'before'
    thousandSeparator: '.',  // '.' | ','
    rounding: 'none'         // 'none' | '100' | '1000'
  },

  defaultSpeakerSettings: {
    enableNewOrderSound: true,
    enableKitchenDoneSound: true,
    enableVietQRSpeech: true,
    volume: 85
  },

  init() {
    this.bindEvents();
    this.updateUserInfo();
    window.appState?.subscribe(event => {
      if (event === 'store_changed' || event === 'auth_updated' || event === 'role_features_updated') {
        this.updateUserInfo();
      }
    });
  },

  // Cập nhật thông tin User & Store trên Header của Hub
  updateUserInfo() {
    const user = window.appState?.user || {};
    const store = window.appState?.currentStore || {};

    const avatarEl = document.getElementById('moreUserAvatar');
    const nameEl = document.getElementById('moreUserName');
    const storeEl = document.getElementById('moreStoreName');
    const roleBadgeEl = document.getElementById('moreUserRoleBadge');

    if (avatarEl) {
      const name = user.full_name || user.username || 'Admin';
      const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      avatarEl.textContent = initials || 'AD';
    }

    if (nameEl) {
      nameEl.textContent = user.full_name || user.username || 'Quản trị viên';
    }

    if (storeEl) {
      storeEl.innerHTML = `<i class="fa-solid fa-store"></i> ${store.name || 'Chi nhánh Thích Gà POS'}`;
    }

    if (roleBadgeEl) {
      const roleMap = {
        'SUPER_ADMIN': 'Quản trị cấp cao',
        'ADMIN': 'Quản trị viên',
        'STORE_MANAGER': 'Quản lý cửa hàng',
        'CASHIER': 'Thu ngân',
        'ORDER_STAFF': 'Nhân viên order',
        'KITCHEN': 'Nhân viên bếp'
      };
      roleBadgeEl.textContent = roleMap[user.role] || user.role || 'Nhân viên';
    }

    // Hiển thị lối tắt quản lý cho các vai trò quản trị/quản lý
    const quickMgmtEl = document.getElementById('moreQuickManagement');
    if (quickMgmtEl) {
      const canManage = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(user.role);
      quickMgmtEl.style.display = canManage ? 'block' : 'none';
    }
  },

  // Mở màn hình Hub chính của Nhiều hơn
  showHub() {
    const hub = document.getElementById('moreMenuHub');
    const backHeader = document.getElementById('subviewBackHeader');
    const adminNav = document.querySelector('.admin-tabs-nav');

    if (hub) hub.style.display = 'block';
    if (backHeader) backHeader.style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';

    // Ẩn tất cả admin subviews
    document.querySelectorAll('.admin-subview').forEach(view => {
      view.classList.remove('active');
      view.style.display = 'none';
    });

    this.updateUserInfo();
  },

  // Mở một subview quản trị chi tiết (Báo cáo, Thực đơn, Kho, Phòng bàn...)
  openAdminSubview(targetId, title) {
    const hub = document.getElementById('moreMenuHub');
    const backHeader = document.getElementById('subviewBackHeader');
    const activeTitle = document.getElementById('subviewActiveTitle');
    const adminNav = document.querySelector('.admin-tabs-nav');

    if (hub) hub.style.display = 'none';
    if (backHeader) backHeader.style.display = 'flex';
    if (activeTitle) activeTitle.textContent = title || 'Quản lý';
    if (adminNav) adminNav.style.display = 'flex';

    // Đánh dấu subview active
    document.querySelectorAll('.admin-subview').forEach(view => {
      const isActive = view.id === targetId;
      view.classList.toggle('active', isActive);
      view.style.display = isActive ? 'block' : 'none';
    });

    // Cập nhật tab tương ứng
    document.querySelectorAll('.admin-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === targetId);
    });

    // Gọi hàm load dữ liệu tương ứng của adminModule
    if (targetId === 'adminReports' && window.adminModule) window.adminModule.loadReports();
    if (targetId === 'adminStores' && window.adminModule) window.adminModule.loadAdminStores();
    if (targetId === 'adminStoreTypes' && window.adminModule) window.adminModule.loadStoreRoleFeatures();
    if (targetId === 'adminProducts' && window.adminModule) window.adminModule.loadAdminProducts();
    if (targetId === 'adminTables' && window.tablesModule) window.tablesModule.loadAreasAndTables();
    if (targetId === 'adminStaff' && window.adminModule) window.adminModule.loadStaff();
    if (targetId === 'adminInventory' && window.adminModule) window.adminModule.loadInventory();
  },

  // Đăng ký các sự kiện click
  bindEvents() {
    // 1. Nút quay lại từ Subview về Hub
    document.getElementById('btnBackToMoreHub')?.addEventListener('click', () => {
      this.showHub();
    });

    // 2. Lối tắt quản lý nhanh
    document.querySelectorAll('.more-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.targetSubview;
        const title = btn.querySelector('span')?.textContent || 'Quản trị';
        this.openAdminSubview(target, title);
      });
    });

    // 3. NHÓM CỬA HÀNG (9 chức năng)
    document.getElementById('menuItemPrinter')?.addEventListener('click', () => this.openPrinterModal());
    document.getElementById('menuItemWorkflow')?.addEventListener('click', () => this.openWorkflowModal());
    document.getElementById('menuItemShipping')?.addEventListener('click', () => this.openShippingModal());
    document.getElementById('menuItemNumberFormat')?.addEventListener('click', () => this.openNumberFormatModal());
    document.getElementById('menuItemEInvoice')?.addEventListener('click', () => this.openEInvoiceModal());
    document.getElementById('menuItemWebsite')?.addEventListener('click', () => this.openWebsiteModal());
    document.getElementById('menuItemLoyalty')?.addEventListener('click', () => this.openLoyaltyModal());
    document.getElementById('btnHistoryBackToMore')?.addEventListener('click', () => window.appNavigation.switchView('viewAdmin'));
    document.getElementById('menuItemOrderHistory')?.addEventListener('click', () => window.appNavigation.switchView('viewOrders'));
    document.getElementById('menuItemSpeaker')?.addEventListener('click', () => this.openSpeakerModal());

    // 4. NHÓM TÀI KHOẢN (5 chức năng như hình 2)
    document.getElementById('menuItemStores')?.addEventListener('click', () => this.openStoreListModal());
    document.getElementById('menuItemPassword')?.addEventListener('click', () => this.openPasswordModal());
    document.getElementById('menuItemAccount')?.addEventListener('click', () => this.openAccountModal());
    document.getElementById('menuItemDeleteAccount')?.addEventListener('click', () => this.openDeleteAccountModal());
    document.getElementById('menuItemLogout')?.addEventListener('click', () => this.handleLogout());

    // Đóng các modal khi nhấn nút x hoặc nút Hủy
    document.querySelectorAll('.btn-close-more-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.style.display = 'none';
      });
    });
  },

  // ==================== CÁC CHỨC NĂNG CỤ THỂ ====================

  // 1. Cài đặt máy in
  openPrinterModal() {
    const saved = window.menuPersistence.read('printer', this.defaultPrinterSettings);
    const modal = document.getElementById('printerSettingsModal');
    if (!modal) return;

    document.getElementById('printerPaperSize').value = saved.paperSize || 'K80';
    document.getElementById('printerConnectionType').value = saved.connectionType || 'browser';
    document.getElementById('printerIpAddress').value = saved.ipAddress || '192.168.1.200';
    document.getElementById('printerAutoPrint').checked = !!saved.autoPrintOnPayment;
    document.getElementById('printerAutoPrintOrderSlip').checked = !!saved.autoPrintOrderSlipOnTransfer;
    document.getElementById('printerAutoCut').checked = !!saved.autoCutPaper;
    document.getElementById('printerKitchenSeparate').checked = !!saved.printKitchenSeparate;

    this.printerDraft = this.normalizePrinterProfiles(saved);
    this.paymentQrDraft = { source: 'vietqr', image: '', ...saved.paymentQr };
    this.qrUploadPending = false;
    document.getElementById('paymentQrSource').value = this.paymentQrDraft.source;
    document.getElementById('paymentQrFile').value = '';
    this.updatePaymentQrEditor();
    for (const [key, fallback] of Object.entries(this.defaultInvoiceOptions)) {
      document.getElementById(`invoiceOption-${key}`).checked = saved.invoiceOptions?.[key] ?? fallback;
    }
    for (const kind of ['invoice', 'label', 'barcode', 'kitchen']) {
      this.populatePrinterProfile(kind);
    }

    modal.style.display = 'flex';
  },

  normalizePrinterProfiles(saved) {
    const profiles = {};
    for (const [kind, name] of Object.entries({ invoice: 'Máy in hóa đơn', label: 'Máy in tem món', barcode: 'Máy in mã vạch', kitchen: 'Máy in bếp' })) {
      const legacy = kind === 'invoice';
      profiles[kind] = { configured: legacy, enabled: legacy, name, paperSize: legacy ? saved.paperSize : 'K80',
        connectionType: legacy ? saved.connectionType : 'browser', ipAddress: legacy ? saved.ipAddress : '',
        autoCutPaper: legacy ? saved.autoCutPaper : true, ...(saved.profiles?.[kind] || {}) };
    }
    return profiles;
  },

  updatePaymentQrEditor() {
    this.paymentQrDraft.source = document.getElementById('paymentQrSource').value;
    document.getElementById('paymentQrUpload').hidden = this.paymentQrDraft.source !== 'upload';
    const preview = document.getElementById('paymentQrPreview');
    preview.hidden = !this.paymentQrDraft.image;
    if (this.paymentQrDraft.image) preview.src = this.paymentQrDraft.image;
    else preview.removeAttribute?.('src');
  },

  removePaymentQrImage() {
    this.paymentQrUploadVersion = (this.paymentQrUploadVersion || 0) + 1;
    this.qrUploadPending = false;
    this.paymentQrDraft.image = '';
    document.getElementById('paymentQrFile').value = '';
    this.updatePaymentQrEditor();
  },

  async uploadPaymentQr(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const draft = this.paymentQrDraft;
    const storeId = window.api.getCurrentStoreId();
    const version = this.paymentQrUploadVersion = (this.paymentQrUploadVersion || 0) + 1;
    this.qrUploadPending = true;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        throw new Error('Chọn ảnh PNG, JPG hoặc WebP, tối đa 10MB');
      }
      const source = await new Promise((resolve, reject) => {
        const reader = new window.FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không đọc được tệp ảnh'));
        reader.readAsDataURL(file);
      });
      const image = new window.Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Ảnh không hợp lệ hoặc đã bị hỏng'));
        image.src = source;
      });
      if (!image.width || !image.height || image.width * image.height > 24000000) throw new Error('Ảnh quá lớn; vui lòng cắt gọn vùng mã QR');
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Keep small uploads intact: re-encoding a small JPEG as PNG can enlarge it.
      let encoded = source.length <= this.maxPaymentQrImageLength ? source : canvas.toDataURL('image/png');
      if (encoded.length > this.maxPaymentQrImageLength) encoded = canvas.toDataURL('image/jpeg', 0.9);
      if (encoded.length > this.maxPaymentQrImageLength) throw new Error('Ảnh QR sau xử lý vẫn quá lớn; vui lòng chọn ảnh nhỏ hơn');
      if (version !== this.paymentQrUploadVersion || draft !== this.paymentQrDraft || storeId !== window.api.getCurrentStoreId()) return;
      draft.image = encoded;
      this.updatePaymentQrEditor();
      window.api.showToast('Đã chọn ảnh QR. Bấm Lưu để áp dụng cho cửa hàng', 'success');
    } catch (error) {
      if (version === this.paymentQrUploadVersion && draft === this.paymentQrDraft && storeId === window.api.getCurrentStoreId()) window.api.showToast(error.message, 'error');
    } finally {
      if (version === this.paymentQrUploadVersion && draft === this.paymentQrDraft) this.qrUploadPending = false;
    }
  },

  printerFieldId(kind, suffix) {
    return `printer${kind === 'invoice' ? '' : kind}${suffix}`;
  },

  populatePrinterProfile(kind) {
    const profile = this.printerDraft[kind];
    for (const [suffix, key] of Object.entries({ Name: 'name', PaperSize: 'paperSize', ConnectionType: 'connectionType', IpAddress: 'ipAddress' })) {
      document.getElementById(this.printerFieldId(kind, suffix)).value = key === 'connectionType' && profile[key] === 'network' ? 'lan' : profile[key] || '';
    }
    document.getElementById(this.printerFieldId(kind, 'AutoCut')).checked = !!profile.autoCutPaper;
    document.getElementById(`printerEnabled-${kind}`).checked = !!profile.enabled;
    document.getElementById(`printerEditor-${kind}`).hidden = true;
    this.renderPrinterProfile(kind);
  },

  renderPrinterProfile(kind) {
    const profile = this.printerDraft[kind];
    document.getElementById(`printerDevice-${kind}`).hidden = !profile.configured;
    document.getElementById(`printerEmpty-${kind}`).hidden = profile.configured;
    document.getElementById(`printerName-${kind}`).textContent = profile.name;
    document.getElementById(`printerAddress-${kind}`).textContent = ['lan', 'network'].includes(profile.connectionType)
      ? profile.ipAddress : ({ browser: 'Trình duyệt', usb: 'USB / OTG', bluetooth: 'Bluetooth', rawbt: 'RawBT' }[profile.connectionType] || '');
  },

  editPrinter(kind) {
    this.printerDraft[kind].configured = true;
    document.getElementById(`printerEditor-${kind}`).hidden = false;
    this.renderPrinterProfile(kind);
    document.getElementById(this.printerFieldId(kind, 'Name')).focus?.();
  },

  removePrinter(kind) {
    this.printerDraft[kind].configured = false;
    this.printerDraft[kind].enabled = false;
    document.getElementById(`printerEnabled-${kind}`).checked = false;
    document.getElementById(`printerEditor-${kind}`).hidden = true;
    this.renderPrinterProfile(kind);
  },

  testPrinter(kind) {
    return this.testPrintBill(kind);
  },

  getPrinterSettingsFromForm() {
    const settings = {
      paperSize: document.getElementById('printerPaperSize').value,
      connectionType: document.getElementById('printerConnectionType').value,
      ipAddress: document.getElementById('printerIpAddress').value,
      autoPrintOnPayment: document.getElementById('printerAutoPrint').checked,
      autoPrintOrderSlipOnTransfer: document.getElementById('printerAutoPrintOrderSlip').checked,
      autoCutPaper: document.getElementById('printerAutoCut').checked,
      printKitchenSeparate: document.getElementById('printerKitchenSeparate').checked
    };
    settings.invoiceOptions = Object.fromEntries(Object.keys(this.defaultInvoiceOptions)
      .map(key => [key, document.getElementById(`invoiceOption-${key}`).checked]));
    if (this.qrUploadPending) throw new Error('Ảnh QR đang được xử lý; vui lòng chờ');
    if (this.paymentQrDraft) {
      settings.paymentQr = { ...this.paymentQrDraft };
      if (settings.invoiceOptions.qr && settings.paymentQr.source === 'upload' && !settings.paymentQr.image) throw new Error('Vui lòng tải ảnh QR thanh toán lên');
    }
    if (this.printerDraft) {
      for (const [kind, profile] of Object.entries(this.printerDraft)) {
        for (const [suffix, key] of Object.entries({ Name: 'name', PaperSize: 'paperSize', ConnectionType: 'connectionType', IpAddress: 'ipAddress' })) {
          profile[key] = document.getElementById(this.printerFieldId(kind, suffix)).value.trim();
        }
        profile.autoCutPaper = document.getElementById(this.printerFieldId(kind, 'AutoCut')).checked;
        profile.enabled = document.getElementById(`printerEnabled-${kind}`).checked;
        if (profile.enabled && !profile.configured) throw new Error('Vui lòng thêm máy in trước khi bật');
      }
      settings.profiles = JSON.parse(JSON.stringify(this.printerDraft));
    }
    return settings;
  },

  async savePrinterSettings() {
    const settings = this.getPrinterSettingsFromForm();
    await window.menuPersistence.save('printer', settings);
    document.getElementById('printerSettingsModal').style.display = 'none';
    window.api?.showToast('Đã lưu cấu hình máy in thành công', 'success');
  },

  async testPrintBill(kind = 'invoice') {
    try {
      await window.menuPersistence.save('printer', this.getPrinterSettingsFromForm());
      document.getElementById('printerSettingsModal').style.display = 'none';
      const invoice = window.invoiceModule;
      await invoice.showReceipt({
        isDraft: true, order_code: 'IN-THU-TIENG-VIET', created_at: new Date().toISOString(),
        order_type: 'DINE_IN', table_code: 'B01', cashier_name: 'Nguyễn Thị Ánh',
        subtotal: 65000, discount_amount: 5000, tax_amount: 3000, total_amount: 63000,
        note: 'KIỂM TRA: ă â đ ê ô ơ ư – Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự',
        items: [
          { product_name: 'Gà rán giòn cay sốt phô mai đặc biệt', quantity: 1, unit_price: 35000, subtotal: 40000,
            options: [{ option_name: 'Thêm phô mai', price: 5000 }], note: 'Ít cay, không hành' },
          { product_name: 'Trà đào cam sả', quantity: 1, unit_price: 25000, subtotal: 25000 }
        ]
      });
      if (invoice.currentOrder?.order_code === 'IN-THU-TIENG-VIET') await invoice.printReceipt({ printerKind: kind, test: true });
    } catch (error) {
      window.api.showToast('Không thể in thử: ' + error.message, 'error');
    }
  },
  // 2. Quy trình bán hàng
  openWorkflowModal() {
    const modal = document.getElementById('workflowSettingsModal');
    if (!modal) return;
    const features = window.appState?.features || {};
    document.getElementById('wfDineIn').checked = features.enableDineIn !== false;
    document.getElementById('wfTakeaway').checked = features.enableTakeaway !== false;
    document.getElementById('wfDelivery').checked = features.enableDelivery !== false;
    document.getElementById('wfKds').checked = features.enableKds !== false;
    modal.style.display = 'flex';
  },


  goToAdvancedWorkflow() {
    document.getElementById('workflowSettingsModal').style.display = 'none';
    this.openAdminSubview('adminStoreTypes', 'Luồng & Phân quyền');
  },

  // 3. Đối tác vận chuyển
  openShippingModal() {
    const modal = document.getElementById('shippingPartnersModal');
    if (!modal) return;
    modal.style.display = 'flex';
  },


  // 4. Định dạng số
  openNumberFormatModal() {
    const saved = window.menuPersistence.read('number', this.defaultNumberSettings);
    const modal = document.getElementById('numberFormatModal');
    if (!modal) return;

    document.getElementById('fmtCurrencySymbol').value = saved.currencySymbol || '₫';
    document.getElementById('fmtSymbolPosition').value = saved.symbolPosition || 'after';
    document.getElementById('fmtThousandSep').value = saved.thousandSeparator || '.';
    document.getElementById('fmtRounding').value = saved.rounding || 'none';

    this.updateNumberPreview();
    modal.style.display = 'flex';
  },

  updateNumberPreview() {
    const symbol = document.getElementById('fmtCurrencySymbol')?.value || '₫';
    const pos = document.getElementById('fmtSymbolPosition')?.value || 'after';
    const sep = document.getElementById('fmtThousandSep')?.value || '.';
    const amountStr = `150${sep}000`;
    const preview = pos === 'after' ? `${amountStr} ${symbol}` : `${symbol} ${amountStr}`;
    const el = document.getElementById('fmtPreviewText');
    if (el) el.textContent = preview;
  },

  async saveNumberFormat() {
    const settings = {
      currencySymbol: document.getElementById('fmtCurrencySymbol').value,
      symbolPosition: document.getElementById('fmtSymbolPosition').value,
      thousandSeparator: document.getElementById('fmtThousandSep').value,
      rounding: document.getElementById('fmtRounding').value
    };
    await window.menuPersistence.save('number', settings);
    document.getElementById('numberFormatModal').style.display = 'none';
    window.api?.showToast('Đã lưu định dạng số hiển thị', 'success');
  },

  // 5. Hóa đơn điện tử
  openEInvoiceModal() {
    const modal = document.getElementById('einvoiceSettingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
  },



  // 6. Website cửa hàng & QR
  openWebsiteModal() {
    const modal = document.getElementById('storeWebsiteModal');
    if (!modal) return;
    const store = window.appState?.currentStore || {};
    const code = store.code || 'thichga';
    const url = `${window.location.origin}/?store=${encodeURIComponent(code)}&mode=menu`;

    const urlInput = document.getElementById('storeWebsiteUrl');
    if (urlInput) urlInput.value = url;

    const qrImg = document.getElementById('storeWebsiteQrImage');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    }

    modal.style.display = 'flex';
  },

  copyWebsiteUrl() {
    const urlInput = document.getElementById('storeWebsiteUrl');
    if (urlInput) {
      navigator.clipboard.writeText(urlInput.value).then(() => {
        window.api?.showToast('Đã sao chép liên kết website vào bộ nhớ tạm', 'success');
      }).catch(() => {
        urlInput.select();
        document.execCommand('copy');
        window.api?.showToast('Đã sao chép liên kết website', 'success');
      });
    }
  },

  // 7. Tích điểm và khuyến mãi
  openLoyaltyModal() {
    const modal = document.getElementById('loyaltySettingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
  },


  // 8. Loa thông báo (Audio Beep & SpeechSynthesis)
  openSpeakerModal() {
    const saved = window.menuPersistence.read('speaker', this.defaultSpeakerSettings);
    const modal = document.getElementById('speakerSettingsModal');
    if (!modal) return;

    document.getElementById('spkNewOrder').checked = !!saved.enableNewOrderSound;
    document.getElementById('spkKitchenDone').checked = !!saved.enableKitchenDoneSound;
    document.getElementById('spkVietQR').checked = !!saved.enableVietQRSpeech;
    document.getElementById('spkVolume').value = saved.volume ?? 85;
    document.getElementById('spkVolumeLabel').textContent = `${saved.volume ?? 85}%`;

    modal.style.display = 'flex';
  },

  testOrderSound() {
    return window.audioModule.beep({ force: true, volume: document.getElementById('spkVolume')?.value ?? 85 });
  },

  testSpeechVietQR() {
    return window.audioModule.speak('Đã nhận thành công một trăm năm mươi nghìn đồng qua VietQR.', {
      kind: 'qr', force: true, volume: document.getElementById('spkVolume')?.value ?? 85
    });
  },
  async saveSpeakerSettings() {
    const settings = {
      enableNewOrderSound: document.getElementById('spkNewOrder').checked,
      enableKitchenDoneSound: document.getElementById('spkKitchenDone').checked,
      enableVietQRSpeech: document.getElementById('spkVietQR').checked,
      volume: parseInt(document.getElementById('spkVolume').value, 10)
    };
    await window.menuPersistence.save('speaker', settings);
    document.getElementById('speakerSettingsModal').style.display = 'none';
    window.api?.showToast('Đã lưu cài đặt loa thông báo', 'success');
  },

  // 10. Danh sách cửa hàng
  async openStoreListModal() {
    const modal = document.getElementById('storeListModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const container = document.getElementById('storeListContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center" style="padding:24px"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách cửa hàng...</div>';

    try {
      const res = await window.api.get('/stores');
      const stores = res.stores || [];
      window.appState.stores = stores;
      const currentStoreId = String(window.appState?.currentStore?.id || '');

      if (!stores.length) {
        container.innerHTML = '<p class="text-muted text-center">Chưa có danh sách cửa hàng</p>';
        return;
      }

      container.innerHTML = stores.map(st => {
        const isCurrent = String(st.id) === currentStoreId;
        return `
          <div class="store-select-card ${isCurrent ? 'active-store' : ''}">
            <div class="store-card-left">
              <div class="store-card-icon"><i class="fa-solid fa-store"></i></div>
              <div class="store-card-info">
                <div class="store-card-name">
                  <strong>${st.name}</strong>
                  ${isCurrent ? '<span class="badge-pill store-type-pill" style="margin-left:6px;background:#10b981;color:#fff">Đang chọn</span>' : ''}
                </div>
                <div class="text-muted" style="font-size:12px;margin-top:2px"><i class="fa-solid fa-location-dot"></i> ${st.address || 'Chưa cập nhật địa chỉ'}</div>
                <div class="text-muted" style="font-size:12px"><i class="fa-solid fa-phone"></i> ${st.phone || '-'}</div>
              </div>
            </div>
            <div class="store-card-right">
              ${isCurrent 
                ? '<button class="btn-secondary btn-sm" disabled><i class="fa-solid fa-check"></i> Đang dùng</button>' 
                : `<button type="button" class="btn-primary btn-sm" onclick="moreMenuModule.switchCurrentStore(${st.id})">Chuyển sang</button>`
              }
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = '<p class="text-danger text-center">Không thể tải danh sách cửa hàng</p>';
    }
  },

  async switchCurrentStore(storeId) {
    try {
      const targetStore = (window.appState?.stores || []).find(store => Number(store.id) === Number(storeId));
      if (!targetStore) throw new Error('Cửa hàng không nằm trong danh sách được phép truy cập');
      if (Number(window.appState.currentStore?.id) === Number(storeId)) return;
      await window.api.put('/auth/preferences/current_store', { store_id: Number(targetStore.id) });
      window.api.setCurrentStoreId(targetStore.id);
      window.api?.showToast('Đang chuyển đổi cửa hàng...', 'info');
      document.getElementById('storeListModal').style.display = 'none';
      // Restart cart, permissions and modules in the new store context.
      window.location.reload();
    } catch (e) {
      window.api?.showToast('Không thể chuyển cửa hàng: ' + e.message, 'error');
    }
  },

  // 11. Đổi mật khẩu
  openPasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) return;
    document.getElementById('inputOldPassword').value = '';
    document.getElementById('inputNewPassword').value = '';
    document.getElementById('inputConfirmPassword').value = '';
    modal.style.display = 'flex';
  },

  async handleChangePassword() {
    const oldP = document.getElementById('inputOldPassword').value;
    const newP = document.getElementById('inputNewPassword').value;
    const confirmP = document.getElementById('inputConfirmPassword').value;

    if (!oldP) {
      window.api?.showToast('Vui lòng nhập mật khẩu hiện tại', 'warning');
      return;
    }
    if (!newP || newP.length < 6) {
      window.api?.showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'warning');
      return;
    }
    if (newP !== confirmP) {
      window.api?.showToast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }

    await window.api.put('/auth/password', { old_password: oldP, new_password: newP });
    document.getElementById('changePasswordModal').style.display = 'none';
    window.api?.showToast('Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới!', 'success');
  },

  // 12. Thông tin tài khoản
  openAccountModal() {
    const modal = document.getElementById('accountInfoModal');
    if (!modal) return;
    const user = window.appState?.user || {};
    const store = window.appState?.currentStore || {};

    document.getElementById('accFullName').textContent = user.full_name || 'Quản trị viên';
    document.getElementById('accUsername').textContent = user.username || 'admin';
    document.getElementById('accEmail').textContent = user.email || 'admin@thichgapos.com';
    document.getElementById('accPhone').textContent = user.phone || '0900000001';
    document.getElementById('accRole').textContent = user.role || 'SUPER_ADMIN';
    document.getElementById('accStore').textContent = store.name || 'Chi nhánh Thích Gà POS';

    if (window.headerCustomizer) {
      window.headerCustomizer.openInAccountModal('general');
    }

    modal.style.display = 'flex';
  },

  // 13. Xóa tài khoản
  openDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    if (!modal) return;
    modal.style.display = 'flex';
  },


  // 14. Đăng xuất
  handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống Thích Gà POS?')) {
      window.api?.removeToken();
      window.api?.setCurrentStoreId('');
      window.location.replace('/?mode=pos');
    }
  }
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.moreMenuModule.init();
});
