// ThichGaPOS v1.0 - Tables & Floor Plan Controller (Rule 21, 22, 23)

window.tablesModule = {
  areas: [],
  tables: [],
  selectedAreaId: 'all',
  activeTableForAction: null,
  editorSubmit: null,

  async init() {
    this.bindEvents();
    this.configureManagement();
    await this.loadAreasAndTables();

    // Subscribe to state updates
    window.appState.subscribe((event) => {
      if (event === 'store_changed') {
        this.configureManagement();
        this.loadAreasAndTables();
      } else if (event === 'role_features_updated' || event === 'features_updated') {
        this.configureManagement();
      }
    });
  },

  bindEvents() {
    const tableActionModal = document.getElementById('tableActionModal');
    const closeActionModal = () => {
      if (tableActionModal) tableActionModal.style.display = 'none';
      document.getElementById('btnActionTransfer')?.classList.remove('active-subpanel');
      document.getElementById('btnActionMerge')?.classList.remove('active-subpanel');
      if (document.getElementById('transferSubpanel')) document.getElementById('transferSubpanel').style.display = 'none';
      if (document.getElementById('mergeSubpanel')) document.getElementById('mergeSubpanel').style.display = 'none';
    };

    // Close buttons & overlay click
    document.getElementById('btnCloseTableActionModal')?.addEventListener('click', closeActionModal);
    if (tableActionModal) {
      tableActionModal.addEventListener('click', (e) => {
        if (e.target === tableActionModal) closeActionModal();
      });
    }

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && tableActionModal && tableActionModal.style.display !== 'none') {
        closeActionModal();
      }
    });

    // Action: Open POS for table
    const btnActionPos = document.getElementById('btnActionOpenPos');
    if (btnActionPos) {
      btnActionPos.addEventListener('click', () => {
        if (this.activeTableForAction) {
          window.appState.setSelectedTable(this.activeTableForAction);
          closeActionModal();
          window.appNavigation.switchView('viewPos');
        }
      });
    }

    // Action: Transfer Table
    const btnActionTransfer = document.getElementById('btnActionTransfer');
    const transferSubpanel = document.getElementById('transferSubpanel');
    const mergeSubpanel = document.getElementById('mergeSubpanel');

    if (btnActionTransfer) {
      btnActionTransfer.addEventListener('click', () => {
        if (mergeSubpanel) {
          mergeSubpanel.style.display = 'none';
          document.getElementById('btnActionMerge')?.classList.remove('active-subpanel');
        }
        if (transferSubpanel) {
          const isOpening = transferSubpanel.style.display !== 'block';
          transferSubpanel.style.display = isOpening ? 'block' : 'none';
          btnActionTransfer.classList.toggle('active-subpanel', isOpening);
          if (isOpening) this.populateTransferTargets();
        }
      });
    }

    document.getElementById('btnCancelTransfer')?.addEventListener('click', () => {
      if (transferSubpanel) transferSubpanel.style.display = 'none';
      btnActionTransfer?.classList.remove('active-subpanel');
    });

    const btnConfirmTransfer = document.getElementById('btnConfirmTransfer');
    if (btnConfirmTransfer) {
      btnConfirmTransfer.addEventListener('click', () => this.confirmTransfer());
    }

    // Action: Merge Tables
    const btnActionMerge = document.getElementById('btnActionMerge');
    if (btnActionMerge) {
      btnActionMerge.addEventListener('click', () => {
        if (transferSubpanel) {
          transferSubpanel.style.display = 'none';
          document.getElementById('btnActionTransfer')?.classList.remove('active-subpanel');
        }
        if (mergeSubpanel) {
          const isOpening = mergeSubpanel.style.display !== 'block';
          mergeSubpanel.style.display = isOpening ? 'block' : 'none';
          btnActionMerge.classList.toggle('active-subpanel', isOpening);
          if (isOpening) this.populateMergeTargets();
        }
      });
    }

    document.getElementById('btnCancelMerge')?.addEventListener('click', () => {
      if (mergeSubpanel) mergeSubpanel.style.display = 'none';
      btnActionMerge?.classList.remove('active-subpanel');
    });

    const btnConfirmMerge = document.getElementById('btnConfirmMerge');
    if (btnConfirmMerge) {
      btnConfirmMerge.addEventListener('click', () => this.confirmMerge());
    }
    document.getElementById('btnManageAreas')?.addEventListener('click', () => this.manageAreas());
    document.getElementById('btnAddTable')?.addEventListener('click', () => this.editTable());
  },

  canManage() {
    return ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(window.appState.user?.role);
  },

  configureManagement() {
    const allowed = this.canManage();
    const manageAreas = document.getElementById('btnManageAreas');
    const addTable = document.getElementById('btnAddTable');
    const notice = document.getElementById('tableFeatureNotice');
    if (manageAreas) manageAreas.style.display = allowed ? 'inline-flex' : 'none';
    if (addTable) addTable.style.display = allowed ? 'inline-flex' : 'none';
    if (notice) notice.style.display = allowed && !window.appState.features.enableTable ? 'block' : 'none';
  },

  escape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  },

  field(name, label, type = 'text', value = '', options = null, required = false) {
    if (type === 'select') return `<div class="form-group"><label>${label}</label><select class="form-input" name="${name}" ${required ? 'required' : ''}>${options.map(option => `<option value="${this.escape(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${this.escape(option.label)}</option>`).join('')}</select></div>`;
    return `<div class="form-group"><label>${label}</label><input class="form-input" name="${name}" type="${type}" value="${this.escape(value)}" ${required ? 'required' : ''}></div>`;
  },

  ensureEditor() {
    if (document.getElementById('tableManagerModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="tableManagerModal" style="display:none"><form class="modal-dialog" id="tableManagerForm"><div class="modal-header"><div class="modal-title-box"><h3 id="tableManagerTitle"></h3></div><button type="button" class="btn-close-modal" id="btnCloseTableManager">&times;</button></div><div class="modal-body" id="tableManagerBody"></div><div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn-secondary" id="btnCancelTableManager">Đóng</button><button type="submit" class="btn-primary" id="btnSaveTableManager">Lưu</button></div></form></div>`);
    const close = () => { document.getElementById('tableManagerModal').style.display = 'none'; this.editorSubmit = null; };
    document.getElementById('btnCloseTableManager').onclick = close;
    document.getElementById('btnCancelTableManager').onclick = close;
    document.getElementById('tableManagerForm').onsubmit = async event => {
      event.preventDefault();
      try {
        await this.editorSubmit?.(Object.fromEntries(new FormData(event.target).entries()));
        close();
      } catch (error) {
        window.api.showToast(error.message, 'error');
      }
    };
  },

  openEditor(title, html, onSubmit, hideSave = false) {
    this.ensureEditor();
    document.getElementById('tableManagerTitle').textContent = title;
    document.getElementById('tableManagerBody').innerHTML = html;
    document.getElementById('btnSaveTableManager').style.display = hideSave ? 'none' : '';
    this.editorSubmit = onSubmit;
    document.getElementById('tableManagerModal').style.display = 'flex';
  },

  manageAreas() {
    const rows = this.areas.map(area => `<div class="pay-row"><span><strong>${this.escape(area.name)}</strong><br><small class="text-muted">Thứ tự: ${area.sort_order || 0}</small></span><span><button type="button" class="btn-secondary btn-sm" onclick="tablesModule.editArea(${area.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="tablesModule.removeArea(${area.id})">Xóa</button></span></div>`).join('') || '<p class="text-muted">Chưa có khu vực/phòng.</p>';
    this.openEditor('Khu vực / phòng', `<button type="button" class="btn-primary btn-sm" onclick="tablesModule.editArea()"><i class="fa-solid fa-plus"></i> Thêm khu vực / phòng</button><div style="margin-top:12px">${rows}</div>`, null, true);
  },

  editArea(id) {
    const area = this.areas.find(item => item.id === id) || {};
    this.openEditor(id ? 'Sửa khu vực / phòng' : 'Thêm khu vực / phòng', this.field('name','Tên khu vực / phòng','text',area.name || '',null,true) + this.field('sort_order','Thứ tự','number',area.sort_order || 0), async data => {
      data.sort_order = Number(data.sort_order || 0);
      if (id) await window.api.put(`/areas/${id}`, data); else await window.api.post('/areas', data);
      window.api.showToast('Đã lưu khu vực/phòng', 'success');
      await this.loadAreasAndTables();
    });
  },

  async removeArea(id) {
    if (!confirm('Xóa khu vực/phòng này?')) return;
    try {
      await window.api.del(`/areas/${id}`);
      window.api.showToast('Đã xóa khu vực/phòng', 'success');
      await this.loadAreasAndTables();
      this.manageAreas();
    } catch (error) { window.api.showToast(error.message, 'error'); }
  },

  editTable(id) {
    if (!this.areas.length) {
      window.api.showToast('Hãy tạo khu vực/phòng trước khi thêm bàn', 'error');
      return this.editArea();
    }
    const table = this.tables.find(item => item.id === id) || {};
    const areaOptions = this.areas.map(area => ({ value: area.id, label: area.name }));
    const html = this.field('area_id','Khu vực / phòng','select',table.area_id || areaOptions[0].value,areaOptions,true) + this.field('code','Mã bàn','text',table.code || '',null,true) + this.field('name','Tên bàn','text',table.name || '',null,true) + this.field('seats','Số chỗ','number',table.seats || 4,null,true) + this.field('sort_order','Thứ tự','number',table.sort_order || 0);
    this.openEditor(id ? 'Sửa bàn' : 'Thêm bàn', html, async data => {
      data.area_id = Number(data.area_id); data.seats = Number(data.seats); data.sort_order = Number(data.sort_order || 0);
      if (id) await window.api.put(`/tables/${id}`, data); else await window.api.post('/tables', data);
      window.api.showToast('Đã lưu bàn', 'success');
      await this.loadAreasAndTables();
    });
  },

  async removeTable(id) {
    if (!confirm('Xóa bàn này?')) return;
    try { await window.api.del(`/tables/${id}`); window.api.showToast('Đã xóa bàn', 'success'); await this.loadAreasAndTables(); }
    catch (error) { window.api.showToast(error.message, 'error'); }
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
      this.renderAdminManagement();
    } catch (err) {
      console.error('loadAreasAndTables error:', err);
    }
  },

  renderAdminManagement() {
    const areaContainer = document.getElementById('adminAreasManagement');
    const tableContainer = document.getElementById('adminTablesManagement');
    if (areaContainer) areaContainer.innerHTML = this.areas.map(area => {
      const count = this.tables.filter(table => table.area_id === area.id).length;
      return `<div class="pay-row"><span><strong>${this.escape(area.name)}</strong><br><small class="text-muted">${count} bàn · Thứ tự ${area.sort_order || 0}</small></span><span><button type="button" class="btn-secondary btn-sm" onclick="tablesModule.editArea(${area.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="tablesModule.removeArea(${area.id})">Xóa</button></span></div>`;
    }).join('') || '<p class="text-muted">Chưa có khu vực/phòng. Hãy bấm “Thêm khu vực / phòng”.</p>';
    if (tableContainer) tableContainer.innerHTML = this.tables.map(table => `<div class="pay-row"><span><strong>${this.escape(table.code)} · ${this.escape(table.name)}</strong><br><small class="text-muted">${this.escape(table.area_name || 'Chưa có khu vực')} · ${table.seats || 4} chỗ · ${table.status}</small></span><span><button type="button" class="btn-secondary btn-sm" onclick="tablesModule.editTable(${table.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="tablesModule.removeTable(${table.id})">Xóa</button></span></div>`).join('') || '<p class="text-muted">Chưa có bàn. Hãy tạo khu vực/phòng trước, sau đó thêm bàn.</p>';
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
          ${this.canManage() ? `<div class="table-manage-actions" style="display:flex;gap:6px;padding:0 10px 10px"><button type="button" class="btn-secondary btn-sm" onclick="event.stopPropagation();tablesModule.editTable(${t.id})">Sửa</button><button type="button" class="btn-secondary btn-sm" onclick="event.stopPropagation();tablesModule.removeTable(${t.id})">Xóa</button></div>` : ''}
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
    const codeBadge = document.getElementById('tableActionCodeBadge');
    const areaTag = document.getElementById('tableActionArea');
    const seatsTag = document.getElementById('tableActionSeats');
    const billOverview = document.getElementById('tableBillOverview');
    const billAmount = document.getElementById('tableBillAmount');
    const billOrderCode = document.getElementById('tableBillOrderCode');

    const transferSubpanel = document.getElementById('transferSubpanel');
    const mergeSubpanel = document.getElementById('mergeSubpanel');

    document.getElementById('btnActionTransfer')?.classList.remove('active-subpanel');
    document.getElementById('btnActionMerge')?.classList.remove('active-subpanel');

    if (transferSubpanel) transferSubpanel.style.display = 'none';
    if (mergeSubpanel) mergeSubpanel.style.display = 'none';

    const area = this.areas.find(a => a.id === table.area_id);
    const areaName = area ? area.name : 'Chung';

    if (codeBadge) codeBadge.textContent = table.code || 'Bàn';
    if (title) title.textContent = table.name || `Bàn ${table.code}`;
    if (areaTag) areaTag.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${this.escape(areaName)}`;
    if (seatsTag) seatsTag.innerHTML = `<i class="fa-solid fa-chair"></i> ${table.seats || 4} chỗ`;

    const isOccupied = table.status === 'OCCUPIED';
    const totalAmount = Number(table.total_amount || 0);

    if (status) {
      if (isOccupied) {
        status.className = 'badge-status table-status-badge status-occupied';
        status.innerHTML = `<span class="status-dot"></span> Đang có khách`;
      } else {
        status.className = 'badge-status table-status-badge status-reserved';
        status.innerHTML = `<span class="status-dot"></span> Đặt trước`;
      }
    }

    if (billOverview) {
      if (isOccupied && totalAmount > 0) {
        billOverview.style.display = 'flex';
        if (billAmount) billAmount.textContent = window.api.formatMoney(totalAmount);
        if (billOrderCode) billOrderCode.textContent = table.order_code ? `#${table.order_code}` : '#ĐANG PHỤC VỤ';
      } else if (isOccupied) {
        billOverview.style.display = 'flex';
        if (billAmount) billAmount.textContent = '0 đ';
        if (billOrderCode) billOrderCode.textContent = '#CHƯA GỌI MÓN';
      } else {
        billOverview.style.display = 'none';
      }
    }

    if (modal) modal.style.display = 'flex';
  },

  populateTransferTargets() {
    const select = document.getElementById('transferTargetSelect');
    if (!select) return;

    // Filter empty tables only
    const emptyTables = this.tables.filter(t => t.status === 'EMPTY');
    if (emptyTables.length === 0) {
      select.innerHTML = '<option value="">⚠️ Không có bàn trống nào khả dụng!</option>';
      return;
    }

    select.innerHTML = emptyTables.map(t => {
      const area = this.areas.find(a => a.id === t.area_id);
      const areaName = area ? ` [${area.name}]` : '';
      return `<option value="${t.id}">${t.code} – ${t.name}${areaName} (${t.seats || 4} chỗ)</option>`;
    }).join('');
  },

  populateMergeTargets() {
    const select = document.getElementById('mergeTargetSelect');
    if (!select) return;

    // Filter other occupied tables
    const otherOccupied = this.tables.filter(t => t.status === 'OCCUPIED' && t.id !== this.activeTableForAction?.id);
    if (otherOccupied.length === 0) {
      select.innerHTML = '<option value="">⚠️ Không có bàn đang có khách khác để ghép!</option>';
      return;
    }

    select.innerHTML = otherOccupied.map(t => {
      const area = this.areas.find(a => a.id === t.area_id);
      const areaName = area ? ` [${area.name}]` : '';
      const amountStr = window.api.formatMoney(t.total_amount || 0);
      return `<option value="${t.id}">${t.code} – ${t.name}${areaName} · Đơn: ${amountStr}</option>`;
    }).join('');
  },

  async confirmTransfer() {
    const targetSelect = document.getElementById('transferTargetSelect');
    const targetId = targetSelect?.value;

    if (!this.activeTableForAction || !targetId) {
      window.api.showToast('Vui lòng chọn bàn đích còn trống', 'warning');
      return;
    }

    const targetTable = this.tables.find(t => t.id === parseInt(targetId, 10));
    const targetName = targetTable ? `${targetTable.code} (${targetTable.name})` : 'bàn mới';

    if (!confirm(`Xác nhận chuyển toàn bộ đơn từ bàn ${this.activeTableForAction.code} sang ${targetName}?`)) {
      return;
    }

    try {
      await window.api.post('/tables/transfer', {
        from_table_id: this.activeTableForAction.id,
        to_table_id: parseInt(targetId, 10)
      });

      window.api.showToast(`Đã chuyển sang ${targetName} thành công!`, 'success');
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
      window.api.showToast('Vui lòng chọn bàn đang có khách để ghép', 'warning');
      return;
    }

    const targetTable = this.tables.find(t => t.id === parseInt(targetId, 10));
    const targetName = targetTable ? `${targetTable.code} (${targetTable.name})` : 'bàn đích';

    if (!confirm(`Xác nhận gộp đơn từ bàn ${this.activeTableForAction.code} vào ${targetName}? Hai hóa đơn sẽ được hợp nhất.`)) {
      return;
    }

    try {
      await window.api.post('/tables/merge', {
        source_table_id: this.activeTableForAction.id,
        target_table_id: parseInt(targetId, 10)
      });

      window.api.showToast(`Đã ghép vào ${targetName} thành công!`, 'success');
      document.getElementById('tableActionModal').style.display = 'none';
      await this.loadAreasAndTables();
    } catch (err) {
      window.api.showToast('Lỗi ghép bàn: ' + err.message, 'error');
    }
  }
};
