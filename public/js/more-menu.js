/**
 * ThichGaPOS - More Menu Module (Menu Nhiều hơn)
 * Quản lý giao diện trung tâm chức năng "Nhiều hơn" và các cài đặt liên quan
 */

window.moreMenuModule = {
  // Cấu hình mặc định
  defaultPrinterSettings: {
    printerName: 'Máy in hóa đơn thu ngân (Mặc định)',
    paperSize: 'K80',
    connectionType: 'browser',
    ipAddress: '192.168.1.200',
    autoPrintOnPayment: true,
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
    document.getElementById('printerAutoCut').checked = !!saved.autoCutPaper;
    document.getElementById('printerKitchenSeparate').checked = !!saved.printKitchenSeparate;

    modal.style.display = 'flex';
  },

  async savePrinterSettings() {
    const settings = {
      paperSize: document.getElementById('printerPaperSize').value,
      connectionType: document.getElementById('printerConnectionType').value,
      ipAddress: document.getElementById('printerIpAddress').value,
      autoPrintOnPayment: document.getElementById('printerAutoPrint').checked,
      autoCutPaper: document.getElementById('printerAutoCut').checked,
      printKitchenSeparate: document.getElementById('printerKitchenSeparate').checked
    };
    await window.menuPersistence.save('printer', settings);
    document.getElementById('printerSettingsModal').style.display = 'none';
    window.api?.showToast('Đã lưu cấu hình máy in thành công', 'success');
  },

  testPrintBill() {
    window.api?.showToast('Đang gửi lệnh in thử tới máy in...', 'info');
    const store = window.appState?.currentStore || {};
    const size = document.getElementById('printerPaperSize')?.value || 'K80';
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      window.api?.showToast('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.', 'warning');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>In Thử Hóa Đơn</title>
        <style>
          body { font-family: monospace; font-size: ${size === 'K58' ? '11px' : '13px'}; padding: 10px; width: ${size === 'K58' ? '54mm' : '76mm'}; margin: 0 auto; }
          .text-center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h3 style="margin:0">${store.name || 'THÍCH GÀ POS'}</h3>
          <p style="margin:2px 0">${store.address || 'Hệ thống Quán Gà & Đồ Ăn Nhanh'}</p>
          <p style="margin:2px 0">Hotline: ${store.phone || '1900 6868'}</p>
          <div class="divider"></div>
          <strong>PHIẾU IN KIỂM TRA MÁY IN</strong>
          <p style="font-size:11px;margin:2px 0">${new Date().toLocaleString('vi-VN')}</p>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Khổ giấy:</span><strong>${size}</strong></div>
        <div class="row"><span>Trạng thái:</span><strong>KẾT NỐI TỐT</strong></div>
        <div class="divider"></div>
        <div class="row"><span>1x Gà Rán Giòn Cay</span><span>35.000đ</span></div>
        <div class="row"><span>1x Trà Đào Cam Sả</span><span>25.000đ</span></div>
        <div class="divider"></div>
        <div class="row" style="font-size:14px;font-weight:bold"><span>TỔNG TIỀN:</span><span>60.000đ</span></div>
        <div class="divider"></div>
        <div class="text-center" style="margin-top:12px">
          <p>Máy in hoạt động hoàn hảo!</p>
          <p>Cảm ơn quý khách!</p>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
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
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      // Phát 2 nốt beep chuông vui tươi
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.15); // A5
      gain2.gain.setValueAtTime(0.3, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);

      window.api?.showToast('Đang phát chuông đơn hàng mới', 'info');
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  },

  testSpeechVietQR() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = 'Đã nhận thành công một trăm năm mươi nghìn đồng qua VietQR.';
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'vi-VN';
      utter.rate = 1.0;
      const vol = (parseInt(document.getElementById('spkVolume')?.value || '85', 10)) / 100;
      utter.volume = Math.max(0.1, Math.min(1.0, vol));
      window.speechSynthesis.speak(utter);
      window.api?.showToast('Đang đọc giọng nói mẫu thông báo VietQR...', 'info');
    } else {
      window.api?.showToast('Trình duyệt không hỗ trợ phát giọng nói SpeechSynthesis', 'warning');
    }
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
      window.location.replace('/');
    }
  }
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.moreMenuModule.init();
});
