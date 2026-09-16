// ThichGaPOS v1.0 - POS Terminal & Product Catalog Controller

window.posModule = {
  categories: [],
  products: [],
  options: [],
  selectedCategory: 'all',
  searchKeyword: '',
  activeModalProduct: null,
  selectedVariant: null,
  selectedOptions: [],
  modalQty: 1,

  async init() {
    this.bindEvents();
    await this.loadCatalog();
    this.renderCart();

    // Subscribe to state updates
    window.appState.subscribe((event, data) => {
      if (event === 'cart_updated') {
        this.renderCart();
      } else if (event === 'store_changed') {
        this.loadCatalog();
      }
    });
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('searchProductInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value.toLowerCase().trim();
        if (btnClearSearch) btnClearSearch.style.display = this.searchKeyword ? 'block' : 'none';
        this.renderProducts();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchKeyword = '';
        btnClearSearch.style.display = 'none';
        this.renderProducts();
      });
    }

    // Order type tabs
    const typeTabs = document.querySelectorAll('.type-tab-btn');
    typeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.getAttribute('data-type');
        window.appState.setOrderType(type);
      });
    });

    // Mobile cart bottom sheet handle
    const cartHandle = document.getElementById('cartSheetHandle');
    const posCartPanel = document.getElementById('posCartPanel');
    const cartToggleIcon = document.getElementById('cartSheetToggleIcon');
    const cartToggleText = document.getElementById('cartSheetToggleText');

    if (cartHandle && posCartPanel) {
      cartHandle.addEventListener('click', () => {
        const isExpanded = posCartPanel.classList.toggle('expanded');
        if (cartToggleIcon) {
          cartToggleIcon.className = isExpanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        }
        if (cartToggleText) {
          cartToggleText.textContent = isExpanded ? 'Thu gọn' : 'Xem giỏ';
        }
      });
    }

    // Clear cart button
    const btnClearCart = document.getElementById('btnClearCart');
    if (btnClearCart) {
      btnClearCart.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) {
          window.appState.clearCart();
        }
      });
    }

    // Modal Qty buttons
    const btnModalDec = document.getElementById('btnModalDecQty');
    const btnModalInc = document.getElementById('btnModalIncQty');
    if (btnModalDec) {
      btnModalDec.addEventListener('click', () => {
        if (this.modalQty > 1) {
          this.modalQty--;
          this.updateModalPrice();
        }
      });
    }
    if (btnModalInc) {
      btnModalInc.addEventListener('click', () => {
        this.modalQty++;
        this.updateModalPrice();
      });
    }

    // Close modifier modal
    const btnCloseModal = document.getElementById('btnCloseModifierModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => this.closeModifierModal());
    }

    // Confirm add to cart from modal
    const btnConfirmAdd = document.getElementById('btnConfirmAddToCart');
    if (btnConfirmAdd) {
      btnConfirmAdd.addEventListener('click', () => this.confirmAddFromModal());
    }

    // Change table button
    const btnChangeTable = document.getElementById('btnChangeTable');
    if (btnChangeTable) {
      btnChangeTable.addEventListener('click', () => {
        window.appNavigation.switchView('viewTables');
      });
    }

    // Proceed to checkout button
    const btnCheckout = document.getElementById('btnProceedCheckout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', () => {
        if (window.checkoutModule) {
          window.checkoutModule.openCheckoutModal();
        }
      });
    }

    // Send to kitchen button (Dine-in)
    const btnSendKitchen = document.getElementById('btnSendKitchen');
    if (btnSendKitchen) {
      btnSendKitchen.addEventListener('click', () => this.sendOrderToKitchen());
    }
  },

  async loadCatalog() {
    const loading = document.getElementById('productLoading');
    if (loading) loading.style.display = 'block';

    try {
      const [catRes, prodRes] = await Promise.all([
        window.api.get('/categories'),
        window.api.get('/products')
      ]);

      this.categories = catRes.categories || [];
      this.products = prodRes.products || [];
      this.options = prodRes.options || [];

      this.renderCategories();
      this.renderProducts();
    } catch (err) {
      window.api.showToast('Không thể tải menu: ' + err.message, 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  },

  renderCategories() {
    const container = document.getElementById('categoryList');
    if (!container) return;

    let html = `<button class="cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" data-id="all">Tất cả (${this.products.length})</button>`;

    this.categories.forEach(cat => {
      const count = this.products.filter(p => p.category_id === cat.id).length;
      html += `
        <button class="cat-pill ${this.selectedCategory === String(cat.id) ? 'active' : ''}" data-id="${cat.id}">
          ${cat.name} (${count})
        </button>
      `;
    });

    container.innerHTML = html;

    // Add click listeners to pills
    container.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedCategory = pill.getAttribute('data-id');
        this.renderProducts();
      });
    });
  },

  renderProducts() {
    const grid = document.getElementById('productsGrid');
    const empty = document.getElementById('productEmpty');
    if (!grid) return;

    let filtered = this.products;

    // Filter category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === parseInt(this.selectedCategory, 10));
    }

    // Filter search keyword
    if (this.searchKeyword) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(this.searchKeyword) ||
        p.code.toLowerCase().includes(this.searchKeyword)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    grid.innerHTML = filtered.map(prod => `
      <div class="product-card" data-id="${prod.id}">
        <div class="product-card-top">
          <div class="product-emoji">${prod.image_url || '🍗'}</div>
          <span class="product-badge-kitchen">${prod.kitchen_type === 'BAR' ? 'Pha chế' : 'Bếp nấu'}</span>
        </div>
        <h4 class="product-title">${prod.name}</h4>
        <p class="product-desc">${prod.description || prod.code}</p>
        <div class="product-card-bottom">
          <span class="product-price">${window.api.formatMoney(prod.price)}</span>
          <button type="button" class="btn-add-prod" title="Thêm vào giỏ">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
    `).join('');

    // Click on product card opens modifier modal
    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const prodId = parseInt(card.getAttribute('data-id'), 10);
        const prod = this.products.find(p => p.id === prodId);
        if (prod) this.openModifierModal(prod);
      });
    });
  },

  openModifierModal(product) {
    this.activeModalProduct = product;
    this.modalQty = 1;
    this.selectedOptions = [];

    const modal = document.getElementById('productModifierModal');
    const nameEl = document.getElementById('modalProductName');
    const priceEl = document.getElementById('modalProductPrice');
    const noteEl = document.getElementById('modifierItemNote');
    const sizeGroup = document.getElementById('modifierSizeGroup');
    const sizeOptions = document.getElementById('modifierSizeOptions');
    const toppingsList = document.getElementById('modifierToppingsList');

    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = window.api.formatMoney(product.price);
    if (noteEl) noteEl.value = '';

    // Render sizes / variants
    if (product.variants && product.variants.length > 0) {
      if (sizeGroup) sizeGroup.style.display = 'block';
      this.selectedVariant = product.variants.find(v => v.is_default) || product.variants[0];

      sizeOptions.innerHTML = product.variants.map(v => `
        <button type="button" class="size-option-btn ${v.id === this.selectedVariant.id ? 'active' : ''}" data-id="${v.id}">
          <strong>${v.size_name}</strong>
          <span>${v.price_adjustment > 0 ? '+' + window.api.formatMoney(v.price_adjustment) : 'Chuẩn'}</span>
        </button>
      `).join('');

      sizeOptions.querySelectorAll('.size-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          sizeOptions.querySelectorAll('.size-option-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const vId = parseInt(btn.getAttribute('data-id'), 10);
          this.selectedVariant = product.variants.find(v => v.id === vId);
          this.updateModalPrice();
        });
      });
    } else {
      if (sizeGroup) sizeGroup.style.display = 'none';
      this.selectedVariant = null;
    }

    // Render toppings / options
    if (this.options && this.options.length > 0) {
      toppingsList.innerHTML = this.options.map(opt => `
        <label class="topping-checkbox-item">
          <div>
            <input type="checkbox" class="opt-check" data-id="${opt.id}" data-name="${opt.name}" data-price="${opt.price}">
            <span style="margin-left: 6px;">${opt.name}</span>
          </div>
          <strong>+${window.api.formatMoney(opt.price)}</strong>
        </label>
      `).join('');

      toppingsList.querySelectorAll('.opt-check').forEach(chk => {
        chk.addEventListener('change', () => {
          this.selectedOptions = Array.from(toppingsList.querySelectorAll('.opt-check:checked')).map(c => ({
            option_id: parseInt(c.getAttribute('data-id'), 10),
            option_name: c.getAttribute('data-name'),
            price: parseFloat(c.getAttribute('data-price'))
          }));
          this.updateModalPrice();
        });
      });
    } else {
      toppingsList.innerHTML = '<p class="text-muted text-sm">Không có topping cho món này</p>';
    }

    this.updateModalPrice();
    if (modal) modal.style.display = 'flex';
  },

  updateModalPrice() {
    if (!this.activeModalProduct) return;

    let base = parseFloat(this.activeModalProduct.price);
    if (this.selectedVariant && this.selectedVariant.price_adjustment) {
      base += parseFloat(this.selectedVariant.price_adjustment);
    }

    const toppingSum = this.selectedOptions.reduce((s, o) => s + (o.price || 0), 0);
    const singlePrice = base + toppingSum;
    const totalPrice = singlePrice * this.modalQty;

    const qtyDisplay = document.getElementById('modalItemQty');
    const finalPriceEl = document.getElementById('modalFinalPrice');

    if (qtyDisplay) qtyDisplay.textContent = this.modalQty;
    if (finalPriceEl) finalPriceEl.textContent = window.api.formatMoney(totalPrice);
  },

  confirmAddFromModal() {
    if (!this.activeModalProduct) return;

    let unitPrice = parseFloat(this.activeModalProduct.price);
    let variantName = null;
    let variantId = null;

    if (this.selectedVariant) {
      unitPrice += parseFloat(this.selectedVariant.price_adjustment || 0);
      variantName = this.selectedVariant.size_name;
      variantId = this.selectedVariant.id;
    }

    const note = document.getElementById('modifierItemNote')?.value.trim() || '';

    window.appState.addToCart({
      product_id: this.activeModalProduct.id,
      product_name: this.activeModalProduct.name,
      variant_id: variantId,
      variant_name: variantName,
      unit_price: unitPrice,
      quantity: this.modalQty,
      note,
      kitchen_type: this.activeModalProduct.kitchen_type || 'KITCHEN',
      options: [...this.selectedOptions]
    });

    window.api.showToast(`Đã thêm ${this.modalQty}x ${this.activeModalProduct.name}`, 'success');
    this.closeModifierModal();
  },

  closeModifierModal() {
    const modal = document.getElementById('productModifierModal');
    if (modal) modal.style.display = 'none';
    this.activeModalProduct = null;
  },

  renderCart() {
    const itemsList = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    const subtotalEl = document.getElementById('cartSubtotal');
    const discountEl = document.getElementById('cartDiscount');
    const discountRow = document.getElementById('cartDiscountRow');
    const grandTotalEl = document.getElementById('cartGrandTotal');
    const btnCheckoutAmount = document.getElementById('btnCheckoutAmount');
    const btnProceed = document.getElementById('btnProceedCheckout');
    const mobileCount = document.getElementById('mobileCartCount');
    const mobileTotal = document.getElementById('mobileCartTotal');
    const totalCountEl = document.getElementById('cartTotalItemsCount');

    const items = window.appState.cart.items;
    const subtotal = window.appState.getCartSubtotal();
    const discount = window.appState.getCartDiscount();
    const grandTotal = window.appState.getCartGrandTotal();
    const itemCount = window.appState.getCartItemCount();

    if (items.length === 0) {
      if (itemsList) itemsList.innerHTML = '';
      if (emptyState) {
        itemsList.appendChild(emptyState);
        emptyState.style.display = 'flex';
      }
      if (btnProceed) btnProceed.disabled = true;
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (btnProceed) btnProceed.disabled = false;

      itemsList.innerHTML = items.map((item, idx) => `
        <div class="cart-item-row" data-index="${idx}">
          <div class="cart-item-info">
            <h4 class="cart-item-name">${item.product_name}</h4>
            <div class="cart-item-tags">
              ${item.variant_name ? `<span class="cart-item-tag">${item.variant_name}</span>` : ''}
              ${(item.options || []).map(o => `<span class="cart-item-tag">+${o.option_name}</span>`).join('')}
            </div>
            ${item.note ? `<p class="cart-item-note"><i class="fa-regular fa-note-sticky"></i> ${item.note}</p>` : ''}
          </div>
          <div class="cart-item-right">
            <span class="cart-item-price">${window.api.formatMoney(item.subtotal)}</span>
            <div class="cart-qty-control">
              <button type="button" class="cart-btn-qty btn-cart-dec" data-index="${idx}">
                <i class="fa-solid fa-minus"></i>
              </button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button type="button" class="cart-btn-qty btn-cart-inc" data-index="${idx}">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('');

      // Add listeners for quantity buttons
      itemsList.querySelectorAll('.btn-cart-dec').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          window.appState.updateCartItemQty(idx, -1);
        });
      });

      itemsList.querySelectorAll('.btn-cart-inc').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          window.appState.updateCartItemQty(idx, 1);
        });
      });
    }

    // Price updates
    if (subtotalEl) subtotalEl.textContent = window.api.formatMoney(subtotal);
    if (discountEl) discountEl.textContent = '-' + window.api.formatMoney(discount);
    if (discountRow) discountRow.style.display = discount > 0 ? 'flex' : 'none';
    if (grandTotalEl) grandTotalEl.textContent = window.api.formatMoney(grandTotal);
    if (btnCheckoutAmount) btnCheckoutAmount.textContent = window.api.formatMoney(grandTotal);

    // Mobile sheet updates
    if (mobileCount) mobileCount.textContent = itemCount;
    if (mobileTotal) mobileTotal.textContent = window.api.formatMoney(grandTotal);
    if (totalCountEl) totalCountEl.textContent = itemCount;
  },

  // Send dine-in order to kitchen (KDS)
  async sendOrderToKitchen() {
    if (window.appState.cart.items.length === 0) {
      window.api.showToast('Vui lòng chọn món trước khi gửi bếp', 'error');
      return;
    }

    if (window.appState.cart.orderType === 'DINE_IN' && !window.appState.cart.selectedTable) {
      window.api.showToast('Vui lòng chọn bàn trước khi gửi bếp', 'error');
      window.appNavigation.switchView('viewTables');
      return;
    }

    try {
      const payload = {
        order_type: window.appState.cart.orderType,
        table_id: window.appState.cart.selectedTable ? window.appState.cart.selectedTable.id : null,
        note: window.appState.cart.note,
        discount_amount: window.appState.getCartDiscount(),
        items: window.appState.cart.items
      };

      const res = await window.api.post('/orders', payload);
      window.api.showToast('Đã gửi món vào bếp (KDS) thành công!', 'success');
      window.appState.clearCart();

      // Refresh table view
      if (window.tablesModule) window.tablesModule.loadTables();
    } catch (err) {
      window.api.showToast('Lỗi gửi bếp: ' + err.message, 'error');
    }
  }
};
