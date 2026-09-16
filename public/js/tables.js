// ThichGaPOS v1.0 - Tables & Floor Plan Controller (Rule 21, 22, 23)

window.tablesModule = {
  areas: [],
  tables: [],
  selectedAreaId: 'all',
  activeTableForAction: null,

  async init() {
    this.bindEvents();
    await this.loadAreasAndTables();

    // Subscribe to state updates
    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.loadAreasAndTables();
      }
    });
  },

  bindEvents() {
    // Close table action modal
    const btnCloseModal = document.getElementById('btnCloseTableActionModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        document.getElementById('tableActionModal').style.display = 'none';
      });
    }

    // Action: Open POS for table
    const btnActionPos = document.getElementById('btnActionOpenPos');
    if (btnActionPos) {
      btnActionPos.addEventListener('click', () => {
        if (this.activeTableForAction) {
          window.appState.setSelectedTable(this.activeTableForAction);
          document.getElementById('tableActionModal').style.display = 'none';
          window.appNavigation.switchView('viewPos');
        }
      });
    }

    // Action: Transfer Table (Rule 22)
    const btnActionTransfer = document.getElementById('btnActionTransfer');
    const transferSubpanel = document.getElementById('transferSubpanel');
    const mergeSubpanel = document.getElementById('mergeSubpanel');

    if (btnActionTransfer) {
      btnActionTransfer.addEventListener('click', () => {
        if (mergeSubpanel) mergeSubpanel.style.display = 'none';
        if (transferSubpanel) {
          transferSubpanel.style.display = transferSubpanel.style.display === 'block' ? 'none' : 'block';
          this.populateTransferTargets();
        }
      });
    }

    const btnConfirmTransfer = document.getElementById('btnConfirmTransfer');
    if (btnConfirmTransfer) {
      btnConfirmTransfer.addEventListener('click', () => this.confirmTransfer());
    }

    // Action: Merge Tables (Rule 23)
    const btnActionMerge = document.getElementById('btnActionMerge');
    if (btnActionMerge) {
      btnActionMerge.addEventListener('click', () => {
        if (transferSubpanel) transferSubpanel.style.display = 'none';
        if (mergeSubpanel) {
          mergeSubpanel.style.display = mergeSubpanel.style.display === 'block' ? 'none' : 'block';
          this.populateMergeTargets();
        }
      });
    }

    const btnConfirmMerge = document.getElementById('btnConfirmMerge');
    if (btnConfirmMerge) {
      btnConfirmMerge.addEventListener('click', () => this.confirmMerge());
    }
  },

  async loadAreasAndTables() {
    try {
      const [areaRes, tableRes] = await Promise.all([
        window.api.get('/areas'),
        window.api.get('/tables')
      ]);

      this.areas = areaRes.areas || [];
      this.tables = tableRes.tables || [];

      this.renderAreaTabs();
      this.renderTables();
    } catch (err) {
      console.error('loadAreasAndTables error:', err);
    }
  },

  renderAreaTabs() {
    const container = document.getElementById('areaTabsList');
    if (!container) return;

    let html = `<button class="area-tab ${this.selectedAreaId === 'all' ? 'active' : ''}" data-id="all">Tất cả khu vực (${this.tables.length})</button>`;

    this.areas.forEach(area => {
      const count = this.tables.filter(t => t.area_id === area.id).length;
      html += `
        <button class="area-tab ${this.selectedAreaId === String(area.id) ? 'active' : ''}" data-id="${area.id}">
          ${area.name} (${count})
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.area-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.area-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.selectedAreaId = tab.getAttribute('data-id');
        this.renderTables();
      });
    });
  },

  renderTables() {
    const grid = document.getElementById('tablesGrid');
    if (!grid) return;

    let filtered = this.tables;
    if (this.selectedAreaId !== 'all') {
      filtered = filtered.filter(t => t.area_id === parseInt(this.selectedAreaId, 10));
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Chưa có bàn nào trong khu vực này</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(t => {
      const isOccupied = t.status === 'OCCUPIED';
      const statusText = isOccupied ? 'Có khách' : (t.status === 'RESERVED' ? 'Đặt trước' : 'Trống');

      return `
        <div class="table-card status-${t.status}" data-id="${t.id}">
          <div class="table-card-header">
            <span class="table-code-badge">${t.code}</span>
            <span class="table-status-pill">${statusText}</span>
          </div>
          <div class="table-card-body">
            <div class="text-sub" style="font-size: 11px;">${t.name} (${t.seats || 4} chỗ)</div>
            ${isOccupied ? `
              <div class="table-order-info">
                <span class="table-amount">${window.api.formatMoney(t.total_amount || 0)}</span>
                <div class="text-muted" style="font-size: 10px;">${t.order_code || ''}</div>
              </div>
            ` : `
              <div class="table-order-info text-muted">
                <i class="fa-regular fa-clock"></i> Sẵn sàng phục vụ
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.table-card').forEach(card => {
      card.addEventListener('click', () => {
        const tableId = parseInt(card.getAttribute('data-id'), 10);
        const table = this.tables.find(t => t.id === tableId);
        if (!table) return;

        if (table.status === 'EMPTY') {
          // Empty table: immediately assign to cart and switch to POS
          window.appState.setSelectedTable(table);
          window.api.showToast(`Đã chọn ${table.name} cho đơn gọi món`, 'success');
          window.appNavigation.switchView('viewPos');
        } else {
          // Occupied table: open actions modal
          this.openTableActionModal(table);
        }
      });
    });
  },

  openTableActionModal(table) {
    this.activeTableForAction = table;
    const modal = document.getElementById('tableActionModal');
    const title = document.getElementById('tableActionTitle');
    const status = document.getElementById('tableActionStatus');
    const transferSubpanel = document.getElementById('transferSubpanel');
    const mergeSubpanel = document.getElementById('mergeSubpanel');

    if (transferSubpanel) transferSubpanel.style.display = 'none';
    if (mergeSubpanel) mergeSubpanel.style.display = 'none';

    if (title) title.textContent = `Thao tác ${table.code} - ${table.name}`;
    if (status) status.textContent = table.status === 'OCCUPIED' ? 'Đang có khách' : 'Đặt trước';

    if (modal) modal.style.display = 'flex';
  },

  populateTransferTargets() {
    const select = document.getElementById('transferTargetSelect');
    if (!select) return;

    // Filter empty tables only
    const emptyTables = this.tables.filter(t => t.status === 'EMPTY');
    if (emptyTables.length === 0) {
      select.innerHTML = '<option value="">Không có bàn trống nào!</option>';
      return;
    }

    select.innerHTML = emptyTables.map(t => `
      <option value="${t.id}">${t.code} - ${t.name} (${t.seats} chỗ)</option>
    `).join('');
  },

  populateMergeTargets() {
    const select = document.getElementById('mergeTargetSelect');
    if (!select) return;

    // Filter other occupied tables
    const otherOccupied = this.tables.filter(t => t.status === 'OCCUPIED' && t.id !== this.activeTableForAction?.id);
    if (otherOccupied.length === 0) {
      select.innerHTML = '<option value="">Không có bàn đang có khách khác để ghép!</option>';
      return;
    }

    select.innerHTML = otherOccupied.map(t => `
      <option value="${t.id}">${t.code} - ${t.name} (${window.api.formatMoney(t.total_amount)})</option>
    `).join('');
  },

  async confirmTransfer() {
    const targetSelect = document.getElementById('transferTargetSelect');
    const targetId = targetSelect?.value;

    if (!this.activeTableForAction || !targetId) {
      window.api.showToast('Vui lòng chọn bàn đích', 'error');
      return;
    }

    try {
      await window.api.post('/tables/transfer', {
        from_table_id: this.activeTableForAction.id,
        to_table_id: parseInt(targetId, 10)
      });

      window.api.showToast('Chuyển bàn thành công!', 'success');
      document.getElementById('tableActionModal').style.display = 'none';
      await this.loadAreasAndTables();
    } catch (err) {
      window.api.showToast('Lỗi chuyển bàn: ' + err.message, 'error');
    }
  },

  async confirmMerge() {
    const targetSelect = document.getElementById('mergeTargetSelect');
    const targetId = targetSelect?.value;

    if (!this.activeTableForAction || !targetId) {
      window.api.showToast('Vui lòng chọn bàn ghép', 'error');
      return;
    }

    try {
      await window.api.post('/tables/merge', {
        source_table_id: this.activeTableForAction.id,
        target_table_id: parseInt(targetId, 10)
      });

      window.api.showToast('Ghép bàn thành công!', 'success');
      document.getElementById('tableActionModal').style.display = 'none';
      await this.loadAreasAndTables();
    } catch (err) {
      window.api.showToast('Lỗi ghép bàn: ' + err.message, 'error');
    }
  }
};
