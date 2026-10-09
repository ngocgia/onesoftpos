// Database-backed menu settings. Local storage is no longer the source of truth.
window.menuPersistence = {
  settings: {},
  storeId: null,
  defaults: {
    shipping: { ahamove: true, grab: true, be: true, ghtk: false, own: true, fee: 15000 },
    einvoice: { provider: 'vnpt', taxCode: '', template: '1/001', series: '1C26TAA', autoIssue: false },
    website: { allowOrdering: false },
    loyalty: { enabled: false, earnAmount: 10000, redeemAmount: 1000, combineVoucher: false }
  },
  fields: {
    workflow: { enableDineIn: 'wfDineIn', enableTakeaway: 'wfTakeaway', enableDelivery: 'wfDelivery', enableKds: 'wfKds' },
    shipping: { ahamove: 'shipAhamove', grab: 'shipGrab', be: 'shipBe', ghtk: 'shipGhtk', own: 'shipOwn', fee: 'shipFee' },
    einvoice: { provider: 'eiProvider', taxCode: 'eiTaxCode', template: 'eiTemplate', series: 'eiSeries', autoIssue: 'eiAutoIssue' },
    website: { allowOrdering: 'websiteAllowOrdering' },
    loyalty: { enabled: 'loyaltyEnabled', earnAmount: 'loyaltyEarnAmount', redeemAmount: 'loyaltyRedeemAmount', combineVoucher: 'loyaltyCombineVoucher' }
  },
  async loadStore() {
    const storeId = window.api.getCurrentStoreId();
    const result = await window.api.get('/store/menu-settings');
    if (storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại cài đặt');
    this.storeId = storeId;
    this.settings = result.settings || {};
  },
  async loadHeader() {
    const customizer = window.headerCustomizer;
    if (customizer) {
      customizer.currentSettings = { ...customizer.defaultSettings };
      customizer.applySettings(customizer.currentSettings);
    }
    const result = await window.api.get('/auth/preferences/header');
    if (customizer) {
      customizer.currentSettings = { ...customizer.defaultSettings, ...(result.settings || {}) };
      customizer.applySettings(customizer.currentSettings);
    }
  },
  read(section, fallback) {
    return { ...fallback, ...(this.settings[section] || {}) };
  },
  populate(section) {
    const settings = section === 'workflow' ? this.settings[section] : { ...this.defaults[section], ...this.settings[section] };
    if (!settings) return;
    for (const [key, id] of Object.entries(this.fields[section] || {})) {
      const input = document.getElementById(id);
      if (input.type === 'checkbox') input.checked = settings[key];
      else input.value = settings[key];
    }
  },
  collect(section) {
    return Object.fromEntries(Object.entries(this.fields[section]).map(([key, id]) => {
      const input = document.getElementById(id);
      return [key, input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value];
    }));
  },
  async save(section, settings) {
    if (this.storeId !== window.api.getCurrentStoreId()) throw new Error('Cửa hàng đã thay đổi; vui lòng mở lại cài đặt');
    const result = await window.api.put(`/store/menu-settings/${section}`, settings);
    this.settings[section] = result.settings;
  },
  async saveForm(section, modalId) {
    await this.save(section, this.collect(section));
    if (section === 'workflow') await window.appNavigation.reloadCurrentStoreFeatures();
    document.getElementById(modalId).style.display = 'none';
    window.api.showToast('Đã lưu cấu hình vào database', 'success');
  },
  install() {
    const menu = window.moreMenuModule;
    const openings = { openPrinterModal: 'printer', openWorkflowModal: 'workflow', openShippingModal: 'shipping', openNumberFormatModal: 'number', openEInvoiceModal: 'einvoice', openWebsiteModal: 'website', openLoyaltyModal: 'loyalty', openSpeakerModal: 'speaker' };
    for (const [method, section] of Object.entries(openings)) {
      const original = menu[method];
      menu[method] = async (...args) => {
        try {
          await this.loadStore();
          original.apply(menu, args);
          this.populate(section);
          const modal = document.getElementById({ printer: 'printerSettingsModal', workflow: 'workflowSettingsModal', shipping: 'shippingPartnersModal', number: 'numberFormatModal', einvoice: 'einvoiceSettingsModal', website: 'storeWebsiteModal', loyalty: 'loyaltySettingsModal', speaker: 'speakerSettingsModal' }[section]);
          if (modal) modal.querySelectorAll('button[onclick*="save"]').forEach(button => { button.disabled = !['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(window.appState.user?.role); });
        } catch (error) { window.api.showToast(error.message, 'error'); }
      };
    }
    for (const [method, section, modal] of [
      ['saveWorkflowSettings', 'workflow', 'workflowSettingsModal'], ['saveShippingSettings', 'shipping', 'shippingPartnersModal'],
      ['saveEInvoiceSettings', 'einvoice', 'einvoiceSettingsModal'], ['saveWebsiteSettings', 'website', 'storeWebsiteModal'],
      ['saveLoyaltySettings', 'loyalty', 'loyaltySettingsModal']
    ]) menu[method] = () => this.saveForm(section, modal);
    menu.testEInvoiceConnection = () => window.api.showToast('Cấu hình được lưu; chưa có kết nối nhà cung cấp để kiểm tra hoặc phát hành hóa đơn', 'info');
    menu.handleConfirmDeleteAccount = async () => {
      await window.api.put('/auth/preferences/deletion_request', { status: 'PENDING', reason: document.getElementById('deleteAccountReason').value.trim() });
      document.getElementById('deleteAccountModal').style.display = 'none';
      window.api.showToast('Đã lưu yêu cầu xóa tài khoản, chờ quản trị viên xử lý', 'success');
    };
    menu.openDeleteAccountModal = async () => {
      try {
        const result = await window.api.get('/auth/preferences/deletion_request');
        document.getElementById('deleteAccountReason').value = result.settings?.reason || '';
        document.getElementById('deleteAccountRequestStatus').textContent = result.settings ? 'Bạn đã có yêu cầu đang chờ xử lý. Gửi lại để cập nhật lý do.' : '';
        document.getElementById('deleteAccountModal').style.display = 'flex';
      } catch (error) { window.api.showToast(error.message, 'error'); }
    };
    // Keep dialogs open on failure and block duplicate submissions.
    for (const method of ['savePrinterSettings', 'saveWorkflowSettings', 'saveShippingSettings', 'saveNumberFormat', 'saveEInvoiceSettings', 'saveWebsiteSettings', 'saveLoyaltySettings', 'saveSpeakerSettings', 'handleChangePassword', 'handleConfirmDeleteAccount']) {
      const original = menu[method];
      let pending = false;
      menu[method] = async (...args) => {
        if (pending) return;
        pending = true;
        try { await original.apply(menu, args); }
        catch (error) { window.api.showToast(error.message, 'error'); }
        finally { pending = false; }
      };
    }
  }
};
window.menuPersistence.install();
