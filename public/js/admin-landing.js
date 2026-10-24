window.landingAdmin = {
  fields: [],
  async load() {
    const form = document.getElementById('landingEditor');
    const status = document.getElementById('landingEditorStatus');
    form.hidden = true;
    status.textContent = 'Đang tải nội dung...';
    try {
      const data = await window.api.get('/admin/landing');
      this.fields = data.fields;
      const groups = new Map();
      for (const field of this.fields) {
        if (!groups.has(field.group)) groups.set(field.group, []);
        groups.get(field.group).push(field);
      }
      const container = document.getElementById('landingEditorFields');
      container.replaceChildren();
      for (const [group, fields] of groups) {
        const section = document.createElement('details');
        section.open = group === 'hero';
        section.className = 'panel landing-editor-group';
        const summary = document.createElement('summary');
        summary.textContent = `${this.groupName(group)} (${fields.length})`;
        section.append(summary);
        for (const field of fields) {
          const label = document.createElement('label');
          label.className = 'landing-editor-field';
          const name = document.createElement('span');
          name.textContent = this.fieldLabel(field);
          const input = document.createElement(field.type === 'link' ? 'input' : 'textarea');
          input.name = field.key;
          input.maxLength = 3000;
          if (input.tagName === 'TEXTAREA') input.rows = field.value.length > 120 ? 3 : 2;
          input.value = data.overrides[field.key] ?? field.value;
          label.append(name, input);
          section.append(label);
        }
        container.append(section);
      }
      form.hidden = false;
      status.textContent = 'Nội dung dùng chung cho website. Lưu để công khai thay đổi; không ảnh hưởng cấu hình cửa hàng.';
      form.onsubmit = async event => {
        event.preventDefault();
        const button = document.getElementById('landingSave');
        button.disabled = true;
        try {
          const overrides = {};
          for (const field of this.fields) {
            const value = form.elements.namedItem(field.key).value;
            if (value !== field.value) overrides[field.key] = value;
          }
          await window.api.put('/admin/landing', { overrides });
          status.textContent = 'Đã lưu. Mở trang giới thiệu để xem nội dung mới.';
        } catch (error) { status.textContent = 'Chưa lưu: ' + error.message; }
        finally { button.disabled = false; }
      };
      document.getElementById('landingSearch').oninput = event => {
        const query = event.target.value.toLocaleLowerCase('vi');
        container.querySelectorAll('details').forEach(section => {
          let visible = 0;
          section.querySelectorAll('label').forEach(label => {
            const input = label.querySelector('input,textarea');
            label.hidden = !(label.textContent + input.value).toLocaleLowerCase('vi').includes(query);
            if (!label.hidden) visible++;
          });
          section.hidden = visible === 0;
          if (query && visible) section.open = true;
        });
      };
    } catch (error) { status.textContent = 'Không tải được nội dung: ' + error.message; }
    await this.loadLeads();
  },
  groupName(key) {
    return ({ hero: 'Đầu trang', header: 'Menu', footer: 'Chân trang', pricing: 'Bảng giá & gói dịch vụ', contact: 'Liên hệ', industries: 'Ngành hàng', 'about-onesoft': 'Giới thiệu OneSoft', 'pos-features': 'Tính năng',
      'Ngành hàng: grocery': 'Nội dung ngành tạp hóa', 'Ngành hàng: fnb': 'Nội dung ngành ăn uống', 'Ngành hàng: fashion': 'Nội dung ngành thời trang', 'Ngành hàng: hardware': 'Nội dung ngành vật tư & nhà thuốc'
    })[key] || key;
  },
  fieldLabel(field) {
    if (field.key.startsWith('industry.')) {
      const [, , property, index] = field.key.split('.');
      return ({ badge: 'Nhãn giới thiệu', title: 'Tiêu đề', desc: 'Mô tả', bullets: 'Điểm nổi bật', statLabel: 'Tên chỉ số', statValue: 'Giá trị chỉ số' })[property] + (index === undefined ? '' : ' ' + (Number(index) + 1));
    }
    if (field.key.startsWith('price.')) {
      const [, period, plan] = field.key.split('.');
      return 'Giá gói ' + ({ basic: 'Mới mở', pro: 'POS Pro', chain: 'Chuỗi cửa hàng' })[plan] + (period === 'monthly' ? ' — trả theo tháng' : ' — trả theo năm');
    }
    return field.label;
  },
  async loadLeads() {
    const body = document.getElementById('landingLeads');
    body.replaceChildren();
    try {
      const { leads } = await window.api.get('/admin/landing/leads');
      if (!leads.length) { body.textContent = 'Chưa có yêu cầu liên hệ.'; return; }
      for (const lead of leads) {
        const card = document.createElement('article');
        card.className = 'panel';
        const title = document.createElement('strong');
        title.textContent = `${lead.name} — ${lead.phone}`;
        const info = document.createElement('p');
        info.textContent = `${lead.store} · ${lead.industry} · ${lead.package} · ${new Date(lead.createdAt).toLocaleString('vi-VN')}`;
        const note = document.createElement('p');
        note.textContent = lead.note;
        card.append(title, info, note);
        body.append(card);
      }
    } catch (error) { body.textContent = 'Không tải được liên hệ: ' + error.message; }
  }
};
