/**
 * OnesoftPOS - Menu Image Scanner & Batch Import Controller
 */

(function () {
  'use strict';

  const menuScanner = {
    modal: null,
    imageDataUrl: null,
    imageFile: null,
    extractedItems: [],
    zoomLevel: 1,
    currentEngine: 'auto',
    activeStoreId: null,

    init() {
      this.modal = document.getElementById('scanMenuModal');
      if (!this.modal) return;

      this.bindEvents();
    },

    bindEvents() {
      // Open button on products page
      const scanBtn = document.getElementById('scanMenuBtn');
      if (scanBtn) {
        scanBtn.addEventListener('click', () => this.open());
      }

      // Close buttons
      this.modal.querySelectorAll('[data-scan-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      // Drag & Drop
      const dropzone = document.getElementById('scanDropzone');
      const fileInput = document.getElementById('scanFileInput');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        ['dragenter', 'dragover'].forEach((eventName) => {
          dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
          });
        });

        ['dragleave', 'drop'].forEach((eventName) => {
          dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
          });
        });

        dropzone.addEventListener('drop', (e) => {
          const dt = e.dataTransfer;
          if (dt && dt.files && dt.files[0]) {
            this.handleFileSelect(dt.files[0]);
          }
        });
      }

      // Clipboard Paste support (Ctrl+V)
      window.addEventListener('paste', (e) => {
        if (!this.modal || !this.modal.classList.contains('open')) return;
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              this.handleFileSelect(blob);
              break;
            }
          }
        }
      });

      // Re-upload button
      const reuploadBtn = document.getElementById('scanReuploadBtn');
      if (reuploadBtn) {
        reuploadBtn.addEventListener('click', () => this.resetUploadState());
      }

      // Start scan button
      const startScanBtn = document.getElementById('btnStartScan');
      if (startScanBtn) {
        startScanBtn.addEventListener('click', () => this.startScan());
      }

      // Engine selector change
      const engineSelect = document.getElementById('scanEngineSelect');
      if (engineSelect) {
        engineSelect.addEventListener('change', (e) => {
          this.currentEngine = e.target.value;
        });
      }

      // Zoom controls in review
      document.getElementById('scanZoomIn')?.addEventListener('click', () => this.changeZoom(0.2));
      document.getElementById('scanZoomOut')?.addEventListener('click', () => this.changeZoom(-0.2));
      document.getElementById('scanZoomReset')?.addEventListener('click', () => this.setZoom(1));

      // Table controls in review
      document.getElementById('scanSelectAll')?.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });

      document.getElementById('scanAddRowBtn')?.addEventListener('click', () => {
        this.addNewRow();
      });

      document.getElementById('scanFilterInput')?.addEventListener('input', (e) => {
        this.filterTable(e.target.value);
      });

      // Footer actions
      document.getElementById('btnScanRescan')?.addEventListener('click', () => this.resetUploadState());
      document.getElementById('btnConfirmBatchSave')?.addEventListener('click', () => this.confirmImport());
    },

    open() {
      if (!this.modal) return;
      this.activeStoreId = window.api.currentStoreId;
      this.resetUploadState();
      this.modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    close() {
      if (!this.modal) return;
      this.modal.classList.remove('open');
      document.body.style.overflow = '';
    },

    handleFileSelect(file) {
      if (!file) return;

      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        window.adminApp?.toast?.('Chỉ hỗ trợ file ảnh JPG, PNG hoặc WebP', true);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        window.adminApp?.toast?.('Dung lượng ảnh vượt quá giới hạn 10MB', true);
        return;
      }

      this.imageFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageDataUrl = e.target.result;
        this.showSelectedFilePreview(file.name, file.size, this.imageDataUrl);
      };
      reader.readAsDataURL(file);
    },

    showSelectedFilePreview(name, size, dataUrl) {
      const dropzone = document.getElementById('scanDropzone');
      const previewBox = document.getElementById('scanUploadPreviewBox');
      const thumb = document.getElementById('scanPreviewThumb');
      const nameEl = document.getElementById('scanPreviewFilename');
      const sizeEl = document.getElementById('scanPreviewFilesize');
      const beamImg = document.getElementById('scanBeamImg');

      if (dropzone) dropzone.style.display = 'none';
      if (previewBox) previewBox.style.display = 'flex';

      if (thumb) thumb.src = dataUrl;
      if (beamImg) beamImg.src = dataUrl;
      if (nameEl) nameEl.textContent = name;
      if (sizeEl) sizeEl.textContent = this.formatFileSize(size);

      document.getElementById('btnStartScan')?.removeAttribute('disabled');
    },

    resetUploadState() {
      this.imageDataUrl = null;
      this.imageFile = null;
      this.extractedItems = [];
      this.zoomLevel = 1;

      const dropzone = document.getElementById('scanDropzone');
      const previewBox = document.getElementById('scanUploadPreviewBox');
      const fileInput = document.getElementById('scanFileInput');
      const loadingBox = document.getElementById('scanLoadingBox');
      const stepUpload = document.getElementById('scanStepUpload');
      const stepReview = document.getElementById('scanStepReview');
      const footer = document.getElementById('scanModalFooter');

      if (dropzone) dropzone.style.display = 'flex';
      if (previewBox) previewBox.style.display = 'none';
      if (fileInput) fileInput.value = '';
      if (loadingBox) loadingBox.style.display = 'none';
      if (stepUpload) stepUpload.style.display = 'flex';
      if (stepReview) stepReview.style.display = 'none';
      if (footer) footer.style.display = 'none';
    },

    async startScan() {
      if (!this.imageDataUrl) return;

      const previewBox = document.getElementById('scanUploadPreviewBox');
      const loadingBox = document.getElementById('scanLoadingBox');
      const customApiKey = document.getElementById('scanCustomApiKey')?.value?.trim() || '';

      if (previewBox) previewBox.style.display = 'none';
      if (loadingBox) loadingBox.style.display = 'flex';

      try {
        const payload = {
          image: this.imageDataUrl,
          engine: this.currentEngine,
          apiKey: customApiKey || undefined
        };

        const res = await window.api.post('/products/extract-from-image', payload);

        if (!res || !res.success) {
          throw new Error(res?.message || 'Không thể trích xuất dữ liệu từ hình ảnh');
        }

        const items = res.items || [];
        this.extractedItems = items.map((item, index) => ({
          ...item,
          temp_id: index + 1,
          selected: true
        }));

        this.switchToReviewStep(res.engine);
      } catch (error) {
        console.error('Scan error:', error);
        window.adminApp?.toast?.(error.message || 'Lỗi khi quét ảnh menu. Vui lòng thử lại.', true);
        if (loadingBox) loadingBox.style.display = 'none';
        if (previewBox) previewBox.style.display = 'flex';
      }
    },

    switchToReviewStep(engine) {
      const stepUpload = document.getElementById('scanStepUpload');
      const stepReview = document.getElementById('scanStepReview');
      const footer = document.getElementById('scanModalFooter');
      const reviewImg = document.getElementById('scanReviewImage');
      const statusText = document.getElementById('scanEngineStatus');

      if (stepUpload) stepUpload.style.display = 'none';
      if (stepReview) stepReview.style.display = 'grid';
      if (footer) footer.style.display = 'flex';

      if (reviewImg) {
        reviewImg.src = this.imageDataUrl;
        this.setZoom(1);
      }

      if (statusText) {
        if (engine === 'gemini') {
          statusText.innerHTML = `<i class="fa-solid fa-bolt text-warning"></i> Trích xuất bởi <strong>Google Gemini AI Vision</strong> (${this.extractedItems.length} món)`;
        } else {
          statusText.innerHTML = `<i class="fa-solid fa-camera text-primary"></i> Trích xuất bởi <strong>Tesseract OCR</strong> (${this.extractedItems.length} món)`;
        }
      }

      this.renderReviewTable();
    },

    renderReviewTable() {
      const tbody = document.getElementById('scanItemsTableBody');
      if (!tbody) return;

      const existingCategories = window.adminApp?.categories || [];
      const catOptionsHtml = existingCategories
        .map((c) => `<option value="${this.esc(c.name)}">${this.esc(c.name)}</option>`)
        .join('');

      if (!this.extractedItems.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 muted">Không nhận diện được món nào từ ảnh. Nhấn <strong>"+ Thêm dòng"</strong> để nhập tay hoặc tải lại ảnh khác rõ nét hơn.</td></tr>`;
        this.updateCounts();
        return;
      }

      tbody.innerHTML = this.extractedItems
        .map((item, idx) => {
          const isSelected = item.selected !== false;
          return `
          <tr class="${isSelected ? '' : 'unselected'}" data-row-id="${item.temp_id}">
            <td style="text-align:center;width:40px;">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="menuScanner.toggleItem(${item.temp_id}, this.checked)">
            </td>
            <td>
              <input type="text" class="scan-input" value="${this.esc(item.name)}" placeholder="Tên món..." oninput="menuScanner.updateItemField(${item.temp_id}, 'name', this.value)">
            </td>
            <td>
              <input type="text" list="categoryDatalist" class="scan-input" value="${this.esc(item.category || 'Món chung')}" placeholder="Danh mục..." oninput="menuScanner.updateItemField(${item.temp_id}, 'category', this.value)">
            </td>
            <td>
              <input type="number" class="scan-input price" value="${item.price || 0}" step="1000" oninput="menuScanner.updateItemField(${item.temp_id}, 'price', Number(this.value))">
            </td>
            <td>
              <input type="text" class="scan-input" style="width:70px;" value="${this.esc(item.unit || 'Phần')}" placeholder="ĐVT" oninput="menuScanner.updateItemField(${item.temp_id}, 'unit', this.value)">
            </td>
            <td>
              <select class="scan-select" onchange="menuScanner.updateItemField(${item.temp_id}, 'kitchen_type', this.value)">
                <option value="KITCHEN" ${item.kitchen_type === 'KITCHEN' ? 'selected' : ''}>Bếp</option>
                <option value="BAR" ${item.kitchen_type === 'BAR' ? 'selected' : ''}>Pha chế</option>
              </select>
            </td>
            <td style="text-align:center;width:40px;">
              <button type="button" class="scan-del-btn" title="Xóa món này" onclick="menuScanner.removeItem(${item.temp_id})">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
        })
        .join('');

      // Populate datalist for category autocomplete
      let datalist = document.getElementById('categoryDatalist');
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'categoryDatalist';
        document.body.appendChild(datalist);
      }
      datalist.innerHTML = catOptionsHtml;

      this.updateCounts();
    },

    toggleItem(tempId, isChecked) {
      const item = this.extractedItems.find((x) => x.temp_id === tempId);
      if (item) {
        item.selected = isChecked;
        const row = document.querySelector(`tr[data-row-id="${tempId}"]`);
        if (row) {
          if (isChecked) row.classList.remove('unselected');
          else row.classList.add('unselected');
        }
      }
      this.updateCounts();
    },

    updateItemField(tempId, field, value) {
      const item = this.extractedItems.find((x) => x.temp_id === tempId);
      if (item) {
        item[field] = value;
      }
    },

    removeItem(tempId) {
      this.extractedItems = this.extractedItems.filter((x) => x.temp_id !== tempId);
      this.renderReviewTable();
    },

    addNewRow() {
      const nextId = this.extractedItems.length
        ? Math.max(...this.extractedItems.map((x) => x.temp_id || 0)) + 1
        : 1;
      this.extractedItems.push({
        temp_id: nextId,
        name: '',
        category: 'Món chung',
        price: 0,
        unit: 'Phần',
        kitchen_type: 'KITCHEN',
        selected: true
      });
      this.renderReviewTable();

      // Focus the newly added name input
      setTimeout(() => {
        const rows = document.querySelectorAll('#scanItemsTableBody tr');
        const lastRow = rows[rows.length - 1];
        lastRow?.querySelector('input[type="text"]')?.focus();
      }, 50);
    },

    toggleSelectAll(isChecked) {
      this.extractedItems.forEach((item) => {
        item.selected = isChecked;
      });
      this.renderReviewTable();
    },

    filterTable(query) {
      const q = String(query || '').toLowerCase().trim();
      const rows = document.querySelectorAll('#scanItemsTableBody tr');
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        const inputs = Array.from(row.querySelectorAll('input, select')).map((i) => i.value.toLowerCase()).join(' ');
        if (!q || text.includes(q) || inputs.includes(q)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    },

    updateCounts() {
      const total = this.extractedItems.length;
      const selected = this.extractedItems.filter((x) => x.selected !== false).length;

      const countPill = document.getElementById('scanSelectedCount');
      if (countPill) countPill.textContent = `${selected}/${total} đã chọn`;

      const confirmBtn = document.getElementById('btnConfirmBatchSave');
      if (confirmBtn) {
        confirmBtn.disabled = selected === 0;
        confirmBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Xác nhận thêm ${selected} món vào thực đơn`;
      }

      const selectAllCheck = document.getElementById('scanSelectAll');
      if (selectAllCheck) {
        selectAllCheck.checked = total > 0 && selected === total;
        selectAllCheck.indeterminate = selected > 0 && selected < total;
      }
    },

    changeZoom(delta) {
      this.setZoom(Math.max(0.5, Math.min(3, this.zoomLevel + delta)));
    },

    setZoom(val) {
      this.zoomLevel = Math.round(val * 10) / 10;
      const img = document.getElementById('scanReviewImage');
      if (img) {
        img.style.transform = `scale(${this.zoomLevel})`;
      }
      const label = document.getElementById('scanZoomLevel');
      if (label) label.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    },

    async confirmImport() {
      const selected = this.extractedItems.filter((x) => x.selected !== false && x.name?.trim());
      if (!selected.length) {
        window.adminApp?.toast?.('Vui lòng chọn ít nhất 1 món có tên hợp lệ để thêm', true);
        return;
      }

      const confirmBtn = document.getElementById('btnConfirmBatchSave');
      const originalText = confirmBtn.innerHTML;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang thêm ${selected.length} món vào thực đơn...`;

      try {
        const payload = {
          products: selected.map((item) => ({
            name: item.name.trim(),
            category_name: (item.category || 'Món chung').trim(),
            price: Number(item.price) || 0,
            cost_price: 0,
            unit: (item.unit || 'Phần').trim(),
            kitchen_type: item.kitchen_type === 'BAR' ? 'BAR' : 'KITCHEN',
            description: item.description || ''
          }))
        };

        const res = await window.api.post('/products/batch', payload);

        if (!res || !res.success) {
          throw new Error(res?.message || 'Lỗi thêm món ăn vào hệ thống');
        }

        window.adminApp?.toast?.(`Thành công! Đã thêm ${res.count || selected.length} món vào thực đơn.`);
        this.close();

        // Refresh products list in admin view
        if (window.adminApp?.loadProducts) {
          await window.adminApp.loadProducts();
        }
      } catch (err) {
        console.error('Batch import error:', err);
        window.adminApp?.toast?.(err.message || 'Lỗi thêm món ăn vào hệ thống', true);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
      }
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    esc(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.menuScanner = menuScanner;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => menuScanner.init());
  } else {
    menuScanner.init();
  }
})();
