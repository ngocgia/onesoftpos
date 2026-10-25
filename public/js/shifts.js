// OnesoftPOS v1.0 - Shifts Management Controller (Rule 34)

window.shiftsModule = {
  currentShift: null,

  init() {
    this.bindEvents();
    this.loadCurrentShift();

    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadCurrentShift();
      }
    });
  },

  bindEvents() {
    // Header shift badge click
    const btnShift = document.getElementById('btnShiftStatus');
    if (btnShift) {
      btnShift.addEventListener('click', () => this.openShiftModal());
    }

    // Close shift modal
    const btnCloseModal = document.getElementById('btnCloseShiftModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        document.getElementById('shiftModal').style.display = 'none';
      });
    }

    // Open new shift button
    const btnConfirmOpen = document.getElementById('btnConfirmOpenShift');
    if (btnConfirmOpen) {
      btnConfirmOpen.addEventListener('click', () => this.executeOpenShift());
    }

    // Close active shift button
    const btnConfirmClose = document.getElementById('btnConfirmCloseShift');
    if (btnConfirmClose) {
      btnConfirmClose.addEventListener('click', () => this.executeCloseShift());
    }
  },

  async loadCurrentShift() {
    try {
      const res = await window.api.get('/shifts/current');
      this.currentShift = res.shift || null;
      window.appState.currentShift = this.currentShift;
      this.updateHeaderBadge();
    } catch (err) {
      console.error('loadCurrentShift error:', err);
    }
  },

  updateHeaderBadge() {
    const badgeText = document.getElementById('shiftBadgeText');
    const badgeBtn = document.getElementById('btnShiftStatus');

    if (!badgeText) return;

    if (this.currentShift && this.currentShift.status === 'OPEN') {
      badgeText.textContent = `Ca mở: ${window.api.formatMoney(this.currentShift.opening_cash)}`;
      if (badgeBtn) {
        badgeBtn.style.background = 'var(--success-light)';
        badgeBtn.style.color = '#065f46';
      }
    } else {
      badgeText.textContent = 'Chưa mở ca';
      if (badgeBtn) {
        badgeBtn.style.background = 'var(--bg-muted)';
        badgeBtn.style.color = 'var(--text-muted)';
      }
    }
  },

  openShiftModal() {
    const modal = document.getElementById('shiftModal');
    const openPanel = document.getElementById('shiftOpenPanel');
    const closedPanel = document.getElementById('shiftClosedPanel');

    if (this.currentShift && this.currentShift.status === 'OPEN') {
      if (openPanel) openPanel.style.display = 'block';
      if (closedPanel) closedPanel.style.display = 'none';

      const openingCashEl = document.getElementById('shiftOpeningCash');
      const startTimeEl = document.getElementById('shiftStartTime');
      if (openingCashEl) openingCashEl.textContent = window.api.formatMoney(this.currentShift.opening_cash);
      if (startTimeEl) startTimeEl.textContent = new Date(this.currentShift.opening_time).toLocaleTimeString('vi-VN');
    } else {
      if (openPanel) openPanel.style.display = 'none';
      if (closedPanel) closedPanel.style.display = 'block';
    }

    if (modal) modal.style.display = 'flex';
  },

  async executeOpenShift() {
    const cashInput = document.getElementById('openingCashInput');
    const noteInput = document.getElementById('shiftOpenNote');

    const openingCash = parseFloat(cashInput?.value || 0);
    const notes = noteInput?.value || '';

    try {
      const res = await window.api.post('/shifts/open', { opening_cash: openingCash, notes });
      this.currentShift = res.shift;
      window.appState.currentShift = this.currentShift;
      this.updateHeaderBadge();
      window.api.showToast('Mở ca làm việc thành công!', 'success');
      document.getElementById('shiftModal').style.display = 'none';
    } catch (err) {
      window.api.showToast('Lỗi mở ca: ' + err.message, 'error');
    }
  },

  async executeCloseShift() {
    if (!this.currentShift) return;

    const closingInput = document.getElementById('closingCashInput');
    const noteInput = document.getElementById('shiftCloseNote');

    if (!closingInput?.value) {
      window.api.showToast('Vui lòng nhập tiền mặt thực tế khi đếm két', 'error');
      return;
    }

    const closingCash = parseFloat(closingInput.value);
    const notes = noteInput?.value || '';

    try {
      const res = await window.api.post(`/shifts/${this.currentShift.id}/close`, {
        closing_cash: closingCash,
        notes
      });

      const shift = res.shift;
      const diff = shift.difference || 0;
      let diffMsg = 'Khớp két 100%';
      if (diff > 0) diffMsg = `Dư +${window.api.formatMoney(diff)}`;
      if (diff < 0) diffMsg = `Thiếu ${window.api.formatMoney(diff)}`;

      alert(`ĐÃ KẾT CA THÀNH CÔNG!\n\nTiền đầu ca: ${window.api.formatMoney(shift.opening_cash)}\nTiền thực tế kết ca: ${window.api.formatMoney(shift.closing_cash)}\nChênh lệch két: ${diffMsg}`);

      this.currentShift = null;
      window.appState.currentShift = null;
      this.updateHeaderBadge();
      document.getElementById('shiftModal').style.display = 'none';
    } catch (err) {
      window.api.showToast('Lỗi kết ca: ' + err.message, 'error');
    }
  }
};
