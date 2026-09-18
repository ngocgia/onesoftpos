const adminApp = {
  me: null,
  stores: [],
  storeTypes: [],
  users: [],
  products: [],
  categories: [],
  toppings: [],
  toppingGroups: [],
  roles: [],
  modalSubmit: null,
  featureLabels: {
    SALE: "Bán hàng",
    TAKEAWAY: "Mang đi",
    DINE_IN: "Tại chỗ",
    TABLE: "Phòng bàn",
    KDS: "Bếp KDS",
    INVOICE: "Hóa đơn",
    QR_PAYMENT: "VietQR",
    INVENTORY: "Kho",
  },
  roleFeatureLabels: {
    POS: "Bán hàng POS",
    TABLES: "Phòng bàn",
    KDS: "Bếp KDS",
    ORDERS: "Đơn hàng",
    HISTORY: "Lịch sử",
    PAYMENT: "Thu tiền & thanh toán",
    ADMIN: "Quản trị cửa hàng",
    SHIFT: "Quản lý ca",
    DISCOUNT: "Áp dụng giảm giá",
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
        return `<section class="topping-picker-group" data-group="${group.id}" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px"><label style="display:flex;justify-content:space-between;gap:8px;font-weight:700"><span>${this.esc(group.name)} <small class="muted">(${items.length})</small></span><span><input type="checkbox" data-select-group="${group.id}" onchange="adminApp.toggleToppingGroup('${group.id}',this.checked)"> Chọn cả nhóm</span></label><div class="feature-grid" style="margin-top:8px">${items.map((item) => `<label class="feature topping-picker-item" data-search="${this.esc(`${item.name} ${group.name}`.toLowerCase())}"><span>${this.esc(item.name)}<br><small class="muted">${this.money(item.price)}${item.is_active ? "" : " · đã ẩn"}</small></span><input type="checkbox" name="product_topping" data-group-id="${group.id}" value="${item.id}" ${selected.has(item.id) ? "checked" : ""} onchange="adminApp.refreshToppingPickerCount()"></label>`).join("")}</div></section>`;
      })
      .join("");
    return `<div class="field full"><span>Topping áp dụng cho món này</span><div style="display:flex;gap:8px;align-items:center;margin:8px 0"><input id="productToppingSearch" placeholder="Tìm topping hoặc nhóm..." oninput="adminApp.filterProductToppings(this.value)" style="flex:1"><strong id="productToppingCount">0 đã chọn</strong></div><div id="productToppingPicker" style="display:grid;gap:10px;max-height:360px;overflow:auto">${sections || '<p class="muted">Chưa có topping. Hãy tạo topping trước.</p>'}</div></div>`;
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
      location.href = "/";
      return;
    }
    try {
      const me = await window.api.get("/auth/me");
      this.me = me.user;
      if (!["SUPER_ADMIN", "ADMIN"].includes(this.me.role)) {
        this.toast("Trang này chỉ dành cho ADMIN hoặc SUPER_ADMIN", true);
        setTimeout(() => (location.href = "/"), 900);
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
      await Promise.all([this.loadStoreTypes(), this.loadDashboard()]);
    } catch (e) {
      this.toast(e.message, true);
      setTimeout(() => (location.href = "/"), 900);
    }
  },
  bind() {
    document
      .querySelectorAll("#adminNav button")
      .forEach((btn) => (btn.onclick = () => this.showPage(btn.dataset.page)));
    document.getElementById("logoutBtn").onclick = () => {
      window.api.removeToken();
      location.href = "/";
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
    document.getElementById("addStoreBtn").onclick = () => this.editStore();
    document.getElementById("addStoreTypeBtn").onclick = () =>
      this.editStoreType();
    document.getElementById("addUserBtn").onclick = () => this.editUser();
    document.getElementById("addProductBtn").onclick = () => this.editProduct();
    document.getElementById("addCategoryBtn").onclick = () =>
      this.manageCategories();
    document.getElementById("manageToppingsBtn").onclick = () =>
      this.manageToppings();
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
  },
  async showPage(page, refresh = false) {
    document
      .querySelectorAll(".page")
      .forEach((x) => x.classList.toggle("active", x.id === `page-${page}`));
    document
      .querySelectorAll("#adminNav button")
      .forEach((x) => x.classList.toggle("active", x.dataset.page === page));
    const titles = {
      dashboard: "Tổng quan",
      stores: "Quản lý cửa hàng",
      storeTypes: "Loại cửa hàng & tính năng",
      users: "Người dùng & phân quyền",
      roleFeatures: "Hiển thị theo nhóm",
      products: "Danh mục & sản phẩm",
      audit: "Nhật ký hệ thống",
    };
    document.getElementById("pageTitle").textContent = titles[page];
    if (page === "dashboard") await this.loadDashboard();
    if (page === "stores") await this.loadStores();
    if (page === "storeTypes" && refresh) await this.loadStoreTypes();
    if (page === "users") await this.loadUsers();
    if (page === "roleFeatures") await this.loadRoleFeatures();
    if (page === "products") await this.prepareProducts();
    if (page === "audit") await this.loadAudit();
  },
  async loadDashboard() {
    const d = await window.api.get("/admin/dashboard");
    document.getElementById("metrics").innerHTML = [
      ["fa-store", "Cửa hàng hoạt động", d.activeStores],
      ["fa-users", "Người dùng hoạt động", d.activeUsers],
      ["fa-receipt", "Đơn hôm nay", d.todayOrders],
      ["fa-sack-dollar", "Doanh thu hôm nay", this.money(d.todayRevenue)],
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
            `<tr><td><strong>${this.esc(s.name)}</strong></td><td>${s.order_count}</td><td><strong>${this.money(s.revenue)}</strong></td></tr>`,
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
            `<article class="card"><div class="card-head"><div><h3>${this.esc(s.name)}</h3><p>${this.esc(s.code)} · ${this.esc(s.store_type_name || "Chưa phân loại")}</p></div><span class="badge ${s.status === "ACTIVE" ? "active" : "inactive"}">${s.status === "ACTIVE" ? "HOẠT ĐỘNG" : "TẠM KHÓA"}</span></div><p style="margin-top:12px"><i class="fa-solid fa-location-dot"></i> ${this.esc(s.address || "Chưa cập nhật")}<br><i class="fa-solid fa-phone"></i> ${this.esc(s.phone || "Chưa cập nhật")}</p><div class="card-actions"><button class="btn ghost small" onclick="adminApp.configureKdsAnnouncement(${s.id})"><i class="fa-solid fa-volume-high"></i> Loa KDS</button><button class="btn ghost small" onclick="adminApp.editStore(${s.id})">Sửa & cấu hình</button><button class="btn ${s.status === "ACTIVE" ? "danger" : "ghost"} small" onclick="adminApp.toggleStore(${s.id})">${s.status === "ACTIVE" ? "Tạm khóa" : "Kích hoạt"}</button><button class="btn danger small" onclick="adminApp.deleteStore(${s.id})"><i class="fa-solid fa-trash"></i> Xóa</button></div></article>`,
        )
        .join("") || '<div class="panel empty">Không tìm thấy cửa hàng</div>';
  },
  async editStore(id) {
    let detail = null,
      s = this.stores.find((x) => x.id === id) || {};
    if (id) detail = await window.api.get(`/stores/${id}`);
    const settings = detail?.settings || {};
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
          `<p class="field full muted">Biến: <strong>{mon}</strong>, <strong>{ban}</strong>, <strong>{ma_don}</strong>, <strong>{ten_khach_hang}</strong>. Với Takeaway, bàn tự được thay bằng tên khách.</p>`
        : "");
    this.openModal(
      id ? "Sửa và cấu hình cửa hàng" : "Thêm cửa hàng",
      html,
      async (data) => {
        if (id) {
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
          `<article class="card"><div class="card-head"><div><h3>${this.esc(t.name)}</h3><p>${this.esc(t.code)} · ${this.esc(t.description || "")}</p></div><span><button class="btn ghost small" onclick="adminApp.editStoreType(${t.id})">Sửa</button> <button class="btn danger small" onclick="adminApp.deleteStoreType(${t.id})">Xóa</button></span></div><div class="feature-grid">${Object.entries(
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
            `<tr><td><strong>${this.esc(u.full_name)}</strong><br><span class="muted">${this.esc(u.username)} · ${this.esc(u.email)}</span></td><td><span class="badge active">${u.role}</span></td><td>${(u.stores || []).map((s) => this.esc(s.name)).join(", ") || '<span class="muted">Toàn hệ thống</span>'}</td><td><span class="badge ${u.status === "ACTIVE" ? "active" : "inactive"}">${u.status}</span></td><td><button class="btn ghost small" onclick="adminApp.editUser(${u.id})">Chỉnh sửa</button> ${u.id === this.me.id ? "" : `<button class="btn danger small" onclick="adminApp.deleteUser(${u.id})">Xóa</button>`}</td></tr>`,
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
            `<article class="card"><div class="card-head"><div><h3>${group.role}</h3><p>Cấu hình các chức năng được hiển thị cho nhóm này</p></div><span class="badge active">NHÓM QUYỀN</span></div><div class="feature-grid">${group.features.map((feature) => `<label class="feature"><span>${this.roleFeatureLabels[feature.feature_code] || feature.feature_code}</span><input type="checkbox" ${feature.enabled ? "checked" : ""} onchange="adminApp.toggleRoleFeature('${group.role}','${feature.feature_code}',this.checked,this)"></label>`).join("")}</div></article>`,
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
      `<div class="field full"><div class="workflow-title"><span>Các bước xử lý</span><button type="button" class="btn ghost small" id="addWorkflowStep"><i class="fa-solid fa-plus"></i>Thêm bước</button></div><div id="workflowSteps"></div><p class="muted">Bước đầu tiên phải là Tạo đơn. Có thể thêm nhiều bước Phê duyệt và gán nhiều nhóm xử lý.</p></div>`;
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
            )}</select><div class="workflow-roles">${roles.map((role) => `<label><input type="checkbox" data-role="${role}" ${step.roles?.includes(role) ? "checked" : ""}>${role}</label>`).join("")}</div></div><div class="workflow-actions"><button type="button" title="Lên" onclick="adminApp.moveWorkflowStep(${index},-1)">↑</button><button type="button" title="Xuống" onclick="adminApp.moveWorkflowStep(${index},1)">↓</button><button type="button" title="Xóa" onclick="adminApp.removeWorkflowStep(${index})">×</button></div></div>`,
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
    const [p, c, t, g] = await Promise.all([
      window.api.get("/products?include_inactive=true"),
      window.api.get("/categories"),
      window.api.get("/toppings"),
      window.api.get("/topping-groups"),
    ]);
    this.products = p.products || [];
    this.categories = c.categories || [];
    this.toppings = t.toppings || [];
    this.toppingGroups = g.groups || [];
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
            `<tr><td><strong>${this.esc(p.image_url || "🍗")} ${this.esc(p.name)}</strong><br><span class="muted">${this.esc(p.code)} · ${p.options?.length || 0} topping</span></td><td>${this.esc(p.category_name || "-")}</td><td><strong>${this.money(p.price)}</strong></td><td>${p.kitchen_type === "BAR" ? "Pha chế" : "Bếp"}</td><td><span class="badge ${p.is_active ? "active" : "inactive"}">${p.is_active ? "ĐANG BÁN" : "NGỪNG BÁN"}</span></td><td><button class="btn ghost small" onclick="adminApp.editProduct(${p.id})">Sửa</button> <button class="btn danger small" onclick="adminApp.deleteProduct(${p.id})">Xóa</button></td></tr>`,
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
      this.field("image_url", "Ảnh hoặc emoji", "text", p.image_url || "🍗") +
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
      this.toppingPicker(selectedToppings);
    this.openModal(
      id ? "Sửa sản phẩm" : "Thêm sản phẩm",
      html,
      async (data, form) => {
        delete data.product_topping;
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
        this.toast("Đã lưu sản phẩm và topping");
        await this.loadProducts();
      },
    );
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
    const rows = this.categories.map((item) => `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span><strong>${this.esc(item.name)}</strong><br><span class="muted">${this.esc(item.code || "")}</span></span><span><button type="button" class="btn ghost small" onclick="adminApp.editCategory(${item.id})">Sửa</button> <button type="button" class="btn danger small" onclick="adminApp.deleteCategory(${item.id})">Xóa</button></span></div>`).join("") || '<p class="field full muted">Chưa có danh mục</p>';
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
  manageToppings() {
    const rows =
      this.toppings
        .map(
          (item) =>
            `<div class="field full" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span><strong>${this.esc(item.name)}</strong><br><span class="muted">${this.esc(item.group_name || "Chưa phân nhóm")} · ${this.money(item.price)} · ${item.product_ids.length} món · ${item.is_active ? "Đang dùng" : "Đã ẩn"}</span></span><span><button type="button" class="btn ghost small" onclick="adminApp.editTopping(${item.id})">Sửa</button> <button type="button" class="btn ghost small" onclick="adminApp.toggleTopping(${item.id},${!item.is_active})">${item.is_active ? "Ẩn" : "Khôi phục"}</button> <button type="button" class="btn danger small" onclick="adminApp.deleteTopping(${item.id})">Xóa</button></span></div>`,
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
            `<div class="field full" style="display:flex;justify-content:space-between;align-items:center"><span><strong>${this.esc(group.name)}</strong><br><span class="muted">${group.topping_count} topping · ${group.is_active ? "Đang dùng" : "Đã ẩn"}</span></span><span><button type="button" class="btn ghost small" onclick="adminApp.editToppingGroup(${group.id})">Sửa</button> <button type="button" class="btn danger small" onclick="adminApp.deleteToppingGroup(${group.id})">Xóa</button></span></div>`,
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
            `<tr><td>${x.created_at ? new Date(x.created_at).toLocaleString("vi-VN") : "-"}</td><td>${this.esc(x.user_name || `#${x.user_id || "-"}`)}</td><td><strong>${this.esc(x.action)}</strong></td><td>${this.esc(x.entity_type)} #${this.esc(x.entity_id || "")}</td><td>${this.esc(x.store_name || "-")}</td><td>${this.esc(x.details || "")}</td></tr>`,
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
};
window.adminApp = adminApp;
document.addEventListener("DOMContentLoaded", () => adminApp.init());
