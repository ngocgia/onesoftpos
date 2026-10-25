// Shared product photo picker and renderer for POS and both administration pages.
window.productImages = {
  editors: new WeakMap(),
  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  },
  render(value, name = 'Ảnh món ăn') {
    const image = String(value || '🍗').trim();
    const isImage = /^https?:\/\//i.test(image) || /^\/(?!\/)/.test(image)
      || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image);
    if (!isImage) return this.escape(image);
    return `<img class="product-photo" src="${this.escape(image)}" alt="${this.escape(name)}" loading="lazy" decoding="async" onerror="this.replaceWith(document.createTextNode('🍗'))">`;
  },
  field(value) {
    return `<div class="field full form-group product-image-editor" data-product-image-editor>
      <span>Ảnh món ăn</span>
      <div class="product-image-controls">
        <div class="product-image-preview" data-image-preview>${this.render(value)}</div>
        <div class="product-image-picker">
          <label>Chọn ảnh từ thiết bị<input type="file" accept="image/jpeg,image/png,image/webp" data-image-file></label>
          <small>JPG, PNG hoặc WebP, tối đa 10 MB. Ảnh được tự động thu nhỏ khi lưu.</small>
          <button type="button" data-image-remove>Xóa ảnh</button>
        </div>
      </div>
      <label>Đường dẫn ảnh hoặc emoji<input class="form-input" type="text" name="image_url" value="${this.escape(value || '🍗')}" placeholder="https://... hoặc 🍗"></label>
      <small data-image-status role="status" aria-live="polite"></small>
    </div>`;
  },
  bind(container) {
    const root = container?.querySelector('[data-product-image-editor]');
    if (!root) return;
    const state = { storeId: String(window.api.getCurrentStoreId()), sequence: 0, dataUrl: null, pending: null, error: null };
    this.editors.set(root, state);
    const input = root.querySelector('[name="image_url"]');
    const picker = root.querySelector('[data-image-file]');
    const status = root.querySelector('[data-image-status]');
    const preview = value => { root.querySelector('[data-image-preview]').innerHTML = this.render(value); };
    const reset = () => {
      state.sequence++;
      state.dataUrl = state.pending = state.error = null;
      picker.value = '';
      status.textContent = '';
      preview(input.value);
    };
    input.addEventListener('input', reset);
    root.querySelector('[data-image-remove]').addEventListener('click', () => { input.value = '🍗'; reset(); });
    picker.addEventListener('change', () => {
      const file = picker.files[0];
      if (!file) return;
      const sequence = ++state.sequence;
      state.dataUrl = null;
      state.error = null;
      status.textContent = 'Đang xử lý ảnh...';
      state.pending = this.optimize(file).then(dataUrl => {
        if (sequence !== state.sequence) return;
        state.dataUrl = dataUrl;
        preview(dataUrl);
        status.textContent = 'Đã chọn ảnh. Bấm Lưu để cập nhật món ăn.';
      }).catch(error => {
        if (sequence !== state.sequence) return;
        state.dataUrl = null;
        state.error = error;
        status.textContent = error.message;
      });
    });
  },
  async optimize(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
    if (file.size > 10 * 1024 * 1024) throw new Error('Vui lòng chọn ảnh có dung lượng tối đa 10 MB');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Không đọc được ảnh đã chọn'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const photo = new Image();
      photo.onload = () => resolve(photo);
      photo.onerror = () => reject(new Error('File ảnh bị lỗi hoặc không đúng định dạng'));
      photo.src = dataUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ảnh không hợp lệ');
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.86, .72, .58]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length < 1300000) return result;
    }
    throw new Error('Ảnh quá lớn sau khi xử lý. Vui lòng chọn ảnh nhỏ hơn.');
  },
  async prepare(form, data) {
    const root = form.querySelector('[data-product-image-editor]');
    const state = this.editors.get(root);
    if (!state) return;
    let pending;
    do {
      pending = state.pending;
      await pending;
    } while (pending !== state.pending);
    if (state.error) throw state.error;
    if (String(window.api.getCurrentStoreId()) !== state.storeId) throw new Error('Cửa hàng đã thay đổi. Vui lòng mở lại món ăn để chỉnh sửa.');
    if (!state.dataUrl) return;
    if (state.saving) throw new Error('Đang tải ảnh lên, vui lòng đợi');
    const status = root.querySelector('[data-image-status]');
    const sequence = state.sequence;
    state.saving = true;
    status.textContent = 'Đang tải ảnh lên...';
    try {
      const result = await window.api.post('/product-images', { image: state.dataUrl });
      if (String(window.api.getCurrentStoreId()) !== state.storeId) throw new Error('Cửa hàng đã thay đổi. Vui lòng mở lại món ăn để chỉnh sửa.');
      if (sequence !== state.sequence) throw new Error('Ảnh đã thay đổi trong khi tải lên. Vui lòng bấm Lưu lại.');
      data.image_url = result.image_url;
      root.querySelector('[name="image_url"]').value = result.image_url;
      state.dataUrl = null;
      status.textContent = 'Đã tải ảnh lên.';
    } catch (error) {
      status.textContent = error.message;
      throw error;
    } finally {
      state.saving = false;
    }
  }
};
