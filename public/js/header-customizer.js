/**
 * ThichGaPOS - Header Customizer Module
 * Quản lý tùy chỉnh câu chúc, ảnh đại diện và phông nền Header tích hợp trong modal "Thông tin tài khoản"
 */

window.headerCustomizer = {
  defaultSettings: {
    wishesText: 'Chúc bạn làm việc hiệu quả!',
    avatarType: 'preset',
    avatarSrc: 'images/staff-avatar.jpg',
    bgTheme: 'theme-moon-lantern',
    showDecor: true
  },

  themes: [
    {
      id: 'theme-moon-lantern',
      name: 'Đêm hội Trăng rằm',
      desc: 'Xanh lục sẫm, vầng trăng vàng rực rỡ & đèn lồng bay lung linh',
      preview: 'linear-gradient(135deg, #022c22, #065f46, #047857)',
      decorType: 'moon-lantern'
    },
    {
      id: 'theme-sunrise-amber',
      name: 'Bình minh Rạng rỡ',
      desc: 'Cam hổ phách ấm áp, tràn đầy năng lượng khởi đầu ngày mới',
      preview: 'linear-gradient(135deg, #7c2d12, #ea580c, #f59e0b)',
      decorType: 'sunrise'
    },
    {
      id: 'theme-ocean-blue',
      name: 'Đại dương Huyền ảo',
      desc: 'Xanh biển đêm hoàng gia sang trọng và ánh sao huyền bí',
      preview: 'linear-gradient(135deg, #0f172a, #1e3a8a, #0284c7)',
      decorType: 'ocean'
    },
    {
      id: 'theme-twilight-purple',
      name: 'Hoàng hôn Tím biếc',
      desc: 'Tím hồng lavender lãng mạn, thanh lịch và ấm áp',
      preview: 'linear-gradient(135deg, #3b0764, #6b21a8, #c026d3)',
      decorType: 'twilight'
    },
    {
      id: 'theme-slate-modern',
      name: 'Tối giản Cao cấp',
      desc: 'Xám đen Slate hiện đại, phong cách F&B tối giản tinh tế',
      preview: 'linear-gradient(135deg, #090d16, #1e293b, #334155)',
      decorType: 'slate'
    }
  ],

  avatarPresets: [
    { id: 'male', src: 'images/staff-avatar.jpg', name: 'Nhân viên nam (Áo xanh)' },
    { id: 'female', src: 'images/staff-female.jpg', name: 'Nhân viên nữ (Áo xanh)' },
    { id: 'logo', src: '', name: 'Logo Thích Gà (🍗)', isLogo: true }
  ],

  wishesSuggestions: [
    'Chúc bạn làm việc hiệu quả!',
    'Chúc một ngày buôn may bán đắt!',
    'Năng lượng tích cực mỗi ngày!',
    'Cố lên hôm nay đông khách nhé!',
    'Phục vụ tận tâm, khách hàng yêu quý!',
    'Ngày mới ngập tràn niềm vui!'
  ],

  currentSettings: null,
  selectedAvatar: null,
  selectedTheme: null,

  init() {
    this.currentSettings = { ...this.defaultSettings };
    this.applySettings(this.currentSettings);
    this.bindEvents();
  },

  // Áp dụng các thiết lập vào DOM Header và Modal
  applySettings(settings) {
    if (!settings) return;

    // 1. Cập nhật câu lời chúc trên Header
    const wishesEl = document.getElementById('headerWishesText');
    if (wishesEl) {
      wishesEl.textContent = settings.wishesText || this.defaultSettings.wishesText;
    }

    // 2. Cập nhật ảnh đại diện trên Header
    const avatarImg = document.getElementById('headerAvatarImg');
    const avatarFallback = document.getElementById('userAvatar');
    if (avatarImg && avatarFallback) {
      if (settings.avatarType === 'logo') {
        avatarImg.style.display = 'none';
        avatarFallback.style.display = 'flex';
        avatarFallback.textContent = '🍗';
        avatarFallback.style.fontSize = '22px';
      } else if (settings.avatarSrc) {
        avatarImg.src = settings.avatarSrc;
        avatarImg.style.display = 'block';
        avatarFallback.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarFallback.style.display = 'flex';
      }
    }

    // Đồng bộ ảnh đại diện trong modal Thông tin tài khoản
    const profileAvatarImg = document.getElementById('accProfileAvatarImg');
    const profileAvatarFallback = document.getElementById('accProfileAvatarFallback');
    if (profileAvatarImg && profileAvatarFallback) {
      if (settings.avatarType === 'logo') {
        profileAvatarImg.style.display = 'none';
        profileAvatarFallback.style.display = 'flex';
        profileAvatarFallback.textContent = '🍗';
      } else if (settings.avatarSrc) {
        profileAvatarImg.src = settings.avatarSrc;
        profileAvatarImg.style.display = 'block';
        profileAvatarFallback.style.display = 'none';
      } else {
        profileAvatarImg.style.display = 'none';
        profileAvatarFallback.style.display = 'flex';
      }
    }

    // 3. Cập nhật Theme background trên Header
    const headerEl = document.querySelector('.top-header');
    if (headerEl) {
      this.themes.forEach(t => headerEl.classList.remove(t.id));
      headerEl.classList.add(settings.bgTheme || 'theme-moon-lantern');
    }

    // 4. Cập nhật họa tiết trang trí (Decor)
    const decorEl = document.querySelector('.header-banner-decor');
    if (decorEl) {
      decorEl.style.display = settings.showDecor !== false ? 'block' : 'none';
      const activeThemeObj = this.themes.find(t => t.id === settings.bgTheme) || this.themes[0];
      decorEl.setAttribute('data-decor', activeThemeObj.decorType || 'moon-lantern');
    }
  },

  // Chuyển tab bên trong modal Thông tin tài khoản
  switchAccountTab(tabName) {
    const isGeneral = tabName === 'general';
    
    const tabBtnGeneral = document.getElementById('tabBtnAccountGeneral');
    const tabBtnHeader = document.getElementById('tabBtnAccountHeader');
    const tabPaneGeneral = document.getElementById('tabPaneAccountGeneral');
    const tabPaneHeader = document.getElementById('tabPaneAccountHeader');

    if (tabBtnGeneral) tabBtnGeneral.classList.toggle('active', isGeneral);
    if (tabBtnHeader) tabBtnHeader.classList.toggle('active', !isGeneral);
    if (tabPaneGeneral) tabPaneGeneral.classList.toggle('active', isGeneral);
    if (tabPaneHeader) tabPaneHeader.classList.toggle('active', !isGeneral);

    if (!isGeneral) {
      // Khi chuyển sang tab Header, đồng bộ các input cấu hình
      this.populateInputs();
    }
  },

  // Điền dữ liệu cấu hình vào form trong Tab 2
  populateInputs() {
    const s = this.currentSettings || this.loadSettings();
    this.selectedAvatar = {
      type: s.avatarType || this.defaultSettings.avatarType,
      src: s.avatarSrc || this.defaultSettings.avatarSrc
    };
    this.selectedTheme = s.bgTheme || this.defaultSettings.bgTheme;

    // 1. Điền câu chúc
    const wishesInput = document.getElementById('inputCustomWishes');
    if (wishesInput) wishesInput.value = s.wishesText || this.defaultSettings.wishesText;

    // 2. Render gợi ý câu chúc
    const suggContainer = document.getElementById('wishesSuggestionsContainer');
    if (suggContainer) {
      suggContainer.innerHTML = this.wishesSuggestions.map(w => `
        <button type="button" class="btn-suggestion-pill ${w === wishesInput?.value ? 'active' : ''}" onclick="headerCustomizer.selectSuggestion('${w}')">
          ${w}
        </button>
      `).join('');
    }

    // 3. Render presets avatar
    const avatarGrid = document.getElementById('avatarPresetsGrid');
    if (avatarGrid) {
      avatarGrid.innerHTML = this.avatarPresets.map(av => {
        const isSelected = (av.isLogo && s.avatarType === 'logo') || (!av.isLogo && s.avatarSrc === av.src && s.avatarType !== 'logo');
        return `
          <div class="avatar-preset-card ${isSelected ? 'selected' : ''}" onclick="headerCustomizer.selectAvatarPreset('${av.id}')">
            ${av.isLogo 
              ? '<div class="avatar-preset-icon">🍗</div>' 
              : `<img src="${av.src}" alt="${av.name}" class="avatar-preset-img">`
            }
            <span class="avatar-preset-name">${av.name}</span>
          </div>
        `;
      }).join('');
    }

    // Preview Avatar
    this.updateModalAvatarPreview(s.avatarSrc, s.avatarType === 'logo');

    // 4. Render danh sách Theme phông nền
    const themesGrid = document.getElementById('themesPresetsGrid');
    if (themesGrid) {
      themesGrid.innerHTML = this.themes.map(t => {
        const isSelected = t.id === (s.bgTheme || 'theme-moon-lantern');
        return `
          <div class="theme-preset-card ${isSelected ? 'selected' : ''}" onclick="headerCustomizer.selectTheme('${t.id}')">
            <div class="theme-color-bar" style="background:${t.preview}">
              ${t.id === 'theme-moon-lantern' ? '<span class="theme-icon-hint">🌕 🏮</span>' : ''}
              ${t.id === 'theme-sunrise-amber' ? '<span class="theme-icon-hint">☀️ 🌅</span>' : ''}
              ${t.id === 'theme-ocean-blue' ? '<span class="theme-icon-hint">🌊 ⭐</span>' : ''}
              ${t.id === 'theme-twilight-purple' ? '<span class="theme-icon-hint">🌆 ✨</span>' : ''}
              ${t.id === 'theme-slate-modern' ? '<span class="theme-icon-hint">💎 🌙</span>' : ''}
            </div>
            <div class="theme-details">
              <strong>${t.name}</strong>
              <small class="text-muted">${t.desc}</small>
            </div>
            ${isSelected ? '<i class="fa-solid fa-circle-check theme-check-icon"></i>' : ''}
          </div>
        `;
      }).join('');
    }

    // 5. Switch họa tiết
    const chkDecor = document.getElementById('chkShowDecor');
    if (chkDecor) chkDecor.checked = s.showDecor !== false;

    // Reset input upload
    const fileInput = document.getElementById('inputUploadAvatar');
    if (fileInput) fileInput.value = '';
  },

  // Chuẩn bị dữ liệu khi mở modal Thông tin tài khoản
  openInAccountModal(initialTab = 'general') {
    this.populateInputs();
    this.switchAccountTab(initialTab);
  },

  selectSuggestion(text) {
    const wishesInput = document.getElementById('inputCustomWishes');
    if (wishesInput) {
      wishesInput.value = text;
      document.querySelectorAll('.btn-suggestion-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === text);
      });
    }
  },

  selectAvatarPreset(presetId) {
    const preset = this.avatarPresets.find(p => p.id === presetId);
    if (!preset) return;

    this.selectedAvatar = {
      type: preset.isLogo ? 'logo' : 'preset',
      src: preset.src || ''
    };

    document.querySelectorAll('.avatar-preset-card').forEach((card, idx) => {
      card.classList.toggle('selected', this.avatarPresets[idx].id === presetId);
    });

    this.updateModalAvatarPreview(preset.src, preset.isLogo);
  },

  updateModalAvatarPreview(src, isLogo) {
    const previewContainer = document.getElementById('modalAvatarPreview');
    if (!previewContainer) return;

    if (isLogo) {
      previewContainer.innerHTML = '<div style="font-size:32px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#fef3c7;border-radius:50%">🍗</div>';
    } else if (src) {
      previewContainer.innerHTML = `<img src="${src}" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      previewContainer.innerHTML = '<div class="fallback-avatar">TN</div>';
    }
  },

  handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.api?.showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)', 'warning');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      window.api?.showToast('Kích thước ảnh không vượt quá 3MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 256 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const base64Src = canvas.toDataURL('image/jpeg', 0.75);
      this.selectedAvatar = {
        type: 'upload',
        src: base64Src
      };

      document.querySelectorAll('.avatar-preset-card').forEach(c => c.classList.remove('selected'));
      this.updateModalAvatarPreview(base64Src, false);
      window.api?.showToast('Đã tải ảnh lên. Hãy bấm "Lưu thay đổi"', 'info');
      };
      image.onerror = () => window.api.showToast("Không đọc được ảnh", "error");
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  selectTheme(themeId) {
    this.selectedTheme = themeId;
    document.querySelectorAll('.theme-preset-card').forEach((card, idx) => {
      const isSelected = this.themes[idx].id === themeId;
      card.classList.toggle('selected', isSelected);
      const check = card.querySelector('.theme-check-icon');
      if (isSelected && !check) {
        card.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-circle-check theme-check-icon"></i>');
      } else if (!isSelected && check) {
        check.remove();
      }
    });
  },

  async save() {
    const wishesInput = document.getElementById('inputCustomWishes');
    const wishesText = wishesInput?.value?.trim() || this.defaultSettings.wishesText;
    const showDecor = document.getElementById('chkShowDecor')?.checked ?? true;

    const newSettings = {
      wishesText: wishesText,
      avatarType: this.selectedAvatar?.type || this.currentSettings?.avatarType || this.defaultSettings.avatarType,
      avatarSrc: this.selectedAvatar?.src !== undefined ? this.selectedAvatar.src : (this.currentSettings?.avatarSrc || this.defaultSettings.avatarSrc),
      bgTheme: this.selectedTheme || this.currentSettings?.bgTheme || this.defaultSettings.bgTheme,
      showDecor: showDecor
    };

    try { await window.api.put('/auth/preferences/header', newSettings); }
    catch (error) { window.api.showToast(error.message, 'error'); return; }
    this.currentSettings = newSettings;
    this.applySettings(newSettings);

    const modal = document.getElementById('accountInfoModal');
    if (modal) modal.style.display = 'none';

    window.api?.showToast('Đã lưu thông tin và giao diện Header thành công!', 'success');
  },

  async resetDefaults() {
    if (confirm('Khôi phục Header về giao diện mặc định ban đầu?')) {
      try { await window.api.put('/auth/preferences/header', this.defaultSettings); }
      catch (error) { window.api.showToast(error.message, 'error'); return; }
      this.currentSettings = { ...this.defaultSettings };
      this.applySettings(this.currentSettings);
      this.populateInputs();
      window.api?.showToast('Đã khôi phục Header về mặc định', 'info');
    }
  },

  bindEvents() {
    // 1. Click vào cụm Profile / Avatar trên Header để mở Thông tin tài khoản
    const profileTrigger = document.getElementById('headerProfileTrigger');
    if (profileTrigger) {
      profileTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.moreMenuModule) {
          window.moreMenuModule.openAccountModal();
        } else {
          const modal = document.getElementById('accountInfoModal');
          if (modal) modal.style.display = 'flex';
          this.openInAccountModal('general');
        }
      });
    }

    // 2. Upload avatar input
    const fileInput = document.getElementById('inputUploadAvatar');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }
  }
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.headerCustomizer.init();
});
