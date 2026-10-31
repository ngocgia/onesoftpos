// OnesoftPOS v1.0 - Tables & Floor Plan Controller (Rule 21, 22, 23)

window.tablesModule = {
  areas: [],
  tables: [],
  selectedAreaId: 'all',
  activeTableForAction: null,
  editorSubmit: null,
  draftStatusQueue: new Map(),

  getTableSummary(table, orderTotal = table.total_amount) {
    const state = window.appState;
    const cart = state.cart.orderType === 'DINE_IN' && Number(state.cart.selectedTable?.id) === Number(table.id)
      ? state.cart : state.getTableCart(table.id);
    const hasDraft = !!cart?.items?.length;
    // VND has no minor unit: keep every money figure an integer dong amount (sync with state.js).
    const subtotal = Math.round((cart?.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    const discount = Math.round(Math.max(0, Math.min(subtotal, Number(cart?.discountCash || 0) + subtotal * Number(cart?.discountPercent || 0) / 100)));
    return {
      hasDraft,
      total: Math.round(Number(orderTotal || 0)) + Math.max(0, subtotal - discount),
      status: hasDraft ? 'OCCUPIED' : table.status
    };
  },

  syncDraftTableStatus(table, hasItems) {
    if (table.current_order_id) return;
    if (!hasItems && !table.draftOccupied) return;
    table.draftOccupied = hasItems;
    const status = hasItems ? 'OCCUPIED' : 'EMPTY';
    const current = this.tables.find(item => Number(item.id) === Number(table.id));
    if (table.status === status && (!current || current.status === status)) return;
    table.status = status;
    if (current) current.status = status;
    this.renderTables();
    const key = `${window.api.getCurrentStoreId()}:${table.id}`;
    const previous = this.draftStatusQueue.get(key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(() => window.api.put(`/tables/${table.id}/status`, { status, draft: true }))
      .catch(error => {
        // Keep the draft, but reload the authoritative table status on failure.
        window.api.showToast('Không thể cập nhật trạng thái bàn: ' + error.message, 'error');
        return this.loadAreasAndTables();
      }).finally(() => {
        if (this.draftStatusQueue.get(key) === pending) this.draftStatusQueue.delete(key);
      });
    this.draftStatusQueue.set(key, pending);
  },

  async openTablePos(table) {
    if (this.openingTable || window.posModule?.sendingOrder) return;
    this.openingTable = true;
    try {
      const result = table.current_order_id ? await window.api.get(`/orders/${table.current_order_id}`) : null;
      if (result && (result.order.payment_status === 'PAID' || ['COMPLETED', 'CANCELLED'].includes(result.order.order_status))) {
        await this.loadAreasAndTables();
        const modal = document.getElementById('tableActionModal');
        if (modal) modal.style.display = 'none';
        throw new Error('Đơn của bàn đã kết thúc, vui lòng chọn lại bàn');
      }
      window.appState.setSelectedTable(table);
      window.appState.cart.sentItems = (result?.items || []).filter(item => item.status !== 'CANCELLED');
      window.appState.cart.sentOrder = result?.order || null;
      window.appState.notify('cart_updated', window.appState.cart);
      const modal = document.getElementById('tableActionModal');
      if (modal) modal.style.display = 'none';
      window.appNavigation.switchView('viewPos');
    } catch (error) {
      window.api.showToast('Không thể mở bàn: ' + error.message, 'error');
    } finally {
      this.openingTable = false;
    }
  },

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
      } else if (event === 'cart_updated') {
        this.renderTables();
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
          this.openTablePos(this.activeTableForAction);
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

    // Action: Print Bill (Tạm tính)
    const btnPrintBill = document.getElementById('btnActionPrintBill');
    if (btnPrintBill) {
      btnPrintBill.addEventListener('click', async () => {
        if (!this.activeTableForAction) return;
        const orderId = this.activeTableForAction.current_order_id;
        if (!orderId) {
          window.api.showToast('Bàn chưa có đơn món để in hóa đơn', 'warning');
          return;
        }
        closeActionModal();
        if (window.invoiceModule) {
          window.invoiceModule.showReceipt({ id: orderId });
        }
      });
    }

    // Action: Checkout / Pay
    const btnCheckout = document.getElementById('btnActionCheckout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', async () => {
        if (!this.activeTableForAction) return;
        const orderId = this.activeTableForAction.current_order_id;
        if (!orderId) {
          window.api.showToast('Bàn chưa có đơn món để thanh toán', 'warning');
          return;
        }
        try {
          const res = await window.api.get(`/orders/${orderId}`);
          closeActionModal();
          if (window.checkoutModule) {
            window.checkoutModule.openCheckoutModal(res.order);
          }
        } catch (err) {
          window.api.showToast('Không thể mở thanh toán: ' + err.message, 'error');
        }
      });
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

  discardTableCartDraft(tableId) {
    // state.js chỉ tự dọn giỏ nháp qua saveTableCart() cho bàn đang mở, nên sau khi
    // chuyển/gộp/thanh toán phải chủ động xóa key localStorage của bàn nguồn để bàn
    // về EMPTY không hồi sinh giỏ nháp cũ của đơn đã xử lý khi bấm vào lại.
    const appState = window.appState;
    const cart = appState?.cart;
    if (cart && cart.orderType === 'DINE_IN' && Number(cart.selectedTable?.id) === Number(tableId)) {
      // Giỏ trong bộ nhớ đang gắn với bàn này: reset trước để clearCart() ->
      // saveTableCart() không ghi lại key, và setSelectedTable(null) thay giỏ mới.
      cart.sentItems = [];
      cart.sentOrder = null;
      appState.clearCart();
      appState.setSelectedTable(null);
    }
    const key = typeof appState?.tableCartKey === 'function'
      ? appState.tableCartKey(tableId)
      : `onesoftpos_table_cart_${window.api.getCurrentStoreId()}_${appState?.user?.id || 'staff'}_${tableId}`;
    try { localStorage.removeItem(key); } catch (_) {}
  },

  cleanupStaleTableDrafts() {
    // Bàn đã EMPTY trên server nhưng localStorage còn giỏ nháp (đơn đã được chuyển/
    // gộp/thanh toán ở thiết bị khác hoặc chính máy này, ví dụ qua checkout.js gọi
    // loadAreasAndTables() sau thanh toán): dọn key để không hồi sinh giỏ cũ.
    const storeId = window.api.getCurrentStoreId();
    const cart = window.appState?.cart;
    this.tables.forEach(table => {
      if (table.status !== 'EMPTY' || table.current_order_id) return;
      const isLiveDraft = cart?.orderType === 'DINE_IN' && Number(cart.selectedTable?.id) === Number(table.id)
        && cart.items.length > 0 && !cart.existingOrderId;
      // Giữ giỏ nháp thuần chưa gửi (chưa có đơn) khi đồng bộ trạng thái nháp còn đang chạy hoặc vừa lỗi.
      if (isLiveDraft || this.draftStatusQueue.has(`${storeId}:${table.id}`)) return;
      this.discardTableCartDraft(table.id);
    });
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

      this.cleanupStaleTableDrafts();

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
          ${this.escape(area.name)} (${count})
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
      const summary = this.getTableSummary(t);
      const isOccupied = summary.status === 'OCCUPIED';
      const statusText = isOccupied ? 'Có khách' : (t.status === 'RESERVED' ? 'Đặt trước' : 'Trống');

      return `
        <div class="table-card status-${summary.status}" data-id="${t.id}">
          <div class="table-card-header">
            <span class="table-code-badge">${this.escape(t.code)}</span>
            <span class="table-status-pill">${statusText}</span>
          </div>
          <div class="table-card-body">
            <div class="text-sub" style="font-size: 11px;">${this.escape(t.name)} (${t.seats || 4} chỗ)</div>
            ${isOccupied ? `
              <div class="table-order-info">
                <span class="table-amount">${window.api.formatMoney(summary.total)}</span>
                <div class="text-muted" style="font-size: 10px;">${this.escape(t.order_code || '')}${summary.hasDraft ? ' · Món chưa gửi' : ''}</div>
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
          this.openTablePos(table);
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

    const summary = this.getTableSummary(table);
    const isOccupied = summary.status === 'OCCUPIED';
    const totalAmount = summary.total;

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
      if (isOccupied && (totalAmount > 0 || summary.hasDraft || table.current_order_id)) {
        billOverview.style.display = 'flex';
        if (billAmount) billAmount.textContent = window.api.formatMoney(totalAmount);
        if (billOrderCode) billOrderCode.textContent = (table.order_code ? `#${table.order_code}` : '')
          + (summary.hasDraft ? `${table.order_code ? ' · ' : ''}MÓN CHƯA GỬI` : (table.order_code ? '' : '#ĐANG PHỤC VỤ'));
      } else if (isOccupied) {
        billOverview.style.display = 'flex';
        if (billAmount) billAmount.textContent = '0 đ';
        if (billOrderCode) billOrderCode.textContent = '#CHƯA GỌI MÓN';
      } else {
        billOverview.style.display = 'none';
      }
    }

    const hasOrder = isOccupied && !!table.current_order_id;
    const btnPrintBill = document.getElementById('btnActionPrintBill');
    const btnCheckout = document.getElementById('btnActionCheckout');
    const btnCheckoutText = document.getElementById('btnActionCheckoutText');

    if (btnPrintBill) {
      btnPrintBill.disabled = !hasOrder;
      btnPrintBill.style.opacity = hasOrder ? '1' : '0.55';
      btnPrintBill.style.cursor = hasOrder ? 'pointer' : 'not-allowed';
    }

    if (btnCheckout) {
      btnCheckout.disabled = !hasOrder;
      btnCheckout.style.opacity = hasOrder ? '1' : '0.55';
      btnCheckout.style.cursor = hasOrder ? 'pointer' : 'not-allowed';
      if (btnCheckoutText) {
        btnCheckoutText.textContent = 'Thanh toán';
      }
    }

    if (modal) modal.style.display = 'flex';
    this.loadActiveOrderDetails(table);
  },

  itemStatusLabel(status) {
    return ({ PENDING: 'Chờ làm', PREPARING: 'Đang làm', READY: 'Đã xong', SERVED: 'Đã phục vụ', CANCELLED: 'Đã hủy' })[status] || status || 'Chưa rõ';
  },

  canCancelOrderItems() {
    const role = window.appState.user?.role;
    return ['STORE_MANAGER', 'CASHIER'].includes(role)
      || (role === 'KITCHEN' && window.appState.storeSettings?.allow_cancel_item !== false);
  },

  async loadActiveOrderDetails(table) {
    const details = document.getElementById('tableOrderDetails');
    const list = document.getElementById('tableOrderItems');
    const count = document.getElementById('tableOrderItemCount');
    if (!details || !list) return;
    if (!table.current_order_id) { details.style.display = 'none'; return; }

    details.style.display = 'block';
    list.innerHTML = '<div class="text-muted table-order-loading">Đang tải chi tiết đơn...</div>';
    if (count) count.textContent = '';
    try {
      const result = await window.api.get(`/orders/${table.current_order_id}`);
      if (this.activeTableForAction?.id !== table.id) return;
      const items = result.items || [];
      if (count) count.textContent = `${items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)} món`;

      if (result.order?.total_amount != null) {
        const amt = this.getTableSummary(table, result.order.total_amount).total;
        const billAmount = document.getElementById('tableBillAmount');
        if (billAmount) billAmount.textContent = window.api.formatMoney(amt);
        const checkoutBtn = document.getElementById('btnActionCheckout');
        const checkoutText = document.getElementById('btnActionCheckoutText');
        const printBtn = document.getElementById('btnActionPrintBill');
        const hasValidOrder = items.length > 0;
        if (checkoutBtn) {
          checkoutBtn.disabled = !hasValidOrder;
          checkoutBtn.style.opacity = hasValidOrder ? '1' : '0.55';
          checkoutBtn.style.cursor = hasValidOrder ? 'pointer' : 'not-allowed';
        }
        if (printBtn) {
          printBtn.disabled = !hasValidOrder;
          printBtn.style.opacity = hasValidOrder ? '1' : '0.55';
          printBtn.style.cursor = hasValidOrder ? 'pointer' : 'not-allowed';
        }
        if (checkoutText) {
          checkoutText.textContent = 'Thanh toán';
        }
      }
      list.innerHTML = items.length ? items.map(item => {
        const options = (item.options || []).map(option => option.option_name).filter(Boolean).join(', ');
        const canCancel = this.canCancelOrderItems() && ['PENDING', 'PREPARING', 'READY'].includes(item.status);
        return `<div class="table-order-item">
          <div class="table-order-item-main">
            <strong>${Number(item.quantity || 1)} × ${this.escape(item.product_name)}</strong>
            ${item.variant_name ? `<small>${this.escape(item.variant_name)}</small>` : ''}
            ${options ? `<small>${this.escape(options)}</small>` : ''}
            ${item.note ? `<small>Ghi chú: ${this.escape(item.note)}</small>` : ''}
          </div>
          <div class="table-order-item-side">
            <span class="order-item-status status-${this.escape(String(item.status || '').toLowerCase())}">${this.escape(this.itemStatusLabel(item.status))}</span>
            <strong>${window.api.formatMoney(Math.round(item.subtotal || 0))}</strong>
            ${canCancel ? `<button type="button" class="btn-cancel-order-item" data-item-id="${item.id}" data-item-name="${this.escape(item.product_name)}"><i class="fa-solid fa-ban"></i> Hủy món</button>` : ''}
          </div>
        </div>`;
      }).join('') : '<div class="text-muted table-order-loading">Đơn chưa có món.</div>';
      list.querySelectorAll('.btn-cancel-order-item').forEach(button => button.addEventListener('click', () => this.cancelOrderItem(button, table)));
    } catch (error) {
      list.innerHTML = `<div class="text-danger table-order-loading">Không tải được chi tiết đơn: ${this.escape(error.message)}</div>`;
    }
  },

  async cancelOrderItem(button, table) {
    const itemId = Number(button.dataset.itemId);
    const itemName = button.dataset.itemName || 'món này';
    if (!confirm(`Xác nhận hủy ${itemName}? Thao tác này không thể hoàn tác.`)) return;
    button.disabled = true;
    try {
      const result = await window.api.put(`/order-items/${itemId}/cancel`, {});
      window.api.showToast('Đã hủy món và cập nhật tổng tiền đơn', 'success');
      await this.loadAreasAndTables();
      if (result.order?.order_status === 'CANCELLED') {
        document.getElementById('tableActionModal').style.display = 'none';
        return;
      }
      const refreshedTable = this.tables.find(item => item.id === table.id) || table;
      this.openTableActionModal(refreshedTable);
    } catch (error) {
      button.disabled = false;
      window.api.showToast('Không thể hủy món: ' + error.message, 'error');
    }
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
      const areaName = area ? ` [${this.escape(area.name)}]` : '';
      return `<option value="${t.id}">${this.escape(t.code)} – ${this.escape(t.name)}${areaName} (${t.seats || 4} chỗ)</option>`;
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
      const areaName = area ? ` [${this.escape(area.name)}]` : '';
      const amountStr = window.api.formatMoney(Math.round(t.total_amount || 0));
      return `<option value="${t.id}">${this.escape(t.code)} – ${this.escape(t.name)}${areaName} · Đơn: ${amountStr}</option>`;
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
      const sourceTableId = this.activeTableForAction.id;
      await window.api.post('/tables/transfer', {
        from_table_id: sourceTableId,
        to_table_id: parseInt(targetId, 10)
      });

      // Món đã theo đơn sang bàn đích: dọn giỏ nháp của bàn nguồn.
      this.discardTableCartDraft(sourceTableId);
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
      const sourceTableId = this.activeTableForAction.id;
      await window.api.post('/tables/merge', {
        source_table_id: sourceTableId,
        target_table_id: parseInt(targetId, 10)
      });

      // Đơn đã gộp sang bàn đích: dọn giỏ nháp của bàn nguồn bị gộp.
      this.discardTableCartDraft(sourceTableId);
      window.api.showToast(`Đã ghép vào ${targetName} thành công!`, 'success');
      document.getElementById('tableActionModal').style.display = 'none';
      await this.loadAreasAndTables();
    } catch (err) {
      window.api.showToast('Lỗi ghép bàn: ' + err.message, 'error');
    }
  }
};
