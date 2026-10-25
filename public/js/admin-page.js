const adminApp = {
  bindSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const toggle = document.getElementById("sidebarToggle");
    const close = document.getElementById("sidebarClose");
    const main = document.querySelector("main");
    const mobile = window.matchMedia("(max-width: 720px)");
    const setOpen = (open, restoreFocus = true) => {
      open = mobile.matches && open;
      const focusWasInSidebar = sidebar.contains(document.activeElement);
      document.body.classList.toggle("sidebar-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
      sidebar.inert = mobile.matches && !open;
      main.inert = open;
      if (open) close.focus();
      else if (restoreFocus && mobile.matches && focusWasInSidebar) toggle.focus();
    };
    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("sidebar-open")));
    close.addEventListener("click", () => setOpen(false));
    document.getElementById("sidebarBackdrop").addEventListener("click", () => setOpen(false));
    sidebar.addEventListener("click", (event) => {
      if (event.target.closest("#adminNav button, .sidebar-footer a, .sidebar-footer button")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (!document.body.classList.contains("sidebar-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "Tab") {
        const controls = [...sidebar.querySelectorAll("a[href], button:not([disabled])")]
          .filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    mobile.addEventListener("change", () => setOpen(false));
    setOpen(false, false);
  },
  me: null,
  stores: [],
  storeTypes: [],
  users: [],
  products: [],
  categories: [],
  toppings: [],
  toppingGroups: [],
  areas: [],
  tables: [],
  roles: [],
  modalSubmit: null,
  inventoryItems: [],
  inventorySummary: null,
  inventoryTransactions: [],
  inventoryReports: null,
  inventoryCategories: ['Thịt & Hải sản', 'Gia vị & Bột', 'Dầu ăn & Bơ', 'Nông sản & Lương thực', 'Trà & Cà phê', 'Sữa & Kem', 'Topping & Hạt', 'Bao bì & Ly hộp', 'Khác'],
  featureLabels: {
    SALE: "Thực đơn",
    TAKEAWAY: "Mang đi",
    DINE_IN: "Tại chỗ",
    TABLE: "Phòng bàn",
    KDS: "Bếp KDS",
    INVOICE: "Hóa đơn",
    QR_PAYMENT: "VietQR",
    INVENTORY: "Kho",
  },
  roleFeatureLabels: {
    POS: "Thực đơn POS",
    TABLES: "Phòng bàn",
    KDS: "Bếp KDS",
    ORDERS: "Đơn hàng",
    HISTORY: "Lịch sử",
    PAYMENT: "Thu tiền & thanh toán",
    ADMIN: "Quản trị cửa hàng",
    SHIFT: "Quản lý Ca làm việc",
    DISCOUNT: "Áp dụng giảm giá",
    COMPLETED_ITEMS: "Món đã xong",
    INVENTORY: "Quản lý kho",
  },
  esc(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  },
  money(value) {
    return window.api.formatMoney(Number(value) || 0);
  },
  toast(message, error = false) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className = error ? "show error" : "show";
    setTimeout(() => (el.className = ""), 2600);
  },
  field(
    name,
    label,
    type = "text",
    value = "",
    options = null,
    full = false,
    required = false,
  ) {
    const req = required ? "required" : "";
    const cls = full ? "field full" : "field";
    if (type === "textarea")
      return `<label class="${cls}"><span>${label}</span><textarea name="${name}" ${req}>${this.esc(value)}</textarea></label>`;
    if (type === "select")
      return `<label class="${cls}"><span>${label}</span><select name="${name}" ${req}>${options.map((o) => `<option value="${this.esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${this.esc(o.label)}</option>`).join("")}</select></label>`;
    return `<label class="${cls}"><span>${label}</span><input name="${name}" type="${type}" value="${this.esc(value)}" ${req}></label>`;
  },
  openModal(title, html, onSubmit) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalFields").innerHTML = html;
    this.modalSubmit = onSubmit;
    document.getElementById("formModal").classList.add("open");
  },
  closeModal() {
    document.getElementById("formModal").classList.remove("open");
    this.modalSubmit = null;
  },
  toppingPicker(selectedIds) {
    const selected = new Set(selectedIds.map(Number)),
      groups = [...this.toppingGroups, { id: "none", name: "Chưa phân nhóm" }];
    const sections = groups
      .map((group) => {
        const items = this.toppings.filter(
          (item) => String(item.group_id || "none") === String(group.id),
        );
        if (!items.length) return "";
        return `<section class="topping-picker-group" data-group="${group.id}" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1" onclick="adminApp.toggleGroupExpand('${group.id}')"><i class="fa-solid fa-chevron-up" id="group-icon-${group.id}" style="color:var(--muted);width:16px;text-align:center"></i><strong style="font-size:13px;user-select:none">${this.esc(group.name)} <small class="muted">(${items.length})</small></strong></div><label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;font-weight:600;margin:0"><input type="checkbox" data-select-group="${group.id}" onchange="adminApp.toggleToppingGroup('${group.id}',this.checked)"> Chọn cả nhóm</label></div><div class="feature-grid" id="group-content-${group.id}">${items.map((item) => `<label class="feature topping-picker-item" data-search="${this.esc(`${item.name} ${group.name}`.toLowerCase())}" style="justify-content:flex-start;gap:10px;align-items:flex-start"><input type="checkbox" name="product_topping" data-group-id="${group.id}" value="${item.id}" ${selected.has(item.id) ? "checked" : ""} onchange="adminApp.refreshToppingPickerCount()" style="margin-top:2px"><span>${this.esc(item.name)}<br><small class="muted">${this.money(item.price)}${item.is_active ? "" : " · đã ẩn"}</small></span></label>`).join("")}</div></section>`;
      })
      .join("");
    return `<div class="field full"><span>Topping áp dụng cho món này</span><div style="display:flex;gap:8px;align-items:center;margin:8px 0"><input id="productToppingSearch" placeholder="Tìm topping hoặc nhóm..." oninput="adminApp.filterProductToppings(this.value)" style="flex:1"><strong id="productToppingCount">0 đã chọn</strong></div><div id="productToppingPicker" style="display:grid;gap:10px;max-height:360px;overflow:auto">${sections || '<p class="muted">Chưa có topping. Hãy tạo topping trước.</p>'}</div></div>`;
  },
  variantPicker(productVariants = []) {
    const activeSizes = this.sizes.filter(s => s.is_active);
    if (!activeSizes.length) return '<div class="field full"><span>Kích cỡ (Biến thể)</span><p class="muted">Chưa có kích cỡ. Hãy tạo kích cỡ trong Quản lý kích cỡ trước.</p></div>';

    // Create a map for quick lookup of existing variants
    const variantMap = {};
    productVariants.forEach(v => {
      variantMap[v.size_name] = v;
    });

    const rows = activeSizes.map(size => {
      const existing = variantMap[size.name];
      const isChecked = !!existing;
      const priceAdj = existing ? existing.price_adjustment : 0;
      const isDefault = existing ? existing.is_default : false;

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:${isChecked ? 'var(--bg-card)' : 'transparent'}">
          <label style="display:flex;align-items:center;gap:8px;margin:0;min-width:120px;cursor:pointer">
            <input type="checkbox" name="product_variant_check" value="${this.esc(size.name)}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.parentElement.style.background = this.checked ? 'var(--bg-card)' : 'transparent'">
            <strong>${this.esc(size.name)}</strong>
          </label>
          <div style="flex:1;display:flex;align-items:center;gap:8px">
            <span class="muted" style="font-size:12px">Giá cộng thêm:</span>
            <input type="number" name="product_variant_price_${this.esc(size.name)}" value="${priceAdj}" style="width:100px;padding:4px 8px" ${isChecked ? '' : ''}>
          </div>
          <label style="display:flex;align-items:center;gap:4px;margin:0;cursor:pointer;font-size:13px">
            <input type="radio" name="product_variant_default" value="${this.esc(size.name)}" ${isDefault ? 'checked' : ''}> Mặc định
          </label>
        </div>
      `;
    }).join('');

    return `
      <div class="field full">
        <span>Kích cỡ (Biến thể)</span>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;max-height:300px;overflow:auto">
          ${rows}
        </div>
        <p class="muted" style="margin-top:4px;font-size:12px">Tích chọn để áp dụng kích cỡ cho món này. Chọn 1 kích cỡ làm Mặc định.</p>
      </div>
    `;
  },
  refreshToppingPickerCount() {
    const root = document.getElementById("productToppingPicker");
    if (!root) return;
    const checked = root.querySelectorAll(
      '[name="product_topping"]:checked',
    ).length;
    const count = document.getElementById("productToppingCount");
    if (count) count.textContent = `${checked} đã chọn`;
    root.querySelectorAll("[data-select-group]").forEach((control) => {
      const items = [
        ...root.querySelectorAll(
          `[name="product_topping"][data-group-id="${control.dataset.selectGroup}"]`,
        ),
      ];
      control.checked = items.length > 0 && items.every((item) => item.checked);
      control.indeterminate =
        items.some((item) => item.checked) && !control.checked;
    });
  },
  toggleToppingGroup(groupId, checked) {
    document
      .querySelectorAll(
        `#productToppingPicker [name="product_topping"][data-group-id="${groupId}"]`,
      )
      .forEach((input) => {
        input.checked = checked;
      });
    this.refreshToppingPickerCount();
  },
  toggleGroupExpand(groupId) {
    const content = document.getElementById(`group-content-${groupId}`);
    const icon = document.getElementById(`group-icon-${groupId}`);
    if (content.style.display === 'none') {
      content.style.display = '';
      icon.className = 'fa-solid fa-chevron-up';
    } else {
      content.style.display = 'none';
      icon.className = 'fa-solid fa-chevron-down';
    }
  },
  filterProductToppings(value) {
    const query = String(value || "")
      .trim()
      .toLowerCase();
    document
      .querySelectorAll("#productToppingPicker .topping-picker-group")
      .forEach((group) => {
        let visible = 0;
        group.querySelectorAll(".topping-picker-item").forEach((item) => {
          const show = !query || item.dataset.search.includes(query);
          item.style.display = show ? "flex" : "none";
          if (show) visible++;
        });
        group.style.display = visible ? "block" : "none";
        if (query && visible) {
          const groupId = group.dataset.group;
          const content = document.getElementById(`group-content-${groupId}`);
          const icon = document.getElementById(`group-icon-${groupId}`);
          if (content) content.style.display = '';
          if (icon) icon.className = 'fa-solid fa-chevron-up';
        }
      });
  },
  formData(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    form
      .querySelectorAll("input[type=checkbox]")
      .forEach((x) => (data[x.name] = x.checked));
    return data;
  },
  async init() {
    if (!window.api.getToken()) {
      location.replace("/?mode=pos");
      return;
    }
    let me;
    try {
      me = await window.api.get("/auth/me");
    } catch (e) {
      this.toast(e.message, true);
      if (e.status === 401 || e.status === 403) {
        window.api.removeToken();
        setTimeout(() => location.replace("/?mode=pos"), 900);
      }
      return;
    }

    try {
      this.me = me.user;
      if (!["SUPER_ADMIN", "ADMIN"].includes(this.me.role)) {
        this.toast("Trang này chỉ dành cho ADMIN hoặc SUPER_ADMIN", true);
        setTimeout(() => location.replace("/?mode=pos"), 900);
        return;
      }
      this.stores = me.stores || [];
      document.getElementById("adminName").textContent =
        this.me.full_name || this.me.username;
      document.getElementById("adminRoleLabel").textContent = this.me.role;
      document.getElementById("adminAccessLabel").textContent = "Toàn quyền quản trị";
      document.getElementById("avatar").textContent = (
        this.me.full_name || "AD"
      )
        .split(" ")
        .map((x) => x[0])
        .slice(-2)
        .join("")
        .toUpperCase();
      this.bind();
      const initialLoads = await Promise.allSettled([
        this.loadStoreTypes(),
        this.loadDashboard(),
      ]);
      const failed = initialLoads.find((result) => result.status === "rejected");
      if (failed) this.toast(failed.reason?.message || "Không thể tải đầy đủ dữ liệu quản trị", true);
    } catch (e) {
      console.error("Admin initialization error:", e);
      this.toast(e.message, true);
    }
  },
  bind() {
    document.getElementById('uploadApkBtn').onclick = () => this.openApkUpload();
    document
      .querySelectorAll("#adminNav button")
      .forEach((btn) => (btn.onclick = () => this.showPage(btn.dataset.page)));
    document.getElementById("logoutBtn").onclick = () => {
      window.api.removeToken();
      location.href = "/?mode=pos";
    };
    document.getElementById("modalClose").onclick = document.getElementById(
      "modalCancel",
    ).onclick = () => this.closeModal();
    document.getElementById("modalForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await this.modalSubmit?.(this.formData(e.target), e.target);
        this.closeModal();
      } catch (err) {
        this.toast(err.message, true);
      }
    };
    document
      .querySelectorAll("[data-refresh]")
      .forEach(
        (btn) => (btn.onclick = () => this.showPage(btn.dataset.refresh, true)),
      );
    document.getElementById("btnFilterAdminReports").onclick = async () => {
      try {
        await this.loadDashboard();
      } catch (error) {
        this.toast(error.message, true);
      }
    };
    document.getElementById("addStoreBtn").onclick = () => this.editStore();
    document.getElementById("addStoreTypeBtn").onclick = () =>
      this.editStoreType();
    document.getElementById("addUserBtn").onclick = () => this.editUser();
    document.getElementById("addProductBtn").onclick = () => this.editProduct();
    document.getElementById("addCategoryBtn").onclick = () =>
      this.manageCategories();
    document.getElementById("manageToppingsBtn").onclick = () =>
      this.manageToppings();
    document.getElementById("manageSizesBtn").onclick = () =>
      this.manageSizes();
    document.getElementById("addAreaBtn").onclick = () => this.editArea();
    document.getElementById("addTableBtn").onclick = () => this.editTable();
    document.getElementById("clearAuditBtn").onclick = () =>
      this.clearAuditLogs();
    document.getElementById("storeSearch").oninput = () => this.renderStores();
    document.getElementById("storeTypeFilter").onchange = () =>
      this.renderStores();
    document.getElementById("userSearch").oninput = () => this.renderUsers();
    document.getElementById("roleFilter").onchange = () => this.renderUsers();
    document.getElementById("productSearch").oninput = () =>
      this.renderProducts();
    document.getElementById("productStore").onchange = async (e) => {
      window.api.setCurrentStoreId(e.target.value);
      await this.loadProducts();
    };
    document.getElementById("adminAddInventoryItemBtn").onclick = () => this.openEditInventoryItem();
    document.getElementById("adminImportInventoryBtn").onclick = () => this.openInventoryTransactionModal('IN');
    document.getElementById("adminExportInventoryBtn").onclick = () => this.openInventoryTransactionModal('OUT');
    document.getElementById("adminAdjustInventoryBtn").onclick = () => this.openInventoryTransactionModal('ADJUST');
    document.getElementById("adminFilterInvReportsBtn").onclick = () => this.loadInventoryReports();
    document.getElementById("adminInvSearch").oninput = () => this.renderInventoryItems();
    document.getElementById("inventoryStoreSelect").onchange = async (e) => {
      window.api.setCurrentStoreId(e.target.value);
      await this.loadInventory();
    };
    document.getElementById("tableStore").onchange = async (e) => {
      window.api.setCurrentStoreId(e.target.value);
      await this.loadTableManagement();
    };
  },
  async showPage(page, refresh = false) {
    document
      .querySelectorAll(".page")
      .forEach((x) => x.classList.toggle("active", x.id === `page-${page}`));
    document
      .querySelectorAll("#adminNav button")
      .forEach((p) => p.classList.toggle("active", p.dataset.page === page));
    const activeNav = document.querySelector(`#adminNav button[data-page="${page}"]`);
    if (activeNav) document.getElementById('pageTitle').textContent = activeNav.textContent.trim();
    if (page === "dashboard") await this.loadDashboard();
    if (page === "stores") await this.loadStores();
    if (page === "storeTypes") await this.loadStoreTypes();
    if (page === "users") await this.prepareUsers();
    if (page === "roleFeatures") await this.loadRoleFeatures();
    if (page === "products") await this.prepareProducts();
    if (page === "tables") await this.prepareTableManagement();
    if (page === "inventory") await this.prepareInventory();
    if (page === "audit") await this.loadAudit();
    if (page === "landing") await window.landingAdmin.load();
    if (page === "apks") {
      try { await this.loadApks(); } catch (error) { this.toast(error.message, true); }
    }
  },
  async loadApks() {
    const body = document.getElementById('apkReleasesList');
    body.innerHTML = '<tr><td colspan="6">Đang tải phiên bản APK...</td></tr>';
    try {
      const { releases } = await window.api.get('/admin/apks');
      const active = releases.find(item => item.isDefault);
      document.getElementById('apkDefaultStatus').textContent = active
        ? `Link /download đang tải phiên bản ${active.version}.`
        : 'Chưa có bản mặc định. Hãy cho phép tải và chọn một phiên bản cho /download.';
      body.innerHTML = releases.map(item => `<tr>
        <td><strong>${this.esc(item.version)}</strong>${item.isDefault ? '<br><span class="badge active">Mặc định</span>' : ''}</td>
        <td>${this.esc(item.filename)}<br><small class="muted">${(item.size / 1024 / 1024).toFixed(2)} MB</small></td>
        <td>${this.esc(new Date(item.createdAt).toLocaleString('vi-VN'))}</td>
        <td><label><input type="checkbox" ${item.enabled ? 'checked' : ''} aria-label="Cho phép tải phiên bản ${this.esc(item.version)}" onchange="adminApp.updateApk('${item.id}',{enabled:this.checked},this)"> Cho phép tải</label></td>
        <td>${item.enabled ? `<a href="${this.esc(item.downloadUrl)}">Tải ${this.esc(item.version)}</a><br><button class="btn ghost small" onclick="adminApp.copyApkLink('${this.esc(item.downloadUrl)}')">Sao chép link</button>` : '<span class="muted">Đã khóa tải</span>'}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          ${!item.isDefault && item.enabled ? `<button class="btn ghost small" onclick="adminApp.updateApk('${item.id}',{isDefault:true},this)">Đặt mặc định</button>` : ''}
          <button class="btn danger small" onclick="adminApp.deleteApk('${item.id}',this)">Xóa</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="6">Chưa có APK. Nhấn “Tải APK lên” để thêm phiên bản đầu tiên.</td></tr>';
    } catch (error) {
      body.innerHTML = '<tr><td colspan="6">Không tải được danh sách APK. Vui lòng thử lại.</td></tr>';
      throw error;
    }
  },
  openApkUpload() {
    this.openModal('Tải phiên bản APK lên', `
      ${this.field('version', 'Phiên bản (ví dụ 1.3.4)', 'text', '', null, true)}
      <label class="field full"><span>File APK (tối đa 150 MB)</span><input name="apk" type="file" accept=".apk" required></label>
      <label class="field full"><span><input name="enabled" type="checkbox" checked> Cho phép người dùng tải phiên bản này</span></label>
      <label class="field full"><span><input name="isDefault" type="checkbox" checked> Dùng phiên bản này cho link /download</span></label>
      <p class="field full" id="apkUploadStatus" role="status"></p>`, async (data, form) => {
      const file = form.elements.apk.files[0];
      if (!file || !/\.apk$/i.test(file.name)) throw new Error('Vui lòng chọn file .apk');
      if (file.size > 150 * 1024 * 1024) throw new Error('File APK vượt giới hạn 150 MB');
      if (data.isDefault && !data.enabled) throw new Error('Bản mặc định phải được cho phép tải');
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      document.getElementById('modalClose').disabled = true;
      document.getElementById('modalCancel').disabled = true;
      document.getElementById('apkUploadStatus').textContent = 'Đang tải APK lên, vui lòng chờ...';
      try {
        const response = await fetch('/api/admin/apks', {
          method: 'POST', body: file,
          headers: { Authorization: `Bearer ${window.api.getToken()}`, 'Content-Type': 'application/vnd.android.package-archive',
            'X-Apk-Version': data.version.trim(), 'X-Apk-Filename': encodeURIComponent(file.name),
            'X-Apk-Enabled': String(data.enabled), 'X-Apk-Default': String(data.isDefault) }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Không tải được file APK lên');
        document.getElementById('apkUploadStatus').textContent = 'Đã tải APK lên.';
        this.toast('Đã lưu phiên bản APK');
        try { await this.loadApks(); } catch { this.toast('Đã lưu APK. Hãy nhấn Làm mới để tải lại danh sách.', true); }
      } catch (error) {
        document.getElementById('apkUploadStatus').textContent = error.message;
        throw error;
      } finally {
        submit.disabled = false;
        document.getElementById('modalClose').disabled = false;
        document.getElementById('modalCancel').disabled = false;
      }
    });
  },
  async updateApk(id, patch, control) {
    control.disabled = true;
    try { await window.api.put(`/admin/apks/${id}`, patch); await this.loadApks(); this.toast('Đã cập nhật phiên bản APK'); }
    catch (error) { if (control.type === 'checkbox') control.checked = !control.checked; this.toast(error.message, true); }
    finally { control.disabled = false; }
  },
  async deleteApk(id, control) {
    if (!confirm('Xóa file APK này? Link tải của phiên bản sẽ ngừng hoạt động. Nếu đây là bản mặc định, cần chọn bản khác cho /download.')) return;
    control.disabled = true;
    try { await window.api.del(`/admin/apks/${id}`); await this.loadApks(); this.toast('Đã xóa phiên bản APK'); }
    catch (error) { this.toast(error.message, true); }
    finally { control.disabled = false; }
  },
  async copyApkLink(url) {
    try { await navigator.clipboard.writeText(new URL(url, location.origin).href); this.toast('Đã sao chép link tải APK'); }
    catch { this.toast('Không sao chép được link. Bạn có thể sao chép địa chỉ từ nút Tải.', true); }
  },
  async loadDashboard() {
    const startDate = document.getElementById("adminReportStartDate")?.value;
    const endDate = document.getElementById("adminReportEndDate")?.value;
    let url = "/admin/dashboard";
    let labelToday = "hôm nay";
    let labelRevenue = "Doanh thu hôm nay";
    let labelOrders = "Đơn hôm nay";
    if (startDate && endDate) {
      url = `/admin/dashboard?startDate=${startDate}&endDate=${endDate}`;
      const formatDt = (d) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
      const rangeStr = `${formatDt(startDate)} - ${formatDt(endDate)}`;
      labelToday = rangeStr;
      labelRevenue = `Doanh thu (${rangeStr})`;
      labelOrders = `Đơn (${rangeStr})`;
    }

    const d = await window.api.get(url);
    document.getElementById("metrics").innerHTML = [
      ["fa-store", "Cửa hàng hoạt động", d.activeStores],
      ["fa-users", "Người dùng hoạt động", d.activeUsers],
      ["fa-receipt", labelOrders, d.todayOrders],
      ["fa-sack-dollar", labelRevenue, this.money(d.todayRevenue)],
      ["fa-calendar", "Doanh thu tháng", this.money(d.monthRevenue)],
    ]
      .map(
        (x) =>
          `<div class="metric"><i class="fa-solid ${x[0]}"></i><strong>${this.esc(x[2])}</strong><span>${x[1]}</span></div>`,
      )
      .join("");
    document.getElementById("dashboardStores").innerHTML =
      (d.stores || [])
        .map(
          (s) =>
            `<tr><td><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:8px;background:var(--primary-light);display:grid;place-items:center;color:var(--primary);font-size:15px"><i class="fa-solid fa-store"></i></div><div><strong>${this.esc(s.name)}</strong><br><small class="muted">${this.esc(s.code || "")}</small></div></div></td><td><span class="badge info">${s.order_count} đơn</span></td><td><strong style="color:var(--primary);font-variant-numeric:tabular-nums">${this.money(s.revenue)}</strong></td></tr>`,
        )
        .join("") ||
      '<tr><td class="empty" colspan="3">Chưa có dữ liệu</td></tr>';
  },
  async loadStores() {
    const r = await window.api.get("/stores");
    this.stores = r.stores || [];
    this.fillStoreControls();
    this.renderStores();
  },
  fillStoreControls() {
    const typeFilter = document.getElementById("storeTypeFilter");
    typeFilter.innerHTML =
      '<option value="">Tất cả loại cửa hàng</option>' +
      this.storeTypes
        .map((t) => `<option value="${t.id}">${this.esc(t.name)}</option>`)
        .join("");
    const productStore = document.getElementById("productStore");
    const current =
      productStore.value ||
      window.api.getCurrentStoreId() ||
      this.stores[0]?.id;
    productStore.innerHTML = this.stores
      .map(
        (s) =>
          `<option value="${s.id}" ${String(s.id) === String(current) ? "selected" : ""}>${this.esc(s.name)}</option>`,
      )
      .join("");
    const tableStore = document.getElementById("tableStore");
    if (tableStore) {
      const tableCurrent =
        tableStore.value ||
        window.api.getCurrentStoreId() ||
        this.stores[0]?.id;
      tableStore.innerHTML = this.stores
        .map(
          (s) =>
            `<option value="${s.id}" ${String(s.id) === String(tableCurrent) ? "selected" : ""}>${this.esc(s.name)}</option>`,
        )
        .join("");
    }
  },
  renderStores() {
    const q = document.getElementById("storeSearch").value.toLowerCase(),
      type = document.getElementById("storeTypeFilter").value;
    const rows = this.stores.filter(
      (s) =>
        (!type || String(s.store_type_id) === type) &&
        `${s.code} ${s.name} ${s.address}`.toLowerCase().includes(q),
    );
    document.getElementById("storesList").innerHTML =
      rows
        .map(
          (s) =>
            `<article class="card"><div class="card-head"><div><h3>${this.esc(s.name)}</h3><p>${this.esc(s.code)} · ${this.esc(s.store_type_name || "Chưa phân loại")}</p></div><span class="badge ${s.status === "ACTIVE" ? "active" : "inactive"}">${s.status === "ACTIVE" ? "HOẠT ĐỘNG" : "TẠM KHÓA"}</span></div><div style="margin-top:14px;display:grid;gap:6px;font-size:12.5px;color:var(--muted)"><div style="display:flex;align-items:flex-start;gap:8px"><i class="fa-solid fa-location-dot" style="color:var(--primary);margin-top:3px;font-size:13px;width:14px"></i><span>${this.esc(s.address || "Chưa cập nhật")}</span></div><div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-phone" style="color:#3b82f6;font-size:13px;width:14px"></i><span>${this.esc(s.phone || "Chưa cập nhật")}</span></div></div><div class="card-actions"><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button class="btn ghost small" onclick="adminApp.configureKdsAnnouncement(${s.id})"><i class="fa-solid fa-volume-high"></i> Cấu hình loa KDS</button><button class="btn ghost small" onclick="adminApp.editStore(${s.id})"><i class="fa-solid fa-gear"></i> Sửa & cấu hình</button><button class="btn ${s.status === "ACTIVE" ? "danger" : "ghost"} small" onclick="adminApp.toggleStore(${s.id})"><i class="fa-solid ${s.status === "ACTIVE" ? "fa-lock" : "fa-unlock"}"></i> ${s.status === "ACTIVE" ? "Tạm khóa" : "Kích hoạt"}</button><button class="btn danger small" onclick="adminApp.deleteStore(${s.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></div></article>`,
        )
        .join("") || '<div class="panel empty">Không tìm thấy cửa hàng</div>';
  },
  async editStore(id) {
    let detail = null,
      s = this.stores.find((x) => x.id === id) || {};
    if (id) detail = await window.api.get(`/stores/${id}`);
    const settings = detail?.settings || {};
    let adminTabs = settings.admin_tabs;
    if (typeof adminTabs === 'string') {
      try { adminTabs = JSON.parse(adminTabs); } catch (_) { adminTabs = {}; }
    }
    adminTabs = adminTabs || {};
    const typeOptions = this.storeTypes.map((t) => ({
      value: t.id,
      label: `${t.code} - ${t.name}`,
    }));
    const html =
      this.field(
        "code",
        "Mã cửa hàng",
        "text",
        s.code || "",
        null,
        false,
        !id,
      ) +
      this.field(
        "name",
        "Tên cửa hàng",
        "text",
        s.name || "",
        null,
        false,
        true,
      ) +
      this.field("display_name", "Tên hiển thị", "text", s.display_name || "") +
      this.field(
        "store_type_id",
        "Loại cửa hàng",
        "select",
        s.store_type_id || "",
        typeOptions,
        false,
        true,
      ) +
      this.field("phone", "Số điện thoại", "text", s.phone || "") +
      this.field("email", "Email", "email", s.email || "") +
      this.field(
        "address",
        "Địa chỉ",
        "textarea",
        s.address || "",
        null,
        true,
      ) +
      this.field("province", "Tỉnh thành", "text", s.province || "") +
      this.field("district", "Quận huyện", "text", s.district || "") +
      (id
        ? this.field(
          "receipt_header",
          "Tên trên hóa đơn",
          "text",
          settings.receipt_header || "",
          null,
          true,
        ) +
        this.field(
          "receipt_footer",
          "Chân hóa đơn",
          "textarea",
          settings.receipt_footer || "",
          null,
          true,
        ) +
        this.field(
          "bank_name",
          "Ngân hàng",
          "text",
          settings.bank_name || "",
        ) +
        this.field(
          "bank_account_number",
          "Số tài khoản",
          "text",
          settings.bank_account_number || "",
        ) +
        this.field(
          "bank_account_holder",
          "Chủ tài khoản",
          "text",
          settings.bank_account_holder || "",
        ) +
        this.field(
          "kds_completion_message",
          "Câu loa khi món hoàn thành",
          "textarea",
          settings.kds_completion_message ||
          "Món ăn {mon}, bàn {ban} đã xong",
          null,
          true,
        ) +
        this.field(
          "takeaway_workspace_enabled",
          "Giao diện chuyên bán mang đi",
          "select",
          String(
            typeof settings.takeaway_workspace_enabled === "boolean"
              ? settings.takeaway_workspace_enabled
              : !!detail?.features?.enableTakeawayWorkspace,
          ),
          [
            { value: "true", label: "Bật" },
            { value: "false", label: "Tắt" },
          ],
          false,
          true,
        ) +
        this.field(
          "product_modifier_popup_enabled",
          "Popup ghi chú / tùy chọn món khi bấm dấu cộng",
          "select",
          String(settings.product_modifier_popup_enabled !== false),
          [
            { value: "true", label: "Bật - Chọn tùy chọn và ghi chú trước khi thêm" },
            { value: "false", label: "Tắt - Thêm thẳng vào giỏ hàng" },
          ],
          false,
          true,
        ) +
        `<p class="field full muted">Khi tắt, dấu cộng thêm 1 món với kích cỡ mặc định, không topping và không ghi chú. Bấm vào thẻ món để chọn tùy chọn hoặc ghi chú khi cần.</p>` +
        this.field(
          "allow_cancel_item",
          "Cho phép đầu bếp hủy món",
          "select",
          String(settings.allow_cancel_item !== false),
          [
            { value: "true", label: "Bật - Đầu bếp được phép hủy món trên KDS" },
            { value: "false", label: "Tắt - Chỉ thu ngân hoặc quản lý được hủy món" },
          ],
          false,
          true,
        ) +
        `<p class="field full muted">Khi tắt, nút Hủy sẽ được ẩn với tài khoản Bếp và backend cũng từ chối yêu cầu hủy món của vai trò này.</p>` +
        `<p class="field full muted">Khi bật, màn bán hàng hỗ trợ nhiều đơn nháp và thông tin giao/nhận cho khách mang đi.</p>` +
        `<p class="field full muted">Biến: <strong>{mon}</strong>, <strong>{ban}</strong>, <strong>{ma_don}</strong>, <strong>{ten_khach_hang}</strong>. Với Takeaway, bàn tự được thay bằng tên khách.</p>` +
        this.field(
          "inventory_transactions_enabled",
          "Nghiệp vụ Phiếu kho (Dành cho Cửa hàng nhỏ)",
          "select",
          String(settings.inventory_transactions_enabled !== false),
          [
            { value: "true", label: "Bật - Đầy đủ nghiệp vụ phiếu kho (Nhập, Xuất, Kiểm kê)" },
            { value: "false", label: "Tắt (Dành cho Cửa hàng nhỏ) - Chỉ CRUD mặt hàng & Thống kê nhập hàng tháng" }
          ],
          false,
          true
        ) +
        `<p class="field full muted">Cửa hàng nhỏ không có thủ kho có thể tắt để quản lý hàng hóa và xem tổng lượng, tổng giá trị nhập trong tháng đơn giản nhất.</p>` +
        `<div class="field full"><label>Cấu hình tab màn Quản trị POS</label><div class="checks">` +
        `<label><input type="checkbox" name="admin_tab_reports" ${adminTabs.reports !== false ? "checked" : ""}> Báo cáo</label>` +
        `<label><input type="checkbox" name="admin_tab_stores" ${adminTabs.stores !== false ? "checked" : ""}> Cửa hàng</label>` +
        `<label><input type="checkbox" name="admin_tab_storeTypes" ${adminTabs.storeTypes !== false ? "checked" : ""}> Luồng & phân quyền</label>` +
        `<label><input type="checkbox" name="admin_tab_products" ${adminTabs.products !== false ? "checked" : ""}> Sản phẩm</label>` +
        `<label><input type="checkbox" name="admin_tab_tables" ${adminTabs.tables !== false ? "checked" : ""}> Phòng bàn</label>` +
        `<label><input type="checkbox" name="admin_tab_staff" ${adminTabs.staff !== false ? "checked" : ""}> Nhân viên</label>` +
        `<label><input type="checkbox" name="admin_tab_inventory" ${adminTabs.inventory !== false ? "checked" : ""}> Quản lý kho</label>` +
        `</div><p class="muted">Bật/tắt hiển thị các tab trong phần Quản trị của giao diện POS đối với cửa hàng này.</p></div>`
        : "");
    this.openModal(
      id ? "Sửa và cấu hình cửa hàng" : "Thêm cửa hàng",
      html,
      async (data) => {
        if (id) {
          data.takeaway_workspace_enabled =
            data.takeaway_workspace_enabled === "true";
          data.allow_cancel_item = data.allow_cancel_item === "true";
          data.product_modifier_popup_enabled = data.product_modifier_popup_enabled === "true";
          data.inventory_transactions_enabled =
            data.inventory_transactions_enabled === "true";
          data.admin_tabs = {
            reports: data.admin_tab_reports === true || data.admin_tab_reports === 'on',
            stores: data.admin_tab_stores === true || data.admin_tab_stores === 'on',
            storeTypes: data.admin_tab_storeTypes === true || data.admin_tab_storeTypes === 'on',
            products: data.admin_tab_products === true || data.admin_tab_products === 'on',
            tables: data.admin_tab_tables === true || data.admin_tab_tables === 'on',
            staff: data.admin_tab_staff === true || data.admin_tab_staff === 'on',
            inventory: data.admin_tab_inventory === true || data.admin_tab_inventory === 'on'
          };
          delete data.admin_tab_reports;
          delete data.admin_tab_stores;
          delete data.admin_tab_storeTypes;
          delete data.admin_tab_products;
          delete data.admin_tab_tables;
          delete data.admin_tab_staff;
          delete data.admin_tab_inventory;
          await window.api.put(`/stores/${id}`, data);
          await window.api.put(`/stores/${id}/settings`, data);
        } else await window.api.post("/stores", data);
        this.toast("Đã lưu cửa hàng");
        await this.loadStores();
      },
    );
  },
  async configureKdsAnnouncement(storeId = null) {
    if (!this.stores.length) await this.loadStores();
    const selectedId = Number(storeId || this.stores[0]?.id);
    if (!selectedId) {
      this.toast("Chưa có cửa hàng để cấu hình", true);
      return;
    }
    const detail = await window.api.get(`/stores/${selectedId}`);
    const options = this.stores.map((store) => ({
      value: store.id,
      label: `${store.code} - ${store.name}`,
    }));
    const defaultMessage = "Món ăn {mon}, bàn {ban} đã xong";
    const html =
      this.field(
        "store_id",
        "Cửa hàng",
        "select",
        selectedId,
        options,
        false,
        true,
      ) +
      this.field(
        "kds_completion_message",
        "Câu loa khi món hoàn thành",
        "textarea",
        detail.settings?.kds_completion_message || defaultMessage,
        null,
        true,
        true,
      ) +
      `<div class="field full"><p class="muted">Biến hỗ trợ: <strong>{mon}</strong> tên món, <strong>{ban}</strong> bàn, <strong>{ma_don}</strong> mã đơn, <strong>{ten_khach_hang}</strong> tên khách. Với Takeaway, biến bàn tự dùng tên khách.</p><button type="button" class="btn ghost" id="previewKdsAnnouncement"><i class="fa-solid fa-volume-high"></i> Nghe thử</button></div>`;
    this.openModal("Cấu hình loa thông báo KDS", html, async (data) => {
      await window.api.put(`/stores/${data.store_id}/settings`, {
        kds_completion_message: data.kds_completion_message,
      });
      this.toast("Đã lưu cấu hình loa KDS");
    });
    const form = document.getElementById("modalForm");
    const messageInput = form.querySelector('[name="kds_completion_message"]');
    messageInput.maxLength = 300;
    form
      .querySelector('[name="store_id"]')
      .addEventListener("change", async (event) => {
        try {
          const storeDetail = await window.api.get(
            `/stores/${event.target.value}`,
          );
          messageInput.value =
            storeDetail.settings?.kds_completion_message || defaultMessage;
        } catch (error) {
          this.toast(error.message, true);
        }
      });
    document.getElementById("previewKdsAnnouncement").onclick = () => {
      const sample = messageInput.value
        .trim()
        .replaceAll("{mon}", "Gà rán giòn cay")
        .replaceAll("{ban}", "05")
        .replaceAll("{ma_don}", "TG-001")
        .replaceAll("{ten_khach_hang}", "Nguyễn Văn An");
      if (!("speechSynthesis" in window)) {
        this.toast("Thiết bị không hỗ trợ đọc bằng loa", true);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sample || defaultMessage);
      utterance.lang = "vi-VN";
      utterance.rate = 0.95;
      utterance.volume = 1;
      const voice = window.speechSynthesis.getVoices().find((item) =>
        String(item.lang || "")
          .toLowerCase()
          .startsWith("vi"),
      );
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    };
  },
  async toggleStore(id) {
    const s = this.stores.find((x) => x.id === id);
    await window.api.put(`/stores/${id}`, {
      status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    this.toast("Đã cập nhật trạng thái");
    await this.loadStores();
  },
  async deleteStore(id) {
    const store = this.stores.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa cửa hàng "${store?.name || id}"? Toàn bộ đơn hàng, sản phẩm, ca làm việc và dữ liệu liên quan sẽ bị xóa vĩnh viễn.`)) return;
    await window.api.del(`/stores/${id}`);
    this.toast("Đã xóa cửa hàng");
    await Promise.all([this.loadStores(), this.loadDashboard()]);
  },
  async loadStoreTypes() {
    const r = await window.api.get("/store-types");
    this.storeTypes = r.storeTypes || [];
    this.renderStoreTypes();
    this.fillStoreControls();
  },
  renderStoreTypes() {
    const el = document.getElementById("storeTypesList");
    if (!el) return;
    el.innerHTML = this.storeTypes
      .map(
        (t) =>
          `<article class="card"><div class="card-head"><div><h3>${this.esc(t.name)}</h3><p>${this.esc(t.code)} · ${this.esc(t.description || "")}</p></div><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button class="btn ghost small" onclick="adminApp.editStoreType(${t.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button class="btn danger small" onclick="adminApp.deleteStoreType(${t.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div><div class="feature-grid">${Object.entries(
            this.featureLabels,
          )
            .map(([code, label]) => {
              const f = (t.features || []).find((x) => x.feature_code === code);
              return `<label class="feature"><span>${label}</span><input type="checkbox" ${f?.enabled ? "checked" : ""} onchange="adminApp.toggleFeature(${t.id},'${code}',this.checked)"></label>`;
            })
            .join("")}</div></article>`,
      )
      .join("");
  },
  editStoreType(id) {
    const t = this.storeTypes.find((x) => x.id === id) || {};
    const html =
      this.field("code", "Mã loại", "text", t.code || "", null, false, !id) +
      this.field("name", "Tên loại", "text", t.name || "", null, false, true) +
      this.field(
        "description",
        "Mô tả",
        "textarea",
        t.description || "",
        null,
        true,
      ) +
      (id
        ? ""
        : `<div class="field full"><label>Tính năng mặc định</label><div class="checks">${Object.entries(
          this.featureLabels,
        )
          .map(
            ([c, l]) =>
              `<label class="check"><input type="checkbox" name="feature_${c}" checked>${l}</label>`,
          )
          .join("")}</div></div>`);
    this.openModal(
      id ? "Sửa loại cửa hàng" : "Thêm loại cửa hàng",
      html,
      async (data) => {
        if (id) await window.api.put(`/store-types/${id}`, data);
        else {
          data.features = Object.keys(this.featureLabels).map((code) => ({
            feature_code: code,
            enabled: !!data[`feature_${code}`],
          }));
          await window.api.post("/store-types", data);
        }
        this.toast("Đã lưu loại cửa hàng");
        await this.loadStoreTypes();
      },
    );
  },
  async toggleFeature(id, code, enabled) {
    try {
      await window.api.put(`/store-types/${id}/features`, {
        feature_code: code,
        enabled,
      });
      this.toast(`Đã ${enabled ? "bật" : "tắt"} ${this.featureLabels[code]}`);
    } catch (e) {
      this.toast(e.message, true);
      await this.loadStoreTypes();
    }
  },
  async deleteStoreType(id) {
    const type = this.storeTypes.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa loại cửa hàng "${type?.name || id}"? Các cửa hàng đang dùng loại này sẽ chuyển thành chưa phân loại.`)) return;
    await window.api.del(`/store-types/${id}`);
    this.toast("Đã xóa loại cửa hàng");
    await this.loadStoreTypes();
    await this.loadStores();
  },
  async loadUsers() {
    const r = await window.api.get("/admin/users");
    this.users = r.users || [];
    this.roles = r.roles || [];
    document.getElementById("roleFilter").innerHTML =
      '<option value="">Tất cả vai trò</option>' +
      this.roles.map((role) => `<option>${role}</option>`).join("");
    this.renderUsers();
  },
  async prepareUsers() {
    await this.loadUsers();
  },
  renderUsers() {
    const q = document.getElementById("userSearch").value.toLowerCase(),
      role = document.getElementById("roleFilter").value;
    const rows = this.users.filter(
      (u) =>
        (!role || u.role === role) &&
        `${u.full_name} ${u.username} ${u.email}`.toLowerCase().includes(q),
    );
    document.getElementById("usersList").innerHTML =
      rows
        .map(
          (u) =>
            `<tr><td><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ffedd5,#fed7aa);color:#ea580c;font-weight:800;font-size:12px;display:grid;place-items:center">${this.esc(u.full_name || "U").split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()}</div><div><strong>${this.esc(u.full_name)}</strong><br><span class="muted">${this.esc(u.username)} · ${this.esc(u.email)}</span></div></div></td><td><span class="badge ${['SUPER_ADMIN', 'ADMIN'].includes(u.role) ? 'info' : u.role === 'STORE_MANAGER' ? 'warning' : 'active'}">${u.role}</span></td><td>${(u.stores || []).map((s) => this.esc(s.name)).join(", ") || '<span class="muted">Toàn hệ thống</span>'}</td><td><span class="badge ${u.status === "ACTIVE" ? "active" : "inactive"}">${u.status}</span></td><td><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button class="btn ghost small" onclick="adminApp.editUser(${u.id})"><i class="fa-solid fa-user-pen"></i> Chỉnh sửa</button>${u.id === this.me.id ? "" : `<button class="btn danger small" onclick="adminApp.deleteUser(${u.id})"><i class="fa-solid fa-trash"></i> Xóa</button>`}</div></div></td></tr>`,
        )
        .join("") ||
      '<tr><td class="empty" colspan="5">Không tìm thấy người dùng</td></tr>';
  },
  editUser(id) {
    const u = this.users.find((x) => x.id === id) || {};
    const roleOpts = (
      this.roles.length
        ? this.roles
        : ["SUPER_ADMIN", "ADMIN", "STORE_MANAGER", "CASHIER", "KITCHEN"]
    ).map((x) => ({ value: x, label: x }));
    const statusOpts = [
      { value: "ACTIVE", label: "Hoạt động" },
      { value: "INACTIVE", label: "Đã khóa" },
    ];
    const assigned = new Set((u.stores || []).map((s) => s.id));
    const html =
      (!id
        ? this.field("username", "Tên đăng nhập", "text", "", null, false, true)
        : "") +
      this.field(
        "full_name",
        "Họ tên",
        "text",
        u.full_name || "",
        null,
        false,
        true,
      ) +
      this.field("email", "Email", "email", u.email || "", null, false, true) +
      this.field("phone", "Số điện thoại", "text", u.phone || "") +
      this.field("role", "Vai trò", "select", u.role || "CASHIER", roleOpts) +
      this.field(
        "status",
        "Trạng thái",
        "select",
        u.status || "ACTIVE",
        statusOpts,
      ) +
      this.field(
        "completed_items_enabled",
        "Quyền xem Món đã xong",
        "select",
        typeof u.completed_items_override === "boolean"
          ? String(u.completed_items_override)
          : "inherit",
        [
          { value: "inherit", label: "Theo nhóm quyền" },
          { value: "true", label: "Bật cho tài khoản này" },
          { value: "false", label: "Tắt cho tài khoản này" },
        ],
      ) +
      this.field(
        "password",
        id ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu",
        "password",
        "",
        null,
        true,
        !id,
      ) +
      `<div class="field full"><label id="storeAssignmentLabel">Cửa hàng được truy cập</label><div class="checks">${this.stores.map((s) => `<label class="check"><input type="checkbox" name="store_${s.id}" ${assigned.has(s.id) ? "checked" : ""}>${this.esc(s.name)}</label>`).join("")}</div></div>`;
    this.openModal(
      id ? "Chỉnh sửa người dùng" : "Tạo người dùng",
      html,
      async (data) => {
        data.store_ids = this.stores
          .filter((s) => data[`store_${s.id}`])
          .map((s) => s.id);
        if (data.role === "STORE_MANAGER" && data.store_ids.length !== 1)
          throw new Error(
            "STORE_MANAGER phải được phân công đúng một cửa hàng",
          );
        if (!data.password) delete data.password;
        data.completed_items_enabled =
          data.completed_items_enabled === "inherit"
            ? null
            : data.completed_items_enabled === "true";
        if (id) await window.api.put(`/admin/users/${id}`, data);
        else await window.api.post("/admin/users", data);
        this.toast("Đã lưu người dùng");
        await this.loadUsers();
      },
    );
    const roleSelect = document.querySelector('#formModal [name="role"]');
    const storeInputs = [
      ...document.querySelectorAll('#formModal input[name^="store_"]'),
    ];
    const syncManagerAssignment = () => {
      const manager = roleSelect.value === "STORE_MANAGER";
      document.getElementById("storeAssignmentLabel").textContent = manager
        ? "Cửa hàng quản lý (chọn đúng 1)"
        : "Cửa hàng được truy cập";
      if (manager) {
        const checked = storeInputs.filter((input) => input.checked);
        checked.slice(1).forEach((input) => {
          input.checked = false;
        });
      }
    };
    storeInputs.forEach((input) =>
      input.addEventListener("change", () => {
        if (roleSelect.value === "STORE_MANAGER" && input.checked)
          storeInputs
            .filter((other) => other !== input)
            .forEach((other) => {
              other.checked = false;
            });
      }),
    );
    roleSelect.addEventListener("change", syncManagerAssignment);
    syncManagerAssignment();
  },
  async deleteUser(id) {
    const user = this.users.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${user?.full_name || user?.username || id}"? Thao tác này không thể hoàn tác.`)) return;
    await window.api.del(`/admin/users/${id}`);
    this.toast("Đã xóa người dùng");
    await this.loadUsers();
  },
  async loadRoleFeatures() {
    const r = await window.api.get("/admin/role-features");
    this.roleFeatureRoles = r.roles || [];
    document.getElementById("roleFeaturesList").innerHTML =
      this.roleFeatureRoles
        .map(
          (group) =>
            `<article class="card"><div class="card-head"><div><h3>${group.role}</h3><p>Bật/tắt quyền sử dụng chức năng cho nhóm này</p></div><span class="badge active">NHÓM QUYỀN</span></div><div class="feature-grid">${group.features.map((feature) => `<label class="feature"><span>${this.roleFeatureLabels[feature.feature_code] || feature.feature_code}</span><input type="checkbox" ${feature.enabled ? "checked" : ""} onchange="adminApp.toggleRoleFeature('${group.role}','${feature.feature_code}',this.checked,this)"></label>`).join("")}</div></article>`,
        )
        .join("");
  },
  async configureOrderWorkflow() {
    if (!this.stores.length) await this.loadStores();
    const storeOptions = this.stores.map((store) => ({
      value: store.id,
      label: `${store.code} - ${store.name}`,
    }));
    const firstStoreId = this.stores[0]?.id;
    const firstDetail = firstStoreId
      ? await window.api.get(`/stores/${firstStoreId}`)
      : null;
    const workflow = firstDetail?.settings?.workflow_definition || {
      name: "Luồng vận hành",
      steps: [],
    };
    const html =
      this.field(
        "store_id",
        "Cửa hàng",
        "select",
        firstStoreId || "",
        storeOptions,
        false,
        true,
      ) +
      this.field(
        "workflow_name",
        "Tên luồng",
        "text",
        workflow.name || "",
        null,
        true,
        true,
      ) +
      `<div class="field full"><div class="workflow-title"><span>Các bước xử lý</span><button type="button" class="btn ghost small" id="addWorkflowStep"><i class="fa-solid fa-plus"></i>Thêm bước</button></div><div id="workflowSteps"></div><p class="muted">Chỉ bắt buộc bước đầu tiên là Tạo đơn và luồng có bước Thanh toán. Bếp và Phê duyệt là các bước tùy chọn; mỗi bước có thể gán nhiều nhóm xử lý.</p></div>`;
    this.openModal("Thiết kế luồng đơn hàng", html, async (data, form) => {
      const steps = [...form.querySelectorAll(".workflow-step")].map(
        (row, index) => ({
          id: row.dataset.id || `step_${index + 1}`,
          name: row.querySelector('[data-field="name"]').value,
          type: row.querySelector('[data-field="type"]').value,
          roles: [...row.querySelectorAll("[data-role]:checked")].map(
            (input) => input.dataset.role,
          ),
        }),
      );
      await window.api.put(`/stores/${data.store_id}/settings`, {
        workflow_definition: { name: data.workflow_name, steps },
      });
      this.toast("Đã cập nhật luồng vận hành cho cửa hàng");
    });
    this.renderWorkflowSteps(workflow.steps || []);
    document.getElementById("addWorkflowStep").onclick = () => {
      const rows = this.readWorkflowSteps();
      rows.push({
        id: `step_${Date.now()}`,
        name: "Bước mới",
        type: "APPROVAL",
        roles: ["STORE_MANAGER"],
      });
      this.renderWorkflowSteps(rows);
    };
    document
      .querySelector('#formModal [name="store_id"]')
      ?.addEventListener("change", async (event) => {
        const detail = await window.api.get(`/stores/${event.target.value}`);
        const value = detail.settings?.workflow_definition || {
          name: "Luồng vận hành",
          steps: [],
        };
        document.querySelector('#formModal [name="workflow_name"]').value =
          value.name || "";
        this.renderWorkflowSteps(value.steps || []);
      });
  },
  readWorkflowSteps() {
    return [...document.querySelectorAll("#workflowSteps .workflow-step")].map(
      (row) => ({
        id: row.dataset.id,
        name: row.querySelector('[data-field="name"]').value,
        type: row.querySelector('[data-field="type"]').value,
        roles: [...row.querySelectorAll("[data-role]:checked")].map(
          (input) => input.dataset.role,
        ),
      }),
    );
  },
  renderWorkflowSteps(steps) {
    const roles = this.roles.length
      ? this.roles
      : [
        "SUPER_ADMIN",
        "ADMIN",
        "STORE_MANAGER",
        "ORDER_STAFF",
        "CASHIER",
        "KITCHEN",
      ];
    const typeLabels = {
      CREATE: "Tạo đơn",
      APPROVAL: "Phê duyệt",
      KITCHEN: "Bếp chế biến",
      PAYMENT: "Thanh toán",
    };
    const el = document.getElementById("workflowSteps");
    if (!el) return;
    el.innerHTML = steps
      .map(
        (step, index) =>
          `<div class="workflow-step" data-id="${this.esc(step.id || `step_${index + 1}`)}"><div class="workflow-index">${index + 1}</div><div class="workflow-fields"><input data-field="name" value="${this.esc(step.name || "")}" placeholder="Tên bước" required><select data-field="type">${Object.entries(
            typeLabels,
          )
            .map(
              ([value, label]) =>
                `<option value="${value}" ${step.type === value ? "selected" : ""}>${label}</option>`,
            )
            .join(
              "",
            )}</select><div class="workflow-roles">${roles.map((role) => `<label><input type="checkbox" data-role="${role}" ${step.roles?.includes(role) ? "checked" : ""}>${role}</label>`).join("")}</div></div><div class="workflow-actions"><button type="button" title="Di chuyển lên" onclick="adminApp.moveWorkflowStep(${index},-1)"><i class="fa-solid fa-arrow-up"></i></button><button type="button" title="Di chuyển xuống" onclick="adminApp.moveWorkflowStep(${index},1)"><i class="fa-solid fa-arrow-down"></i></button><button type="button" title="Xóa bước" onclick="adminApp.removeWorkflowStep(${index})"><i class="fa-solid fa-trash"></i></button></div></div>`,
      )
      .join("");
  },
  moveWorkflowStep(index, direction) {
    const steps = this.readWorkflowSteps(),
      target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    this.renderWorkflowSteps(steps);
  },
  removeWorkflowStep(index) {
    if (!confirm("Bạn có chắc chắn muốn xóa bước xử lý này khỏi luồng đơn hàng?")) return;
    const steps = this.readWorkflowSteps();
    steps.splice(index, 1);
    this.renderWorkflowSteps(steps);
  },
  async toggleRoleFeature(role, featureCode, enabled, input) {
    try {
      await window.api.put(`/admin/role-features/${role}`, {
        feature_code: featureCode,
        enabled,
      });
      this.toast(
        `Đã ${enabled ? "hiển thị" : "ẩn"} ${this.roleFeatureLabels[featureCode]} cho ${role}`,
      );
    } catch (e) {
      input.checked = !enabled;
      this.toast(e.message, true);
    }
  },
  async prepareTableManagement() {
    if (!this.stores.length) await this.loadStores();
    this.fillStoreControls();
    const select = document.getElementById("tableStore");
    const storeId = select.value || this.stores[0]?.id;
    if (!storeId) {
      this.areas = [];
      this.tables = [];
      this.renderTableManagement();
      return;
    }
    select.value = String(storeId);
    window.api.setCurrentStoreId(storeId);
    await this.loadTableManagement();
  },
  async loadTableManagement() {
    const storeId = window.api.getCurrentStoreId();
    let isTakeawayOnly = false;
    try {
      const storeRes = await window.api.get(`/stores/${storeId}`);
      if (storeRes.features?.enableTakeawayWorkspace) {
        isTakeawayOnly = true;
      }
    } catch (e) {
      console.warn('Could not fetch store features for table management:', e);
    }

    this.isTableManagementDisabled = isTakeawayOnly;

    const [areaResult, tableResult] = await Promise.all([
      window.api.get("/areas"),
      window.api.get("/tables"),
    ]);
    this.areas = areaResult.areas || [];
    this.tables = tableResult.tables || [];
    this.renderTableManagement();
  },
  renderTableManagement() {
    const areaList = document.getElementById("adminPageAreasList");
    const tableList = document.getElementById("adminPageTablesList");
    const addAreaBtn = document.getElementById("addAreaBtn");
    const addTableBtn = document.getElementById("addTableBtn");

    if (this.isTableManagementDisabled) {
      if (addAreaBtn) addAreaBtn.style.display = "none";
      if (addTableBtn) addTableBtn.style.display = "none";
      areaList.innerHTML = '<p class="empty">Cửa hàng này đang bật Giao diện bán mang đi. Chức năng Phòng & Bàn bị vô hiệu hóa.</p>';
      tableList.innerHTML = '<p class="empty">Cửa hàng này đang bật Giao diện bán mang đi. Chức năng Phòng & Bàn bị vô hiệu hóa.</p>';
      document.getElementById("areasSummary").textContent = `0 khu vực`;
      document.getElementById("tablesSummary").textContent = `0 bàn`;
      return;
    }

    if (addAreaBtn) addAreaBtn.style.display = "inline-flex";
    if (addTableBtn) addTableBtn.style.display = "inline-flex";

    document.getElementById("areasSummary").textContent =
      `${this.areas.length} khu vực`;
    document.getElementById("tablesSummary").textContent =
      `${this.tables.length} bàn`;
    areaList.innerHTML =
      this.areas
        .map((area) => {
          const count = this.tables.filter(
            (table) => Number(table.area_id) === Number(area.id),
          ).length;
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;overflow:visible"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:8px;background:var(--primary-light);display:grid;place-items:center;color:var(--primary);font-size:15px"><i class="fa-solid fa-vector-square"></i></div><div><strong>${this.esc(area.name)}</strong><br><span class="muted">${count} bàn · Thứ tự ${Number(area.sort_order) || 0}</span></div></div><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editArea(${area.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn danger small" onclick="adminApp.deleteArea(${area.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`;
        })
        .join("") || '<p class="empty">Chưa có khu vực hoặc phòng.</p>';
    tableList.innerHTML =
      this.tables
        .map(
          (table) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;overflow:visible"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;display:grid;place-items:center;color:#64748b;font-size:15px"><i class="fa-solid fa-chair"></i></div><div><strong>${this.esc(table.code)} · ${this.esc(table.name)}</strong><br><span class="muted">${this.esc(table.area_name || "Chưa có khu vực")} · ${Number(table.seats) || 0} chỗ · ${this.tableStatusLabel(table.status)}</span></div></div><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editTable(${table.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn danger small" onclick="adminApp.deleteTable(${table.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`,
        )
        .join("") ||
      '<p class="empty">Chưa có bàn. Hãy tạo khu vực hoặc phòng trước.</p>';
  },
  tableStatusLabel(status) {
    if (status === "EMPTY") return '<span class="badge active">Đang trống</span>';
    if (status === "OCCUPIED") return '<span class="badge warning">Đang có khách</span>';
    if (status === "RESERVED") return '<span class="badge info">Đã đặt trước</span>';
    return `<span class="badge">${this.esc(status || "-")}</span>`;
  },
  editArea(id) {
    const area = this.areas.find((item) => Number(item.id) === Number(id)) || {};
    const html =
      this.field(
        "name",
        "Tên khu vực / phòng",
        "text",
        area.name || "",
        null,
        false,
        true,
      ) +
      this.field(
        "sort_order",
        "Thứ tự hiển thị",
        "number",
        area.sort_order || 0,
      );
    this.openModal(
      id ? "Sửa khu vực / phòng" : "Thêm khu vực / phòng",
      html,
      async (data) => {
        data.sort_order = Number(data.sort_order || 0);
        if (id) await window.api.put(`/areas/${id}`, data);
        else await window.api.post("/areas", data);
        this.toast("Đã lưu khu vực / phòng");
        await this.loadTableManagement();
      },
    );
  },
  async deleteArea(id) {
    const area = this.areas.find((item) => Number(item.id) === Number(id));
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa khu vực / phòng "${area?.name || id}"? Khu vực chỉ có thể xóa khi không còn bàn.`,
      )
    )
      return;
    try {
      await window.api.del(`/areas/${id}`);
      this.toast("Đã xóa khu vực / phòng");
      await this.loadTableManagement();
    } catch (error) {
      this.toast(error.message, true);
    }
  },
  editTable(id) {
    if (!this.areas.length) {
      this.toast("Hãy tạo khu vực / phòng trước khi thêm bàn", true);
      this.editArea();
      return;
    }
    const table =
      this.tables.find((item) => Number(item.id) === Number(id)) || {};
    const areaOptions = this.areas.map((area) => ({
      value: area.id,
      label: area.name,
    }));
    const html =
      this.field(
        "area_id",
        "Khu vực / phòng",
        "select",
        table.area_id || areaOptions[0].value,
        areaOptions,
        false,
        true,
      ) +
      this.field(
        "code",
        "Mã bàn",
        "text",
        table.code || "",
        null,
        false,
        true,
      ) +
      this.field(
        "name",
        "Tên bàn",
        "text",
        table.name || "",
        null,
        false,
        true,
      ) +
      this.field("seats", "Số chỗ", "number", table.seats || 4) +
      this.field(
        "sort_order",
        "Thứ tự hiển thị",
        "number",
        table.sort_order || 0,
      );
    this.openModal(id ? "Sửa bàn" : "Thêm bàn", html, async (data) => {
      data.area_id = Number(data.area_id);
      data.seats = Number(data.seats || 0);
      data.sort_order = Number(data.sort_order || 0);
      if (id) await window.api.put(`/tables/${id}`, data);
      else await window.api.post("/tables", data);
      this.toast("Đã lưu bàn");
      await this.loadTableManagement();
    });
  },
  async deleteTable(id) {
    const table = this.tables.find((item) => Number(item.id) === Number(id));
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa bàn "${table?.name || id}"? Bàn đang có khách hoặc gắn với đơn hàng sẽ không thể xóa.`,
      )
    )
      return;
    try {
      await window.api.del(`/tables/${id}`);
      this.toast("Đã xóa bàn");
      await this.loadTableManagement();
    } catch (error) {
      this.toast(error.message, true);
    }
  },
  async prepareProducts() {
    if (!this.stores.length) await this.loadStores();
    this.fillStoreControls();
    const id =
      document.getElementById("productStore").value || this.stores[0]?.id;
    if (id) {
      window.api.setCurrentStoreId(id);
      await this.loadProducts();
    }
  },
  async loadProducts() {
    const [p, c, t, g, s] = await Promise.all([
      window.api.get("/products?include_inactive=true"),
      window.api.get("/categories"),
      window.api.get("/toppings"),
      window.api.get("/topping-groups"),
      window.api.get("/sizes"),
    ]);
    this.products = p.products || [];
    this.categories = c.categories || [];
    this.toppings = t.toppings || [];
    this.toppingGroups = g.groups || [];
    this.sizes = s.sizes || [];
    this.renderProducts();
  },
  renderProducts() {
    const q = document.getElementById("productSearch").value.toLowerCase();
    const rows = this.products.filter((p) =>
      `${p.code} ${p.name}`.toLowerCase().includes(q),
    );
    document.getElementById("productsList").innerHTML =
      rows
        .map(
          (p) =>
            `<tr><td><strong><span class="admin-product-thumb">${window.productImages.render(p.image_url,p.name)}</span> ${this.esc(p.name)}</strong><br><span class="muted">${this.esc(p.code)} · ${p.options?.length || 0} topping</span></td><td>${this.esc(p.category_name || "-")}</td><td><strong style="color:var(--primary);font-variant-numeric:tabular-nums">${this.money(p.price)}</strong></td><td>${p.kitchen_type === "BAR" ? '<span class="badge info">Pha chế</span>' : '<span class="badge active">Bếp</span>'}</td><td><span class="badge ${p.is_active ? "active" : "inactive"}">${p.is_active ? "ĐANG BÁN" : "NGỪNG BÁN"}</span></td><td><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button class="btn ghost small" onclick="adminApp.editProduct(${p.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button class="btn danger small" onclick="adminApp.deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></td></tr>`,
        )
        .join("") ||
      '<tr><td class="empty" colspan="6">Chưa có sản phẩm</td></tr>';
  },
  editProduct(id) {
    const p = this.products.find((x) => x.id === id) || {};
    const catOpts = [
      { value: "", label: "Không có danh mục" },
      ...this.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
      selectedToppings = this.toppings
        .filter((item) =>
          (item.product_ids || []).map(Number).includes(Number(id)),
        )
        .map((item) => item.id);
    const html =
      this.field(
        "code",
        "Mã sản phẩm",
        "text",
        p.code || "",
        null,
        false,
        true,
      ) +
      this.field(
        "name",
        "Tên sản phẩm",
        "text",
        p.name || "",
        null,
        false,
        true,
      ) +
      this.field(
        "category_id",
        "Danh mục",
        "select",
        p.category_id || "",
        catOpts,
      ) +
      this.field(
        "price",
        "Giá bán",
        "number",
        p.price || 0,
        null,
        false,
        true,
      ) +
      this.field("cost_price", "Giá vốn", "number", p.cost_price || 0) +
      this.field("unit", "Đơn vị", "text", p.unit || "Phần") +
      window.productImages.field(p.image_url) +
      this.field(
        "kitchen_type",
        "Nơi chế biến",
        "select",
        p.kitchen_type || "KITCHEN",
        [
          { value: "KITCHEN", label: "Bếp đồ ăn" },
          { value: "BAR", label: "Quầy pha chế" },
        ],
      ) +
      this.field(
        "description",
        "Mô tả",
        "textarea",
        p.description || "",
        null,
        true,
      ) +
      (id
        ? this.field("is_active", "Trạng thái", "select", String(p.is_active), [
          { value: "true", label: "Đang bán" },
          { value: "false", label: "Ngừng bán" },
        ])
        : "") +
      this.variantPicker(p.variants || []) +
      this.toppingPicker(selectedToppings);
    this.openModal(
      id ? "Sửa sản phẩm" : "Thêm sản phẩm",
      html,
      async (data, form) => {
        await window.productImages.prepare(form, data);
        // Handle variants
        const variants = [];
        const variantChecks = form.querySelectorAll('input[name="product_variant_check"]:checked');
        variantChecks.forEach(check => {
          const sizeName = check.value;
          const priceInput = form.querySelector(`input[name="product_variant_price_${sizeName}"]`);
          const defaultRadio = form.querySelector(`input[name="product_variant_default"][value="${sizeName}"]`);
          variants.push({
            size_name: sizeName,
            price_adjustment: priceInput ? Number(priceInput.value) : 0,
            is_default: defaultRadio ? defaultRadio.checked : false
          });
        });

        // Clean up UI data fields from payload to avoid clutter
        Object.keys(data).forEach(key => {
          if (key.startsWith('product_variant_') || key === 'product_topping') {
            delete data[key];
          }
        });

        data.variants = variants;

        const topping_ids = [
          ...form.querySelectorAll('[name="product_topping"]:checked'),
        ].map((input) => Number(input.value));
        data.category_id = data.category_id ? Number(data.category_id) : null;
        data.price = Number(data.price);
        data.cost_price = Number(data.cost_price || 0);
        let productId = id;
        if (id) {
          data.is_active = data.is_active === "true";
          await window.api.put(`/products/${id}`, data);
        } else {
          const result = await window.api.post("/products", data);
          productId = result.product.id;
        }
        await window.api.put(`/products/${productId}/toppings`, {
          topping_ids,
        });
        this.toast("Đã lưu sản phẩm, kích cỡ và topping");
        await this.loadProducts();
      },
    );
    window.productImages.bind(document.getElementById('modalFields'));
    this.refreshToppingPickerCount();
  },
  async deleteProduct(id) {
    const product = this.products.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa món "${product?.name || id}"? Món sẽ bị xóa vĩnh viễn khỏi thực đơn.`)) return;
    await window.api.del(`/products/${id}`);
    this.toast("Đã xóa sản phẩm");
    await this.loadProducts();
  },
  manageCategories() {
    const rows = this.categories.map((item) => `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;gap:12px;overflow:visible"><span><strong>${this.esc(item.name)}</strong><br><span class="muted">${this.esc(item.code || "")}</span></span><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editCategory(${item.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn danger small" onclick="adminApp.deleteCategory(${item.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`).join("") || '<p class="field full muted">Chưa có danh mục</p>';
    this.openModal("Quản lý danh mục", `<div class="field full"><button type="button" class="btn primary" onclick="adminApp.editCategory()"><i class="fa-solid fa-plus"></i> Thêm danh mục</button></div>${rows}`, null);
  },
  editCategory(id) {
    const item = this.categories.find((category) => category.id === id) || {};
    const html = this.field("code", "Mã danh mục", "text", item.code || "") + this.field("name", "Tên danh mục", "text", item.name || "", null, false, true) + this.field("description", "Mô tả", "textarea", item.description || "", null, true) + this.field("sort_order", "Thứ tự", "number", item.sort_order || 0);
    this.openModal(id ? "Sửa danh mục" : "Thêm danh mục", html, async (data) => {
      data.sort_order = Number(data.sort_order || 0);
      if (id) await window.api.put(`/categories/${id}`, data);
      else await window.api.post("/categories", data);
      this.toast("Đã lưu danh mục");
      await this.loadProducts();
    });
  },
  async deleteCategory(id) {
    const category = this.categories.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${category?.name || id}"? Các món trong danh mục sẽ được giữ lại nhưng không còn thuộc danh mục này.`)) return;
    await window.api.del(`/categories/${id}`);
    this.toast("Đã xóa danh mục");
    await this.loadProducts();
    this.manageCategories();
  },
  addCategory() {
    const html =
      this.field("code", "Mã danh mục", "text", "") +
      this.field("name", "Tên danh mục", "text", "", null, false, true) +
      this.field("description", "Mô tả", "textarea", "", null, true);
    this.openModal("Thêm danh mục", html, async (data) => {
      await window.api.post("/categories", data);
      this.toast("Đã thêm danh mục");
      await this.loadProducts();
    });
  },
  manageSizes() {
    const rows =
      this.sizes
        .map(
          (item) =>
            `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;gap:12px;overflow:visible"><span><strong>${this.esc(item.name)}</strong><br><span class="muted">${this.esc(item.description || "Không có mô tả")} · Sắp xếp: ${item.sort_order} · ${item.is_active ? "Đang dùng" : "Đã ẩn"}</span></span><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editSize(${item.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn danger small" onclick="adminApp.deleteSize(${item.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`,
        )
        .join("") || '<p class="field full muted">Chưa có kích cỡ</p>';
    this.openModal(
      "Quản lý kích cỡ",
      `<div class="field full"><button type="button" class="btn primary" onclick="adminApp.editSize()"><i class="fa-solid fa-plus"></i> Thêm kích cỡ</button></div>${rows}`,
      null,
    );
  },
  editSize(id) {
    const item = this.sizes.find((s) => s.id === id) || {};
    const html =
      this.field("name", "Tên kích cỡ", "text", item.name || "", null, false, true) +
      this.field("description", "Mô tả", "text", item.description || "", null, false, false) +
      this.field("sort_order", "Thứ tự sắp xếp", "number", item.sort_order || 0, null, false, true);
    this.openModal(id ? "Sửa kích cỡ" : "Thêm kích cỡ", html, async (data) => {
      data.sort_order = Number(data.sort_order);
      if (id) await window.api.put(`/sizes/${id}`, data);
      else await window.api.post("/sizes", data);
      this.toast("Đã lưu kích cỡ");
      await this.loadProducts();
      this.manageSizes();
    });
  },
  async deleteSize(id) {
    const item = this.sizes.find((s) => s.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa kích cỡ "${item?.name || id}"?`)) return;
    await window.api.del(`/sizes/${id}`);
    this.toast("Đã xóa kích cỡ");
    await this.loadProducts();
    this.manageSizes();
  },
  manageToppings() {
    const rows =
      this.toppings
        .map(
          (item) =>
            `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;gap:12px;overflow:visible"><span><strong>${this.esc(item.name)}</strong><br><span class="muted">${this.esc(item.group_name || "Chưa phân nhóm")} · ${this.money(item.price)} · ${item.product_ids.length} món · ${item.is_active ? "Đang dùng" : "Đã ẩn"}</span></span><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editTopping(${item.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn ghost small" onclick="adminApp.toggleTopping(${item.id},${!item.is_active})"><i class="fa-solid ${item.is_active ? "fa-eye-slash" : "fa-rotate-left"}"></i> ${item.is_active ? "Ẩn" : "Khôi phục"}</button><button type="button" class="btn danger small" onclick="adminApp.deleteTopping(${item.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`,
        )
        .join("") || '<p class="field full muted">Chưa có topping</p>';
    this.openModal(
      "Quản lý topping",
      `<div class="field full" style="display:flex;gap:8px"><button type="button" class="btn primary" onclick="adminApp.editTopping()"><i class="fa-solid fa-plus"></i> Thêm topping</button><button type="button" class="btn ghost" onclick="adminApp.manageToppingGroups()"><i class="fa-solid fa-folder-tree"></i> Nhóm topping</button></div>${rows}`,
      null,
    );
  },
  editTopping(id) {
    const item = this.toppings.find((topping) => topping.id === id) || {},
      groups = this.toppingGroups
        .filter((group) => group.name.trim().toLowerCase() !== "chưa phân nhóm")
        .map((group) => ({ value: group.id, label: group.name }));
    if (!groups.length) {
      this.toast("Vui lòng tạo nhóm topping trước", true);
      this.manageToppingGroups();
      return;
    }
    const html =
      this.field(
        "name",
        "Tên topping",
        "text",
        item.name || "",
        null,
        false,
        true,
      ) +
      this.field(
        "group_id",
        "Nhóm topping",
        "select",
        groups.some((group) => Number(group.value) === Number(item.group_id))
          ? item.group_id
          : groups[0].value,
        groups,
        false,
        true,
      ) +
      this.field(
        "price",
        "Giá bán thêm",
        "number",
        item.price || 0,
        null,
        false,
        true,
      ) +
      `<p class="field full muted">Sau khi lưu, mở từng món để chọn topping áp dụng cho món đó.</p>`;
    this.openModal(id ? "Sửa topping" : "Thêm topping", html, async (data) => {
      data.group_id = Number(data.group_id);
      data.price = Number(data.price);
      if (id) await window.api.put(`/toppings/${id}`, data);
      else await window.api.post("/toppings", data);
      this.toast("Đã lưu topping");
      await this.loadProducts();
    });
  },
  manageToppingGroups() {
    const rows =
      this.toppingGroups
        .map(
          (group) =>
            `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;overflow:visible"><span><strong>${this.esc(group.name)}</strong><br><span class="muted">${group.topping_count} topping · ${group.is_active ? "Đang dùng" : "Đã ẩn"}</span></span><span><div class="dropdown"><button class="dropdown-toggle" type="button" title="Thao tác"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="dropdown-menu"><button type="button" class="btn ghost small" onclick="adminApp.editToppingGroup(${group.id})"><i class="fa-solid fa-pen"></i> Sửa</button><button type="button" class="btn danger small" onclick="adminApp.deleteToppingGroup(${group.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></div></span></div>`,
        )
        .join("") || '<p class="field full muted">Chưa có nhóm topping</p>';
    this.openModal(
      "Nhóm topping",
      `<div class="field full"><button type="button" class="btn primary" onclick="adminApp.editToppingGroup()"><i class="fa-solid fa-plus"></i> Thêm nhóm</button></div>${rows}`,
      null,
    );
  },
  editToppingGroup(id) {
    const group = this.toppingGroups.find((item) => item.id === id) || {};
    const html =
      this.field(
        "name",
        "Tên nhóm",
        "text",
        group.name || "",
        null,
        false,
        true,
      ) +
      this.field(
        "description",
        "Mô tả",
        "textarea",
        group.description || "",
        null,
        true,
      ) +
      this.field(
        "sort_order",
        "Thứ tự hiển thị",
        "number",
        group.sort_order || 0,
      ) +
      (id
        ? this.field(
          "is_active",
          "Trạng thái",
          "select",
          String(group.is_active),
          [
            { value: "true", label: "Đang dùng" },
            { value: "false", label: "Ẩn" },
          ],
        )
        : "");
    this.openModal(
      id ? "Sửa nhóm topping" : "Thêm nhóm topping",
      html,
      async (data) => {
        data.sort_order = Number(data.sort_order || 0);
        if (id) {
          data.is_active = data.is_active === "true";
          await window.api.put(`/topping-groups/${id}`, data);
        } else await window.api.post("/topping-groups", data);
        this.toast("Đã lưu nhóm topping");
        await this.loadProducts();
        this.manageToppingGroups();
      },
    );
  },
  async toggleTopping(id, is_active) {
    await window.api.put(`/toppings/${id}`, { is_active });
    this.toast("Đã cập nhật topping");
    await this.loadProducts();
    this.manageToppings();
  },
  async deleteTopping(id) {
    const topping = this.toppings.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa topping "${topping?.name || id}"? Topping sẽ bị gỡ khỏi tất cả món và không thể khôi phục.`)) return;
    await window.api.del(`/toppings/${id}`);
    this.toast("Đã xóa topping");
    await this.loadProducts();
    this.manageToppings();
  },
  async deleteToppingGroup(id) {
    const group = this.toppingGroups.find((item) => item.id === id);
    if (!confirm(`Bạn có chắc chắn muốn xóa nhóm topping "${group?.name || id}"? Các topping trong nhóm vẫn được giữ lại và chuyển thành chưa phân nhóm.`)) return;
    await window.api.del(`/topping-groups/${id}`);
    this.toast("Đã xóa nhóm topping");
    await this.loadProducts();
    this.manageToppingGroups();
  },
  async loadAudit() {
    const r = await window.api.get("/admin/audit-logs?limit=200");
    document.getElementById("auditList").innerHTML =
      (r.logs || [])
        .map(
          (x) =>
            `<tr><td><span style="color:var(--muted);font-size:12px;white-space:nowrap"><i class="fa-regular fa-clock" style="margin-right:5px"></i>${x.created_at ? new Date(x.created_at).toLocaleString("vi-VN") : "-"}</span></td><td><strong>${this.esc(x.user_name || `#${x.user_id || "-"}`)}</strong></td><td><span class="badge ${x.action?.includes("DELETE") ? "inactive" : x.action?.includes("CREATE") ? "active" : "info"}">${this.esc(x.action)}</span></td><td><span style="font-weight:600">${this.esc(x.entity_type)}</span> <small class="muted">#${this.esc(x.entity_id || "")}</small></td><td>${this.esc(x.store_name || "-")}</td><td style="font-size:12.5px;color:var(--ink-secondary)">${this.esc(x.details || "")}</td></tr>`,
        )
        .join("") ||
      '<tr><td class="empty" colspan="6">Chưa có nhật ký hệ thống</td></tr>';
  },
  async clearAuditLogs() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống? Thao tác này không thể hoàn tác.")) return;
    await window.api.del("/admin/audit-logs");
    this.toast("Đã xóa toàn bộ nhật ký");
    await this.loadAudit();
  },

  async prepareInventory() {
    const select = document.getElementById("inventoryStoreSelect");
    if (!select) return;
    if (!this.stores.length) await this.loadStores();
    select.innerHTML = this.stores
      .map((s) => `<option value="${s.id}">${this.esc(s.name)}</option>`)
      .join("");
    const currentStoreId = window.api.getCurrentStoreId() || this.stores[0]?.id;
    select.value = currentStoreId;
    window.api.setCurrentStoreId(select.value);

    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const sInput = document.getElementById("adminInvStartDate");
    const eInput = document.getElementById("adminInvEndDate");
    if (sInput && !sInput.value) sInput.value = firstDay;
    if (eInput && !eInput.value) eInput.value = today;

    await this.loadInventory();
  },

  setInvDateRange(preset) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let start = today;
    if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    }
    const sEl = document.getElementById("adminInvStartDate");
    const eEl = document.getElementById("adminInvEndDate");
    if (sEl) sEl.value = start;
    if (eEl) eEl.value = today;
    this.loadInventoryReports();
  },

  async loadInventory() {
    await this.loadInventorySummary();
    await Promise.all([
      this.loadInventoryReports(),
      this.loadInventoryTransactions()
    ]);
  },

  async loadInventorySummary() {
    try {
      const res = await window.api.get("/inventory/summary");
      if (!res.success) return;
      this.inventorySummary = res.summary;
      this.inventoryItems = res.summary.items || [];
      const isSimpleMode = res.summary.inventory_transactions_enabled === false;
      this.isInventorySimpleMode = isSimpleMode;

      const btnExport = document.getElementById("adminExportInventoryBtn");
      const btnAdjust = document.getElementById("adminAdjustInventoryBtn");
      const btnImport = document.getElementById("adminImportInventoryBtn");

      if (btnExport) btnExport.style.display = isSimpleMode ? "none" : "";
      if (btnAdjust) btnAdjust.style.display = isSimpleMode ? "none" : "";
      if (btnImport) btnImport.style.display = isSimpleMode ? "none" : "";

      const metricsEl = document.getElementById("adminInventoryMetrics");
      if (metricsEl) {
        if (isSimpleMode && res.summary.monthly_imports) {
          metricsEl.innerHTML = `
            <div class="card"><div class="card-body"><span class="card-label">Tổng mặt hàng</span><strong class="card-value">${res.summary.totalItems} món</strong></div></div>
            <div class="card"><div class="card-body"><span class="card-label">Tổng giá trị tồn kho</span><strong class="card-value">${this.money(res.summary.totalStockValue)}</strong></div></div>
            <div class="card" style="border-left: 4px solid var(--success);"><div class="card-body"><span class="card-label">Đã nhập tháng ${res.summary.monthly_imports.month}</span><strong class="card-value" style="color:var(--success);">${res.summary.monthly_imports.totalQty} (lượng)</strong></div></div>
            <div class="card" style="border-left: 4px solid var(--primary);"><div class="card-body"><span class="card-label">Tổng tiền nhập tháng ${res.summary.monthly_imports.month}</span><strong class="card-value" style="color:var(--primary);">${this.money(res.summary.monthly_imports.totalValue)}</strong></div></div>
          `;
        } else {
          metricsEl.innerHTML = `
            <div class="card"><div class="card-body"><span class="card-label">Tổng mặt hàng</span><strong class="card-value">${res.summary.totalItems} món</strong></div></div>
            <div class="card"><div class="card-body"><span class="card-label">Tổng giá trị tồn kho</span><strong class="card-value">${this.money(res.summary.totalStockValue)}</strong></div></div>
            <div class="card" style="border-left: 4px solid var(--warning);"><div class="card-body"><span class="card-label">Sắp hết định mức</span><strong class="card-value" style="color:var(--warning);">${res.summary.lowStockCount} món</strong></div></div>
            <div class="card" style="border-left: 4px solid var(--danger);"><div class="card-body"><span class="card-label">Đã cạn kho</span><strong class="card-value" style="color:var(--danger);">${res.summary.outOfStockCount} món</strong></div></div>
          `;
        }
      }

      this.renderInventoryItems();
    } catch (err) {
      console.error("loadInventorySummary error:", err);
      this.toast("Lỗi tải tổng hợp tồn kho", true);
    }
  },

  renderInventoryItems() {
    const query = (document.getElementById("adminInvSearch")?.value || "").trim().toLowerCase();
    const tbody = document.getElementById("adminInventoryTableBody");
    if (!tbody) return;

    const filtered = (this.inventoryItems || []).filter((item) => {
      if (!query) return true;
      return (item.code || "").toLowerCase().includes(query) || (item.name || "").toLowerCase().includes(query) || (item.category || "").toLowerCase().includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;" class="muted">Không có mặt hàng kho nào</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((item) => {
      const isOut = item.current_stock <= 0;
      const isLow = !isOut && item.current_stock <= item.min_stock;
      let statusBadge = `<span class="badge active">Đủ tồn</span>`;
      if (isOut) {
        statusBadge = `<span class="badge inactive">Cạn kho</span>`;
      } else if (isLow) {
        statusBadge = `<span class="badge warning" style="background:var(--warning-bg);color:var(--warning);border:1px solid var(--warning-border);">Sắp hết</span>`;
      }

      const totalVal = Math.round(item.current_stock * item.cost_price);
      return `
        <tr>
          <td><strong>${this.esc(item.code)}</strong></td>
          <td><strong>${this.esc(item.name)}</strong></td>
          <td><span class="badge" style="background:var(--line-light);color:var(--ink-secondary);">${this.esc(item.category || "-")}</span></td>
          <td>${this.esc(item.unit)}</td>
          <td>${this.money(item.cost_price)}</td>
          <td><strong style="color:${isOut ? 'var(--danger)' : (isLow ? 'var(--warning)' : 'inherit')};">${item.current_stock}</strong> <small class="muted">${this.esc(item.unit)}</small></td>
          <td><small class="muted">${item.min_stock} ${this.esc(item.unit)}</small></td>
          <td><strong>${this.money(totalVal)}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;gap:4px;">
              ${this.isInventorySimpleMode ? `<button class="btn primary btn-sm" onclick="adminApp.openQuickImportItem(${item.id})"><i class="fa-solid fa-plus"></i> Nhập</button>` : ''}
              <button class="btn secondary btn-sm" onclick="adminApp.openEditInventoryItem(${item.id})">Sửa</button>
              <button class="btn secondary btn-sm" onclick="adminApp.deleteInventoryItem(${item.id})">${item.is_active ? 'Xóa' : 'Hiện'}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  openQuickImportItem(id) {
    const item = (this.inventoryItems || []).find((i) => i.id === id);
    if (!item) return;

    const html = `
      <div style="margin-bottom:12px;padding:10px;background:var(--bg-light);border-radius:8px;border:1px solid var(--line);">
        <strong style="font-size:15px;color:var(--ink);">${this.esc(item.name)}</strong> <span class="badge">Mã: ${this.esc(item.code)}</span>
        <div style="margin-top:6px;font-size:13px;color:var(--muted);">
          Tồn hiện tại: <strong>${item.current_stock} ${this.esc(item.unit)}</strong> | Giá vốn hiện tại: <strong>${this.money(item.cost_price)}</strong>
        </div>
      </div>
    ` +
      this.field("import_qty", `Số lượng nhập thêm (${this.esc(item.unit)})`, "number", 1, null, true, true) +
      this.field("cost_price", "Đơn giá nhập lần này (VNĐ)", "number", item.cost_price || 0, null, true, true);

    this.openModal("⚡ Nhập thêm hàng nhanh", html, async (data) => {
      const addedQty = Number(data.import_qty || 0);
      if (addedQty <= 0) {
        this.toast("Số lượng nhập thêm phải lớn hơn 0", true);
        return;
      }
      const unitCost = Number(data.cost_price || item.cost_price || 0);
      await window.api.put(`/inventory/items/${id}`, {
        import_qty: addedQty,
        cost_price: unitCost
      });
      this.toast(`Đã nhập thêm ${addedQty} ${item.unit} cho ${item.name}`);
      await this.loadInventory();
    });
  },

  openEditInventoryItem(id) {
    const item = id ? this.inventoryItems.find((i) => i.id === id) : null;
    const catOptions = this.inventoryCategories.map((c) => ({ value: c, label: c }));
    if (item?.category && !this.inventoryCategories.includes(item.category)) {
      catOptions.unshift({ value: item.category, label: item.category });
    }

    const html =
      this.field("code", "Mã mặt hàng (duy nhất)", "text", item?.code || "", null, true, true) +
      this.field("name", "Tên mặt hàng / Nguyên vật liệu", "text", item?.name || "", null, true, true) +
      this.field("category", "Nhóm phân loại", "select", item?.category || "Nguyên liệu", catOptions, true, true) +
      this.field("unit", "Đơn vị tính (kg, g, lít, lon, bao...)", "text", item?.unit || "kg", null, true, true) +
      this.field("cost_price", "Giá vốn / Giá nhập bình quân (VNĐ)", "number", item?.cost_price || 0, null, true, true) +
      this.field("min_stock", "Định mức tồn tối thiểu", "number", item?.min_stock !== undefined ? item.min_stock : 5, null, true, true) +
      (!id ? this.field("current_stock", "Số lượng tồn ban đầu", "number", 0, null, true, false)
        : this.field("current_stock", "Số lượng tồn kho hiện tại (sửa trực tiếp)", "number", item?.current_stock !== undefined ? item.current_stock : 0, null, true, false) +
        this.field("import_qty", "⚡ Hoặc cộng thêm lượng hàng mới nhập (+)", "number", 0, null, true, false)
      );

    this.openModal(id ? "Sửa thông tin mặt hàng kho" : "Thêm mặt hàng kho mới", html, async (data) => {
      data.cost_price = Number(data.cost_price || 0);
      data.min_stock = Number(data.min_stock || 0);
      if (data.current_stock !== undefined) data.current_stock = Number(data.current_stock || 0);
      if (data.import_qty !== undefined) data.import_qty = Number(data.import_qty || 0);

      if (id) {
        await window.api.put(`/inventory/items/${id}`, data);
        this.toast("Cập nhật mặt hàng kho thành công");
      } else {
        await window.api.post("/inventory/items", data);
        this.toast("Thêm mặt hàng kho thành công");
      }
      await this.loadInventory();
    });
  },

  async deleteInventoryItem(id) {
    const item = this.inventoryItems.find((i) => i.id === id);
    if (!item) return;

    if (item.is_active) {
      if (!confirm(`Xác nhận xóa mặt hàng "${item.name}" (${item.code})?`)) return;
      await window.api.del(`/inventory/items/${id}`);
      this.toast("Đã xóa mặt hàng kho");
    } else {
      await window.api.put(`/inventory/items/${id}`, { is_active: true });
      this.toast("Đã khôi phục mặt hàng kho");
    }
    await this.loadInventory();
  },

  openInventoryTransactionModal(type = 'IN') {
    if (this.isInventorySimpleMode) {
      this.openQuickImportItem(this.inventoryItems[0]?.id);
      return;
    }

    const typeLabel = type === 'IN' ? 'Lập phiếu Nhập kho' : (type === 'OUT' ? 'Lập phiếu Xuất kho' : 'Lập phiếu Kiểm kê cân bằng');
    const items = (this.inventoryItems || []).filter((i) => i.is_active);
    if (!items.length) {
      this.toast("Chưa có mặt hàng kho nào", true);
      return;
    }

    const itemOptions = items.map((i) => ({
      value: i.id,
      label: `${i.code} - ${i.name} (Tồn hiện tại: ${i.current_stock} ${i.unit})`
    }));

    const firstItem = items[0];
    const html =
      this.field("item_id", "Chọn mặt hàng", "select", firstItem?.id, itemOptions, true, true) +
      this.field("transaction_type", "Loại phiếu", "select", type, [
        { value: "IN", label: "📥 Nhập kho (Tăng tồn)" },
        { value: "OUT", label: "📤 Xuất kho (Giảm tồn)" },
        { value: "ADJUST", label: "⚖ Cân bằng kiểm kê (Ghi nhận số thực tế)" }
      ], true, true) +
      (type === "ADJUST"
        ? this.field("new_stock", "Số lượng tồn kiểm kê thực tế", "number", firstItem?.current_stock || 0, null, true, true)
        : this.field("quantity", type === "IN" ? "Số lượng nhập" : "Số lượng xuất", "number", 1, null, true, true)
      ) +
      this.field("price", "Đơn giá (VNĐ)", "number", firstItem?.cost_price || 0, null, true, true) +
      this.field("note", "Ghi chú / Lý do", "text", "", null, true, false);

    this.openModal(typeLabel, html, async (data) => {
      data.item_id = Number(data.item_id);
      data.price = Number(data.price || 0);
      if (data.transaction_type === "ADJUST") {
        data.new_stock = Number(data.new_stock);
      } else {
        data.quantity = Number(data.quantity);
      }

      const res = await window.api.post("/inventory/transactions", data);
      this.toast(res.message || "Lập phiếu kho thành công");
      await this.loadInventory();
    });
  },

  async loadInventoryReports() {
    const startDate = document.getElementById("adminInvStartDate")?.value;
    const endDate = document.getElementById("adminInvEndDate")?.value;
    let url = "/inventory/reports";
    if (startDate && endDate) url += `?startDate=${startDate}&endDate=${endDate}`;

    try {
      const res = await window.api.get(url);
      if (!res.success) return;
      const rep = res.report;
      this.inventoryReports = rep;

      const isSimple = (typeof rep.inventory_transactions_enabled === "boolean")
        ? !rep.inventory_transactions_enabled
        : !!this.isInventorySimpleMode;
      const titleEl = document.getElementById("adminInvReportTitle");
      const thead = document.getElementById("adminInvReportsTableHead");
      const tfoot = document.getElementById("adminInvReportsTableFoot");
      const sub = document.getElementById("adminInvReportSubtitle");

      let grandQty = 0;
      let grandTotal = 0;

      (rep.itemsTurnover || []).forEach((item) => {
        const price = Number(item.cost_price || 0);
        const qty = Number(item.in_qty || 0);
        grandQty += qty;
        grandTotal += Math.round(price * qty);
      });

      if (isSimple) {
        if (titleEl) titleEl.textContent = "Thống kê nhập hàng trong tháng (Giá tiền * Số lượng)";
        if (sub) {
          sub.textContent = `Khoảng thời gian: ${startDate} đến ${endDate} · Tổng lượng nhập: ${Math.round(grandQty * 100) / 100} · Tổng số tiền: ${this.money(grandTotal)}`;
        }
        if (thead) {
          thead.innerHTML = `
            <tr>
              <th style="width:120px;">Mã</th>
              <th>Tên mặt hàng</th>
              <th style="width:90px;">ĐVT</th>
              <th style="text-align:right;width:150px;">Giá tiền</th>
              <th style="text-align:right;width:130px;">Số lượng</th>
              <th style="text-align:right;width:240px;">Tổng số tiền = Giá tiền * Số lượng</th>
            </tr>
          `;
        }
      } else {
        if (titleEl) titleEl.textContent = "Thống kê biến động kho theo mặt hàng";
        if (sub && startDate && endDate) {
          sub.textContent = `Khoảng thời gian: ${startDate} đến ${endDate} · Tổng nhập: ${this.money(rep.summary.totalImportValue)} · Tổng xuất: ${this.money(rep.summary.totalExportValue)}`;
        }
        if (thead) {
          thead.innerHTML = `
            <tr>
              <th>Mã</th>
              <th>Tên mặt hàng</th>
              <th>ĐVT</th>
              <th>Giá vốn</th>
              <th>Tồn đầu kỳ</th>
              <th style="color:var(--success)">Tổng nhập</th>
              <th style="color:var(--danger)">Tổng xuất</th>
              <th>Kiểm kê +/-</th>
              <th>Tồn cuối kỳ</th>
              <th>Giá trị tồn cuối</th>
            </tr>
          `;
        }
      }

      const tbody = document.getElementById("adminInvReportsTableBody");
      if (!tbody) return;

      if (!rep.itemsTurnover || !rep.itemsTurnover.length) {
        tbody.innerHTML = `<tr><td colspan="${isSimple ? 6 : 10}" style="text-align:center;padding:24px;" class="muted">Không có dữ liệu trong khoảng thời gian này</td></tr>`;
        if (tfoot) tfoot.innerHTML = "";
        return;
      }

      if (isSimple) {
        tbody.innerHTML = rep.itemsTurnover.map((item) => {
          const price = Number(item.cost_price || 0);
          const qty = Number(item.in_qty || 0);
          const total = Math.round(price * qty);
          return `
            <tr>
              <td><strong>${this.esc(item.code)}</strong></td>
              <td><strong>${this.esc(item.name)}</strong></td>
              <td>${this.esc(item.unit)}</td>
              <td style="text-align:right;">${this.money(price)}</td>
              <td style="text-align:right;"><strong style="color:var(--success);font-size:14px;">${qty}</strong></td>
              <td style="text-align:right;"><strong>${this.money(total)}</strong></td>
            </tr>
          `;
        }).join("");

        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background:var(--bg-light);font-weight:bold;border-top:2px solid var(--line);">
              <td colspan="4" style="text-align:right;font-size:14px;">TỔNG CỘNG ĐÃ NHẬP:</td>
              <td style="text-align:right;color:var(--success);font-size:15px;">${Math.round(grandQty * 100) / 100}</td>
              <td style="text-align:right;color:var(--primary);font-size:15px;">${this.money(grandTotal)}</td>
            </tr>
          `;
        }
      } else {
        tbody.innerHTML = rep.itemsTurnover.map((item) => `
          <tr>
            <td><strong>${this.esc(item.code)}</strong></td>
            <td><strong>${this.esc(item.name)}</strong></td>
            <td>${this.esc(item.unit)}</td>
            <td>${this.money(item.cost_price)}</td>
            <td><strong>${item.initial_stock}</strong></td>
            <td style="color:var(--success);font-weight:600;">+${item.in_qty} <br><small class="muted">(${this.money(item.in_value)})</small></td>
            <td style="color:var(--danger);font-weight:600;">-${item.out_qty} <br><small class="muted">(${this.money(item.out_value)})</small></td>
            <td>${item.adjust_qty !== 0 ? (item.adjust_qty > 0 ? `+${item.adjust_qty}` : item.adjust_qty) : '-'}</td>
            <td><strong style="font-size:14px;">${item.final_stock}</strong></td>
            <td><strong>${this.money(item.final_value)}</strong></td>
          </tr>
        `).join("");

        if (tfoot) tfoot.innerHTML = "";
      }
    } catch (err) {
      console.error("loadInventoryReports error:", err);
    }
  },

  async loadInventoryTransactions() {
    try {
      const res = await window.api.get("/inventory/transactions?limit=50");
      const list = res.transactions || [];
      const tbody = document.getElementById("adminInvTransactionsTableBody");
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;" class="muted">Chưa có giao dịch kho nào</td></tr>';
        return;
      }

      tbody.innerHTML = list.map((t) => {
        let typeBadge = `<span class="badge active">NHẬP KHO</span>`;
        if (t.transaction_type === "OUT") {
          typeBadge = `<span class="badge inactive">XUẤT KHO</span>`;
        } else if (t.transaction_type === "ADJUST") {
          typeBadge = `<span class="badge info">KIỂM KÊ</span>`;
        }

        const dateStr = t.created_at ? new Date(t.created_at).toLocaleString("vi-VN") : "-";
        return `
          <tr>
            <td><small class="muted">${dateStr}</small></td>
            <td><strong>${this.esc(t.transaction_code)}</strong></td>
            <td>${typeBadge}</td>
            <td><strong>${this.esc(t.item_name)}</strong> <small class="muted">(${this.esc(t.item_code)})</small></td>
            <td><strong>${t.quantity}</strong> ${this.esc(t.item_unit || '')}</td>
            <td>${this.money(t.price)}</td>
            <td><strong>${this.money(t.total_amount)}</strong></td>
            <td>${t.stock_before} ➔ <strong>${t.stock_after}</strong></td>
            <td><small>${this.esc(t.user_name || "Hệ thống")}</small></td>
            <td><small class="muted">${this.esc(t.note || "-")}</small></td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error("loadInventoryTransactions error:", err);
    }
  }
};
window.adminApp = adminApp;
document.addEventListener("DOMContentLoaded", () => {
  adminApp.bindSidebar();
  adminApp.init();
});

document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".dropdown-toggle");
  if (toggle) {
    const menu = toggle.nextElementSibling;
    const isShown = menu.classList.contains("show");
    document.querySelectorAll(".dropdown-menu.show").forEach(m => m.classList.remove("show"));
    if (!isShown) menu.classList.add("show");
  } else {
    document.querySelectorAll(".dropdown-menu.show").forEach(m => m.classList.remove("show"));
  }
});
