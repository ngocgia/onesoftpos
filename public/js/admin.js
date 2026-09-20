// Store administration for STORE_MANAGER. Every request is scoped by X-Store-Id.
window.adminModule = {
  stores: [], products: [], categories: [], toppings: [], toppingGroups: [], staff: [], editorSubmit: null,
  inventoryItems: [], inventorySummary: null, inventoryTransactions: [], inventoryReports: null,
  inventoryCategories: ['Thịt & Hải sản', 'Gia vị & Bột', 'Dầu ăn & Bơ', 'Nông sản & Lương thực', 'Trà & Cà phê', 'Sữa & Kem', 'Topping & Hạt', 'Bao bì & Ly hộp', 'Khác'],
  staffRoles: ['ORDER_STAFF', 'CASHIER', 'KITCHEN'],
  featureLabels: { POS:'Bán hàng POS',TABLES:'Phòng bàn',KDS:'Bếp KDS',ORDERS:'Đơn hàng',HISTORY:'Lịch sử',PAYMENT:'Thanh toán',ADMIN:'Màn quản trị',SHIFT:'Quản lý ca',DISCOUNT:'Giảm giá',COMPLETED_ITEMS:'Món đã xong',INVENTORY:'Quản lý kho' },

  esc(value='') { const node=document.createElement('div');node.textContent=String(value??'');return node.innerHTML; },
  field(name,label,type='text',value='',options=null,required=false) {
    if(type==='textarea')return `<div class="form-group"><label>${label}</label><textarea class="form-input" name="${name}" ${required?'required':''}>${this.esc(value)}</textarea></div>`;
    if(type==='select')return `<div class="form-group"><label>${label}</label><select class="form-input" name="${name}" ${required?'required':''}>${options.map(option=>`<option value="${this.esc(option.value)}" ${String(option.value)===String(value)?'selected':''}>${this.esc(option.label)}</option>`).join('')}</select></div>`;
    return `<div class="form-group"><label>${label}</label><input class="form-input" name="${name}" type="${type}" value="${this.esc(value)}" ${required?'required':''}></div>`;
  },
  formData(form){return Object.fromEntries(new FormData(form).entries())},
  openEditor(title,html,onSubmit,{hideSave=false}={}){document.getElementById('adminEditorTitle').textContent=title;document.getElementById('adminEditorBody').innerHTML=html;document.querySelector('#adminEditorModal button[type="submit"]').style.display=hideSave?'none':'';this.editorSubmit=onSubmit;document.getElementById('adminEditorModal').style.display='flex'},
  closeEditor(){document.getElementById('adminEditorModal').style.display='none';this.editorSubmit=null},
  toppingPicker(selectedIds){const selected=new Set(selectedIds.map(Number)),groups=[...this.toppingGroups,{id:'none',name:'Chưa phân nhóm'}];const sections=groups.map(group=>{const items=this.toppings.filter(item=>String(item.group_id||'none')===String(group.id));if(!items.length)return'';return `<section class="topping-picker-group" data-group="${group.id}" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px"><label style="display:flex;justify-content:space-between;gap:8px;font-weight:700"><span>${this.esc(group.name)} <small class="text-muted">(${items.length})</small></span><span><input type="checkbox" data-select-group="${group.id}" onchange="adminModule.toggleToppingGroup('${group.id}',this.checked)"> Chọn cả nhóm</span></label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:8px">${items.map(item=>`<label class="topping-picker-item" data-search="${this.esc(`${item.name} ${group.name}`.toLowerCase())}" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="product_topping" data-group-id="${group.id}" value="${item.id}" ${selected.has(item.id)?'checked':''} onchange="adminModule.refreshToppingPickerCount()"><span>${this.esc(item.name)}<br><small class="text-muted">${window.api.formatMoney(item.price)}${item.is_active?'':' · đã ẩn'}</small></span></label>`).join('')}</div></section>`}).join('');return `<div class="form-group"><label>Topping áp dụng cho món này</label><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input id="productToppingSearch" class="form-input" placeholder="Tìm topping hoặc nhóm..." oninput="adminModule.filterProductToppings(this.value)" style="flex:1"><strong id="productToppingCount">0 đã chọn</strong></div><div id="productToppingPicker" style="display:grid;gap:10px;max-height:360px;overflow:auto">${sections||'<p class="text-muted">Chưa có topping. Hãy tạo topping trước.</p>'}</div></div>`},
  refreshToppingPickerCount(){const root=document.getElementById('productToppingPicker');if(!root)return;const checked=root.querySelectorAll('[name="product_topping"]:checked').length;const count=document.getElementById('productToppingCount');if(count)count.textContent=`${checked} đã chọn`;root.querySelectorAll('[data-select-group]').forEach(control=>{const items=[...root.querySelectorAll(`[name="product_topping"][data-group-id="${control.dataset.selectGroup}"]`)];control.checked=items.length>0&&items.every(item=>item.checked);control.indeterminate=items.some(item=>item.checked)&&!control.checked})},
  toggleToppingGroup(groupId,checked){document.querySelectorAll(`#productToppingPicker [name="product_topping"][data-group-id="${groupId}"]`).forEach(input=>{input.checked=checked});this.refreshToppingPickerCount()},
  filterProductToppings(value){const query=String(value||'').trim().toLowerCase();document.querySelectorAll('#productToppingPicker .topping-picker-group').forEach(group=>{let visible=0;group.querySelectorAll('.topping-picker-item').forEach(item=>{const show=!query||item.dataset.search.includes(query);item.style.display=show?'flex':'none';if(show)visible++});group.style.display=visible?'block':'none'})},

  init() {
    this.bindEvents();
    this.refresh();
    window.appState.subscribe(event=>{if(event==='store_changed')this.refresh()});
  },
  refresh() {
    const isStoreManager=window.appState.user?.role==='STORE_MANAGER';
    const addStore=document.getElementById('btnOpenAddStoreModal');if(addStore)addStore.style.display=isStoreManager?'none':'';
    this.loadReports();this.loadAdminStores();this.loadAdminProducts();
    if(window.appState.user?.role==='STORE_MANAGER'){this.loadStoreRoleFeatures();this.loadStaff()}
    window.appState.applyAdminTabsConfig();
  },
  bindEvents() {
    document.querySelectorAll('.admin-nav-tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.admin-nav-tab').forEach(item=>item.classList.remove('active'));tab.classList.add('active');const target=tab.dataset.target;document.querySelectorAll('.admin-subview').forEach(view=>view.classList.toggle('active',view.id===target));if(target==='adminReports')this.loadReports();if(target==='adminStores')this.loadAdminStores();if(target==='adminStoreTypes')this.loadStoreRoleFeatures();if(target==='adminProducts')this.loadAdminProducts();if(target==='adminTables')window.tablesModule?.loadAreasAndTables();if(target==='adminStaff')this.loadStaff();if(target==='adminInventory')this.loadInventory()}));
    document.getElementById('btnOpenAddProductModal')?.addEventListener('click',()=>this.editProduct());document.getElementById('btnManageCategories')?.addEventListener('click',()=>this.manageCategories());document.getElementById('btnManageToppings')?.addEventListener('click',()=>this.manageToppings());document.getElementById('btnManageSizes')?.addEventListener('click',()=>this.manageSizes());document.getElementById('btnAddStaff')?.addEventListener('click',()=>this.editStaff());document.getElementById('btnConfigureWorkflow')?.addEventListener('click',()=>this.configureWorkflow());document.getElementById('btnCloseAdminEditor')?.addEventListener('click',()=>this.closeEditor());document.getElementById('btnCancelAdminEditor')?.addEventListener('click',()=>this.closeEditor());
    document.getElementById('btnFilterPosReports')?.addEventListener('click',()=>this.loadReports());
    document.getElementById('btnOpenAddInventoryItemModal')?.addEventListener('click',()=>this.openEditInventoryItem());
    document.getElementById('btnOpenImportInventoryModal')?.addEventListener('click',()=>this.openInventoryTransactionModal('IN'));
    document.getElementById('btnOpenExportInventoryModal')?.addEventListener('click',()=>this.openInventoryTransactionModal('OUT'));
    document.getElementById('btnOpenAdjustInventoryModal')?.addEventListener('click',()=>this.openInventoryTransactionModal('ADJUST'));
    document.getElementById('btnInvRefreshSummary')?.addEventListener('click',()=>this.loadInventorySummary());
    document.getElementById('btnFilterInvReports')?.addEventListener('click',()=>this.loadInventoryReports());
    document.getElementById('btnRefreshInvTrans')?.addEventListener('click',()=>this.loadInventoryTransactions());
    document.getElementById('invSummarySearch')?.addEventListener('input',()=>this.filterInventorySummary());
    document.getElementById('invSummaryCategoryFilter')?.addEventListener('change',()=>this.filterInventorySummary());
    document.getElementById('invItemsSearch')?.addEventListener('input',()=>this.filterInventoryItems());
    document.getElementById('invTransTypeFilter')?.addEventListener('change',()=>this.loadInventoryTransactions());
    document.querySelectorAll('.inv-nav-pill').forEach(btn=>btn.addEventListener('click',()=>this.switchInventoryPill(btn.dataset.pill)));
    document.getElementById('adminEditorForm')?.addEventListener('submit',async event=>{event.preventDefault();try{await this.editorSubmit?.(this.formData(event.target),event.target);this.closeEditor()}catch(error){window.api.showToast(error.message,'error')}});
  },

  async loadReports() { try { 
    const startDate = document.getElementById('posReportStartDate')?.value;
    const endDate = document.getElementById('posReportEndDate')?.value;
    let url = '/reports/summary?range=today';
    let label = 'Doanh thu hôm nay';
    if (startDate && endDate) {
      url = `/reports/summary?startDate=${startDate}&endDate=${endDate}`;
      const formatDt = (d) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
      label = `Doanh thu (${formatDt(startDate)} - ${formatDt(endDate)})`;
    }
    const revLabelNode = document.querySelector('#adminReports .card-revenue .card-label');
    if (revLabelNode) revLabelNode.textContent = label;

    const data=await window.api.get(url);
    document.getElementById('repRevenue').textContent=window.api.formatMoney(data.revenue);
    document.getElementById('repOrderCount').textContent=`${data.orderCount} đơn`;
    document.getElementById('repAvgOrder').textContent=window.api.formatMoney(data.avgOrderValue);
    document.getElementById('topProductsList').innerHTML=(data.topProducts||[]).map(item=>`<div class="top-prod-row"><span><strong>${this.esc(item.product_name)}</strong> (${item.total_qty} phần)</span><strong class="text-primary">${window.api.formatMoney(item.total_revenue)}</strong></div>`).join('')||'<p class="text-muted">Chưa có dữ liệu</p>';
    const pay=data.paymentBreakdown||{};
    document.getElementById('paymentBreakdownList').innerHTML=['CASH','QR','BANK_TRANSFER','CARD'].map(code=>`<div class="pay-row"><span>${code}</span><strong>${window.api.formatMoney(pay[code]||0)}</strong></div>`).join('')
  } catch(error){console.error('loadReports error:',error)} },

  async loadAdminStores(){try{const result=await window.api.get('/stores');this.stores=result.stores||[];document.getElementById('adminStoresGrid').innerHTML=this.stores.map(store=>`<div class="store-type-card"><div style="display:flex;justify-content:space-between"><div><h4>${this.esc(store.name)}</h4><p class="text-muted">${this.esc(store.address||'Chưa cập nhật địa chỉ')}</p><p class="text-muted">${this.esc(store.phone||'')}</p></div><button class="btn-secondary btn-sm" onclick="adminModule.editStore(${store.id})">Sửa thông tin</button></div></div>`).join('')}catch(error){console.error('loadAdminStores error:',error)}},
  async editStore(id){const detail=await window.api.get(`/stores/${id}`),store=detail.store,settings=detail.settings||{};const takeawayWorkspace=typeof settings.takeaway_workspace_enabled==='boolean'?settings.takeaway_workspace_enabled:detail.features?.enableTakeawayWorkspace;let adminTabs=settings.admin_tabs;if(typeof adminTabs==='string'){try{adminTabs=JSON.parse(adminTabs)}catch(_){adminTabs={}}}adminTabs=adminTabs||{};const html=this.field('name','Tên cửa hàng','text',store.name||'',null,true)+this.field('display_name','Tên hiển thị','text',store.display_name||'')+this.field('phone','Số điện thoại','text',store.phone||'')+this.field('email','Email','email',store.email||'')+this.field('address','Địa chỉ','textarea',store.address||'')+this.field('takeaway_workspace_enabled','Giao diện chuyên bán mang đi','select',String(!!takeawayWorkspace),[{value:'true',label:'Bật'},{value:'false',label:'Tắt'}],true)+`<p class="text-muted">Khi bật, màn bán hàng hỗ trợ nhiều đơn nháp và thông tin giao/nhận cho khách mang đi.</p>`+this.field('inventory_transactions_enabled','Nghiệp vụ Phiếu kho (Dành cho Cửa hàng nhỏ)','select',String(settings.inventory_transactions_enabled !== false),[{value:'true',label:'Bật - Đầy đủ nghiệp vụ phiếu kho (Nhập, Xuất, Kiểm kê)'},{value:'false',label:'Tắt (Dành cho Cửa hàng nhỏ) - Chỉ CRUD mặt hàng & Thống kê nhập hàng tháng'}],true)+`<p class="text-muted">Cửa hàng nhỏ không có thủ kho có thể tắt để quản lý hàng hóa và xem tổng lượng, tổng giá trị nhập trong tháng đơn giản nhất.</p>`+this.field('receipt_header','Tiêu đề hóa đơn','text',settings.receipt_header||'')+this.field('receipt_footer','Chân hóa đơn','textarea',settings.receipt_footer||'')+this.field('bank_name','Ngân hàng','text',settings.bank_name||'')+this.field('bank_account_number','Số tài khoản','text',settings.bank_account_number||'')+this.field('bank_account_holder','Chủ tài khoản','text',settings.bank_account_holder||'')+`<div class="field full"><label>Cấu hình tab màn Quản trị POS</label><div class="checks"><label><input type="checkbox" name="admin_tab_reports" ${adminTabs.reports !== false ? "checked" : ""}> Báo cáo</label><label><input type="checkbox" name="admin_tab_stores" ${adminTabs.stores !== false ? "checked" : ""}> Cửa hàng</label><label><input type="checkbox" name="admin_tab_storeTypes" ${adminTabs.storeTypes !== false ? "checked" : ""}> Luồng & phân quyền</label><label><input type="checkbox" name="admin_tab_products" ${adminTabs.products !== false ? "checked" : ""}> Sản phẩm</label><label><input type="checkbox" name="admin_tab_tables" ${adminTabs.tables !== false ? "checked" : ""}> Phòng bàn</label><label><input type="checkbox" name="admin_tab_staff" ${adminTabs.staff !== false ? "checked" : ""}> Nhân viên</label><label><input type="checkbox" name="admin_tab_inventory" ${adminTabs.inventory !== false ? "checked" : ""}> Quản lý kho</label></div><p class="muted">Bật/tắt hiển thị các tab trong phần Quản trị của giao diện POS đối với cửa hàng này.</p></div>`;this.openEditor('Thông tin cửa hàng',html,async data=>{data.takeaway_workspace_enabled=data.takeaway_workspace_enabled==='true';data.inventory_transactions_enabled=data.inventory_transactions_enabled==='true';data.admin_tabs = { reports: data.admin_tab_reports === true || data.admin_tab_reports === 'on', stores: data.admin_tab_stores === true || data.admin_tab_stores === 'on', storeTypes: data.admin_tab_storeTypes === true || data.admin_tab_storeTypes === 'on', products: data.admin_tab_products === true || data.admin_tab_products === 'on', tables: data.admin_tab_tables === true || data.admin_tab_tables === 'on', staff: data.admin_tab_staff === true || data.admin_tab_staff === 'on', inventory: data.admin_tab_inventory === true || data.admin_tab_inventory === 'on' };delete data.admin_tab_reports;delete data.admin_tab_stores;delete data.admin_tab_storeTypes;delete data.admin_tab_products;delete data.admin_tab_tables;delete data.admin_tab_staff;delete data.admin_tab_inventory;await window.api.put(`/stores/${id}`,data);await window.api.put(`/stores/${id}/settings`,data);await window.appNavigation.reloadCurrentStoreFeatures();window.api.showToast('Đã cập nhật cửa hàng','success');await this.loadAdminStores()})},

  async loadAdminProducts(){try{const [products,categories,toppings,groups,sizes]=await Promise.all([window.api.get('/products?include_inactive=true'),window.api.get('/categories'),window.api.get('/toppings'),window.api.get('/topping-groups'),window.api.get('/sizes')]);this.products=products.products||[];this.categories=categories.categories||[];this.toppings=toppings.toppings||[];this.toppingGroups=groups.groups||[];this.sizes=sizes.sizes||[];document.getElementById('adminProductsTableBody').innerHTML=this.products.map(product=>`<tr><td><strong>${this.esc(product.code)}</strong></td><td>${this.esc(product.image_url||'🍗')} ${this.esc(product.name)}<br><small class="text-muted">${product.options?.length||0} topping</small></td><td>${this.esc(product.category_name||'-')}</td><td>${window.api.formatMoney(product.price)}</td><td>${product.kitchen_type==='BAR'?'Pha chế':'Bếp'}</td><td>${product.is_active?'Đang bán':'Ngừng bán'}</td><td><button class="btn-secondary btn-sm" onclick="adminModule.editProduct(${product.id})">Sửa</button> <button class="btn-secondary btn-sm" onclick="adminModule.removeProduct(${product.id})">${product.is_active?'Xóa':'Khôi phục'}</button></td></tr>`).join('')||'<tr><td colspan="7">Chưa có sản phẩm</td></tr>'}catch(error){console.error('loadAdminProducts error:',error)}},
  variantPicker(productVariants = []) {
    const activeSizes = this.sizes.filter(s => s.is_active);
    if (!activeSizes.length) return '<div class="field full"><span>Kích cỡ (Biến thể)</span><p class="text-muted">Chưa có kích cỡ. Hãy tạo kích cỡ trong Quản lý kích cỡ trước.</p></div>';
    const variantMap = {};
    productVariants.forEach(v => { variantMap[v.size_name] = v; });
    const rows = activeSizes.map(size => {
      const existing = variantMap[size.name];
      const isChecked = !!existing;
      const priceAdj = existing ? existing.price_adjustment : 0;
      const isDefault = existing ? existing.is_default : false;
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:${isChecked ? 'var(--bg-card)' : 'transparent'}"><label style="display:flex;align-items:center;gap:8px;margin:0;min-width:120px;cursor:pointer"><input type="checkbox" name="product_variant_check" value="${this.esc(size.name)}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.parentElement.style.background = this.checked ? 'var(--bg-card)' : 'transparent'"><strong>${this.esc(size.name)}</strong></label><div style="flex:1;display:flex;align-items:center;gap:8px"><span class="text-muted" style="font-size:12px">Giá cộng thêm:</span><input type="number" name="product_variant_price_${this.esc(size.name)}" value="${priceAdj}" style="width:100px;padding:4px 8px"></div><label style="display:flex;align-items:center;gap:4px;margin:0;cursor:pointer;font-size:13px"><input type="radio" name="product_variant_default" value="${this.esc(size.name)}" ${isDefault ? 'checked' : ''}> Mặc định</label></div>`;
    }).join('');
    return `<div class="field full"><span>Kích cỡ (Biến thể)</span><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;max-height:300px;overflow:auto">${rows}</div><p class="text-muted" style="margin-top:4px;font-size:12px">Tích chọn để áp dụng kích cỡ cho món này. Chọn 1 kích cỡ làm Mặc định.</p></div>`;
  },
  editProduct(id){const product=this.products.find(item=>item.id===id)||{},categoryOptions=[{value:'',label:'Không có danh mục'},...this.categories.map(item=>({value:item.id,label:item.name}))],selectedToppings=this.toppings.filter(item=>(item.product_ids||[]).map(Number).includes(Number(id))).map(item=>item.id);const html=this.field('code','Mã sản phẩm','text',product.code||'',null,true)+this.field('name','Tên sản phẩm','text',product.name||'',null,true)+this.field('category_id','Danh mục','select',product.category_id||'',categoryOptions)+this.field('price','Giá bán','number',product.price||0,null,true)+this.field('cost_price','Giá vốn','number',product.cost_price||0)+this.field('unit','Đơn vị','text',product.unit||'Phần')+this.field('image_url','Ảnh/emoji','text',product.image_url||'🍗')+this.field('kitchen_type','Nơi chế biến','select',product.kitchen_type||'KITCHEN',[{value:'KITCHEN',label:'Bếp'},{value:'BAR',label:'Pha chế'}])+this.field('description','Mô tả','textarea',product.description||'')+this.variantPicker(product.variants||[])+this.toppingPicker(selectedToppings);this.openEditor(id?'Sửa sản phẩm':'Thêm sản phẩm',html,async(data,form)=>{const variants=[];form.querySelectorAll('input[name="product_variant_check"]:checked').forEach(check=>{const sizeName=check.value;const priceInput=form.querySelector(`input[name="product_variant_price_${sizeName}"]`);const defaultRadio=form.querySelector(`input[name="product_variant_default"][value="${sizeName}"]`);variants.push({size_name:sizeName,price_adjustment:priceInput?Number(priceInput.value):0,is_default:defaultRadio?defaultRadio.checked:false})});Object.keys(data).forEach(key=>{if(key.startsWith('product_variant_')||key==='product_topping')delete data[key]});data.variants=variants;const topping_ids=[...form.querySelectorAll('[name="product_topping"]:checked')].map(input=>Number(input.value));data.category_id=data.category_id?Number(data.category_id):null;data.price=Number(data.price);data.cost_price=Number(data.cost_price||0);let productId=id;if(id)await window.api.put(`/products/${id}`,data);else{const result=await window.api.post('/products',data);productId=result.product.id}await window.api.put(`/products/${productId}/toppings`,{topping_ids});window.api.showToast('Đã lưu sản phẩm, kích cỡ và topping','success');await this.loadAdminProducts()});this.refreshToppingPickerCount()},
  async removeProduct(id){const product=this.products.find(item=>item.id===id);if(product?.is_active){if(!confirm('Ngừng bán sản phẩm này?'))return;await window.api.del(`/products/${id}`)}else await window.api.put(`/products/${id}`,{is_active:true});window.api.showToast('Đã cập nhật sản phẩm','success');await this.loadAdminProducts()},

  manageSizes(){const rows=this.sizes.map(item=>`<div class="store-type-card" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>${this.esc(item.name)}</strong><p class="text-muted">${this.esc(item.description||'Không có mô tả')} · Sắp xếp: ${item.sort_order} · ${item.is_active?'Đang dùng':'Đã ẩn'}</p></div><div><button type="button" class="btn-secondary btn-sm" onclick="adminModule.editSize(${item.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="adminModule.deleteSize(${item.id})">Xóa</button></div></div>`).join('')||'<p class="text-muted">Chưa có kích cỡ</p>';this.openEditor('Quản lý kích cỡ',`<div style="display:flex;gap:8px"><button type="button" class="btn-primary btn-sm" onclick="adminModule.editSize()"><i class="fa-solid fa-plus"></i> Thêm kích cỡ</button></div><div style="display:grid;gap:8px;margin-top:12px">${rows}</div>`,null,{hideSave:true})},
  editSize(id){const item=this.sizes.find(s=>s.id===id)||{};const html=this.field('name','Tên kích cỡ','text',item.name||'',null,true)+this.field('description','Mô tả','text',item.description||'')+this.field('sort_order','Thứ tự sắp xếp','number',item.sort_order||0,null,true);this.openEditor(id?'Sửa kích cỡ':'Thêm kích cỡ',html,async data=>{data.sort_order=Number(data.sort_order);if(id)await window.api.put(`/sizes/${id}`,data);else await window.api.post('/sizes',data);window.api.showToast('Đã lưu kích cỡ','success');await this.loadAdminProducts();this.manageSizes()})},
  async deleteSize(id){const item=this.sizes.find(s=>s.id===id);if(!confirm(`Bạn có chắc chắn muốn xóa kích cỡ "${item?.name||id}"?`))return;await window.api.del(`/sizes/${id}`);window.api.showToast('Đã xóa kích cỡ','success');await this.loadAdminProducts();this.manageSizes()},

  manageToppings(){const rows=this.toppings.map(item=>`<div class="store-type-card" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>${this.esc(item.name)}</strong><p class="text-muted">${this.esc(item.group_name||'Chưa phân nhóm')} · ${window.api.formatMoney(item.price)} · ${item.product_ids.length} món · ${item.is_active?'Đang dùng':'Đã ẩn'}</p></div><div><button type="button" class="btn-secondary btn-sm" onclick="adminModule.editTopping(${item.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="adminModule.toggleTopping(${item.id},${!item.is_active})">${item.is_active?'Ẩn':'Khôi phục'}</button></div></div>`).join('')||'<p class="text-muted">Chưa có topping</p>';this.openEditor('Quản lý topping',`<div style="display:flex;gap:8px"><button type="button" class="btn-primary btn-sm" onclick="adminModule.editTopping()"><i class="fa-solid fa-plus"></i> Thêm topping</button><button type="button" class="btn-secondary btn-sm" onclick="adminModule.manageToppingGroups()"><i class="fa-solid fa-folder-tree"></i> Nhóm topping</button></div><div style="display:grid;gap:8px;margin-top:12px">${rows}</div>`,null,{hideSave:true})},
  editTopping(id){const item=this.toppings.find(topping=>topping.id===id)||{},groups=this.toppingGroups.filter(group=>group.name.trim().toLowerCase()!=='chưa phân nhóm').map(group=>({value:group.id,label:group.name}));if(!groups.length){window.api.showToast('Vui lòng tạo nhóm topping trước','error');this.manageToppingGroups();return}const html=this.field('name','Tên topping','text',item.name||'',null,true)+this.field('group_id','Nhóm topping','select',groups.some(group=>Number(group.value)===Number(item.group_id))?item.group_id:groups[0].value,groups,true)+this.field('price','Giá bán thêm','number',item.price||0,null,true)+`<p class="text-muted">Sau khi lưu, mở từng món để chọn topping áp dụng cho món đó.</p>`;this.openEditor(id?'Sửa topping':'Thêm topping',html,async data=>{data.group_id=Number(data.group_id);data.price=Number(data.price);if(id)await window.api.put(`/toppings/${id}`,data);else await window.api.post('/toppings',data);window.api.showToast('Đã lưu topping','success');await this.loadAdminProducts();this.manageToppings()})},
  manageToppingGroups(){const rows=this.toppingGroups.map(group=>`<div class="store-type-card" style="display:flex;justify-content:space-between;align-items:center"><span><strong>${this.esc(group.name)}</strong><br><small class="text-muted">${group.topping_count} topping · ${group.is_active?'Đang dùng':'Đã ẩn'}</small></span><button type="button" class="btn-secondary btn-sm" onclick="adminModule.editToppingGroup(${group.id})">Sửa</button></div>`).join('')||'<p class="text-muted">Chưa có nhóm topping</p>';this.openEditor('Nhóm topping',`<button type="button" class="btn-primary btn-sm" onclick="adminModule.editToppingGroup()"><i class="fa-solid fa-plus"></i> Thêm nhóm</button><div style="display:grid;gap:8px;margin-top:12px">${rows}</div>`,null,{hideSave:true})},
  editToppingGroup(id){const group=this.toppingGroups.find(item=>item.id===id)||{};const html=this.field('name','Tên nhóm','text',group.name||'',null,true)+this.field('description','Mô tả','textarea',group.description||'')+this.field('sort_order','Thứ tự hiển thị','number',group.sort_order||0)+(id?this.field('is_active','Trạng thái','select',String(group.is_active),[{value:'true',label:'Đang dùng'},{value:'false',label:'Ẩn'}]):'');this.openEditor(id?'Sửa nhóm topping':'Thêm nhóm topping',html,async data=>{data.sort_order=Number(data.sort_order||0);if(id){data.is_active=data.is_active==='true';await window.api.put(`/topping-groups/${id}`,data)}else await window.api.post('/topping-groups',data);window.api.showToast('Đã lưu nhóm topping','success');await this.loadAdminProducts();this.manageToppingGroups()})},
  async toggleTopping(id,is_active){await window.api.put(`/toppings/${id}`,{is_active});window.api.showToast('Đã cập nhật topping','success');await this.loadAdminProducts();this.manageToppings()},
  manageCategories(){const html=`<button type="button" class="btn-primary btn-sm" onclick="adminModule.editCategory()">Thêm danh mục</button><div style="margin-top:12px">${this.categories.map(item=>`<div class="pay-row"><span><strong>${this.esc(item.name)}</strong><br><small>${this.esc(item.code||'')}</small></span><span><button type="button" class="btn-secondary btn-sm" onclick="adminModule.editCategory(${item.id})">Sửa</button> <button type="button" class="btn-secondary btn-sm" onclick="adminModule.removeCategory(${item.id})">Xóa</button></span></div>`).join('')||'Chưa có danh mục'}</div>`;this.openEditor('Danh mục sản phẩm',html,null,{hideSave:true})},
  editCategory(id){const item=this.categories.find(category=>category.id===id)||{};const html=this.field('code','Mã danh mục','text',item.code||'')+this.field('name','Tên danh mục','text',item.name||'',null,true)+this.field('description','Mô tả','textarea',item.description||'')+this.field('sort_order','Thứ tự','number',item.sort_order||0);this.openEditor(id?'Sửa danh mục':'Thêm danh mục',html,async data=>{data.sort_order=Number(data.sort_order||0);if(id)await window.api.put(`/categories/${id}`,data);else await window.api.post('/categories',data);window.api.showToast('Đã lưu danh mục','success');await this.loadAdminProducts()})},
  async removeCategory(id){if(!confirm('Xóa danh mục này? Sản phẩm sẽ vẫn được giữ lại.'))return;await window.api.del(`/categories/${id}`);this.closeEditor();window.api.showToast('Đã xóa danh mục','success');await this.loadAdminProducts()},

  async loadStaff(){if(window.appState.user?.role!=='STORE_MANAGER')return;try{const result=await window.api.get('/store/staff');this.staff=result.staff||[];document.getElementById('adminStaffTableBody').innerHTML=this.staff.map(user=>`<tr><td><strong>${this.esc(user.full_name)}</strong><br><small>${this.esc(user.username)} · ${this.esc(user.email)}</small></td><td>${user.role}</td><td>${user.status}</td><td><button class="btn-secondary btn-sm" onclick="adminModule.editStaff(${user.id})">Sửa</button> <button class="btn-secondary btn-sm" onclick="adminModule.resetStaffPassword(${user.id})">Đặt lại mật khẩu</button></td></tr>`).join('')||'<tr><td colspan="4">Chưa có nhân viên</td></tr>'}catch(error){console.error('loadStaff error:',error)}},
  editStaff(id){const user=this.staff.find(item=>item.id===id)||{},roles=this.staffRoles.map(role=>({value:role,label:role})),completedValue=typeof user.completed_items_override==='boolean'?String(user.completed_items_override):'inherit';const html=(!id?this.field('username','Tên đăng nhập','text','',null,true):'')+this.field('full_name','Họ tên','text',user.full_name||'',null,true)+this.field('email','Email','email',user.email||'',null,true)+this.field('phone','Số điện thoại','text',user.phone||'')+this.field('role','Vai trò','select',user.role||'CASHIER',roles,true)+this.field('status','Trạng thái','select',user.status||'ACTIVE',[{value:'ACTIVE',label:'Hoạt động'},{value:'INACTIVE',label:'Khóa'}])+this.field('completed_items_enabled','Quyền xem Món đã xong','select',completedValue,[{value:'inherit',label:'Theo nhóm quyền'},{value:'true',label:'Bật cho tài khoản này'},{value:'false',label:'Tắt cho tài khoản này'}])+(!id?this.field('password','Mật khẩu','password','',null,true):'');this.openEditor(id?'Sửa nhân viên':'Tạo tài khoản nhân viên',html,async data=>{data.completed_items_enabled=data.completed_items_enabled==='inherit'?null:data.completed_items_enabled==='true';if(id)await window.api.put(`/store/staff/${id}`,data);else await window.api.post('/store/staff',data);window.api.showToast('Đã lưu nhân viên','success');await this.loadStaff()})},
  resetStaffPassword(id){this.openEditor('Đặt lại mật khẩu',this.field('password','Mật khẩu mới (ít nhất 6 ký tự)','password','',null,true),async data=>{await window.api.put(`/store/staff/${id}/reset-password`,data);window.api.showToast('Đã đặt lại mật khẩu','success')})},

  async loadStoreRoleFeatures(){if(window.appState.user?.role!=='STORE_MANAGER')return;try{const result=await window.api.get('/store/role-features');document.getElementById('storeTypesConfigContainer').innerHTML=(result.roles||[]).map(group=>`<div class="store-type-card"><h4>${group.role}</h4><div class="features-toggle-grid">${group.features.map(feature=>`<div class="feature-toggle-item"><span>${this.featureLabels[feature.feature_code]||feature.feature_code}</span><label class="switch-input"><input type="checkbox" ${feature.enabled?'checked':''} onchange="adminModule.setStoreRoleFeature('${group.role}','${feature.feature_code}',this.checked,this)"><span class="slider"></span></label></div>`).join('')}</div></div>`).join('')}catch(error){console.error('loadStoreRoleFeatures error:',error)}},
  async setStoreRoleFeature(role,feature,enabled,input){try{await window.api.put(`/store/role-features/${role}`,{feature_code:feature,enabled});window.api.showToast('Đã cập nhật phân quyền','success')}catch(error){input.checked=!enabled;window.api.showToast(error.message,'error')}},

  async configureWorkflow(){const storeId=window.appState.currentStore?.id;if(!storeId)return;const detail=await window.api.get(`/stores/${storeId}`),workflow=detail.settings?.workflow_definition||{name:'Luồng vận hành',steps:[]};const html=this.field('workflow_name','Tên luồng','text',workflow.name||'',null,true)+`<div class="form-group"><label>Các bước xử lý</label><div id="managerWorkflowSteps">${(workflow.steps||[]).map(step=>this.workflowRow(step)).join('')}</div><button type="button" class="btn-secondary btn-sm" id="btnAddManagerWorkflow">Thêm bước</button><small class="text-muted">Chỉ bắt buộc bước đầu tiên là Tạo đơn và luồng có bước Thanh toán. Bếp và Phê duyệt là tùy chọn.</small></div>`;this.openEditor('Cấu hình luồng cửa hàng',html,async(data,form)=>{const steps=[...form.querySelectorAll('.manager-workflow-row')].map((row,index)=>({id:row.dataset.id||`step_${index+1}`,name:row.querySelector('[name="step_name"]').value,type:row.querySelector('[name="step_type"]').value,roles:row.querySelector('[name="step_roles"]').value.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean)}));await window.api.put(`/stores/${storeId}/settings`,{workflow_definition:{name:data.workflow_name,steps}});window.api.showToast('Đã cập nhật luồng vận hành','success')});document.getElementById('btnAddManagerWorkflow').onclick=()=>document.getElementById('managerWorkflowSteps').insertAdjacentHTML('beforeend',this.workflowRow({id:`step_${Date.now()}`,name:'Bước mới',type:'APPROVAL',roles:['STORE_MANAGER']}))},
  workflowRow(step){return `<div class="manager-workflow-row store-type-card" data-id="${this.esc(step.id||'')}">${this.field('step_name','Tên bước','text',step.name||'',null,true)}${this.field('step_type','Loại','select',step.type||'APPROVAL',[{value:'CREATE',label:'Tạo đơn'},{value:'APPROVAL',label:'Phê duyệt'},{value:'KITCHEN',label:'Bếp'},{value:'PAYMENT',label:'Thanh toán'}])}${this.field('step_roles','Vai trò (phân cách bằng dấu phẩy)','text',(step.roles||[]).join(', '),null,true)}<button type="button" class="btn-secondary btn-sm" onclick="this.closest('.manager-workflow-row').remove()">Xóa bước</button></div>`},

  async loadInventory() {
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const startInput = document.getElementById('invReportStartDate');
    const endInput = document.getElementById('invReportEndDate');
    if (startInput && !startInput.value) startInput.value = firstDay;
    if (endInput && !endInput.value) endInput.value = today;

    await this.loadInventorySummary();
    await Promise.all([
      this.loadInventoryItems(),
      this.loadInventoryReports(),
      this.loadInventoryTransactions()
    ]);
  },

  switchInventoryPill(targetPillId) {
    document.querySelectorAll('.inv-nav-pill').forEach(btn => {
      const active = btn.dataset.pill === targetPillId;
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    document.querySelectorAll('.inv-tab-content').forEach(pane => {
      pane.style.display = pane.id === targetPillId ? 'block' : 'none';
    });
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
    const sEl = document.getElementById('invReportStartDate');
    const eEl = document.getElementById('invReportEndDate');
    if (sEl) sEl.value = start;
    if (eEl) eEl.value = today;
    this.loadInventoryReports();
  },

  async loadInventorySummary() {
    try {
      const res = await window.api.get('/inventory/summary');
      if (!res.success) return;
      this.inventorySummary = res.summary;
      const isSimpleMode = res.summary.inventory_transactions_enabled === false;
      this.isInventorySimpleMode = isSimpleMode;
      
      const elTotal = document.getElementById('invMetricTotalItems');
      const elVal = document.getElementById('invMetricTotalValue');
      const elLow = document.getElementById('invMetricLowStock');
      const elOut = document.getElementById('invMetricOutOfStock');

      if (elTotal) elTotal.textContent = `${res.summary.totalItems} món`;
      if (elVal) elVal.textContent = window.api.formatMoney(res.summary.totalStockValue);

      // Adjust action buttons & tabs based on inventory_transactions_enabled
      const btnExport = document.getElementById('btnOpenExportInventoryModal');
      const btnAdjust = document.getElementById('btnOpenAdjustInventoryModal');
      const btnImport = document.getElementById('btnOpenImportInventoryModal');
      const btnSummaryPill = document.getElementById('btnInvPillSummary');
      const btnTransPill = document.getElementById('btnInvPillTransactions');
      const btnReportsPill = document.getElementById('btnInvPillReports');
      const btnItemsPill = document.getElementById('btnInvPillItems');

      if (btnExport) btnExport.style.display = isSimpleMode ? 'none' : '';
      if (btnAdjust) btnAdjust.style.display = isSimpleMode ? 'none' : '';
      if (btnTransPill) btnTransPill.style.display = isSimpleMode ? 'none' : '';
      if (btnSummaryPill) btnSummaryPill.style.display = isSimpleMode ? 'none' : '';
      if (btnImport) {
        btnImport.innerHTML = isSimpleMode 
          ? '<i class="fa-solid fa-bolt"></i> Nhập thêm hàng' 
          : '<i class="fa-solid fa-arrow-down"></i> Nhập kho';
      }
      if (btnReportsPill) {
        btnReportsPill.innerHTML = isSimpleMode 
          ? '<i class="fa-solid fa-chart-pie"></i> Thống kê nhập hàng trong tháng' 
          : '<i class="fa-solid fa-chart-pie"></i> Thống kê từ ngày đến ngày';
      }
      if (btnItemsPill) {
        btnItemsPill.innerHTML = isSimpleMode
          ? '<i class="fa-solid fa-boxes-stacked"></i> Danh mục mặt hàng kho'
          : '<i class="fa-solid fa-list-check"></i> Danh mục mặt hàng';
      }

      if (isSimpleMode) {
        const activePill = document.querySelector('.inv-nav-pill.active')?.dataset?.pill;
        if (!activePill || activePill === 'invPillSummary' || activePill === 'invPillTransactions') {
          this.switchInventoryPill('invPillReports');
        }
      }

      // Update KPI Cards for Simple Mode vs Standard Mode
      const cardLowLabel = elLow?.parentElement?.querySelector('.card-label');
      const cardOutLabel = elOut?.parentElement?.querySelector('.card-label');

      if (isSimpleMode && res.summary.monthly_imports) {
        if (cardLowLabel) cardLowLabel.textContent = `Đã nhập tháng ${res.summary.monthly_imports.month}`;
        if (elLow) elLow.textContent = `${res.summary.monthly_imports.totalQty} (lượng)`;
        if (cardOutLabel) cardOutLabel.textContent = `Tổng tiền nhập tháng ${res.summary.monthly_imports.month}`;
        if (elOut) elOut.textContent = window.api.formatMoney(res.summary.monthly_imports.totalValue);
      } else {
        if (cardLowLabel) cardLowLabel.textContent = 'Sắp hết định mức';
        if (elLow) elLow.textContent = `${res.summary.lowStockCount} món`;
        if (cardOutLabel) cardOutLabel.textContent = 'Đã cạn kho';
        if (elOut) elOut.textContent = `${res.summary.outOfStockCount} món`;
      }

      const catSelect = document.getElementById('invSummaryCategoryFilter');
      if (catSelect) {
        const currentCat = catSelect.value;
        const cats = res.summary.categories || [];
        catSelect.innerHTML = '<option value="">Tất cả phân loại</option>' + cats.map(c => `<option value="${this.esc(c.category)}" ${c.category === currentCat ? 'selected' : ''}>${this.esc(c.category)} (${c.itemCount})</option>`).join('');
      }

      this.filterInventorySummary();
    } catch (err) {
      console.error('loadInventorySummary error:', err);
    }
  },

  filterInventorySummary() {
    if (!this.inventorySummary?.items) return;
    const query = (document.getElementById('invSummarySearch')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('invSummaryCategoryFilter')?.value || '';

    const filtered = this.inventorySummary.items.filter(item => {
      if (cat && item.category !== cat) return false;
      if (query) {
        const matchCode = (item.code || '').toLowerCase().includes(query);
        const matchName = (item.name || '').toLowerCase().includes(query);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });

    const tbody = document.getElementById('invSummaryTableBody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;" class="text-muted">Không có mặt hàng nào phù hợp</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const isOut = item.current_stock <= 0;
      const isLow = !isOut && item.current_stock <= item.min_stock;
      let statusBadge = `<span class="badge badge-success" style="background:#ecfdf5;color:#10b981;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;"><i class="fa-solid fa-circle-check"></i> Đủ tồn</span>`;
      if (isOut) {
        statusBadge = `<span class="badge badge-danger" style="background:#fef2f2;color:#ef4444;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Cạn kho</span>`;
      } else if (isLow) {
        statusBadge = `<span class="badge badge-warning" style="background:#fffbeb;color:#d97706;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Sắp hết</span>`;
      }

      const totalVal = Math.round(item.current_stock * item.cost_price);
      let actionButtons = '';
      if (this.isInventorySimpleMode) {
        actionButtons = `
          <div style="display:flex;gap:4px;">
            <button type="button" class="btn-primary btn-sm" title="Nhập thêm hàng" onclick="adminModule.openQuickImportItem(${item.id})"><i class="fa-solid fa-plus"></i> Nhập</button>
            <button type="button" class="btn-secondary btn-sm" title="Sửa mặt hàng & tồn" onclick="adminModule.openEditInventoryItem(${item.id})"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        `;
      } else {
        actionButtons = `
          <div style="display:flex;gap:4px;">
            <button type="button" class="btn-secondary btn-sm" title="Nhập thêm" onclick="adminModule.openInventoryTransactionModal('IN', ${item.id})"><i class="fa-solid fa-plus text-success"></i></button>
            <button type="button" class="btn-secondary btn-sm" title="Xuất kho" onclick="adminModule.openInventoryTransactionModal('OUT', ${item.id})"><i class="fa-solid fa-minus text-danger"></i></button>
            <button type="button" class="btn-secondary btn-sm" title="Sửa" onclick="adminModule.openEditInventoryItem(${item.id})"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        `;
      }

      return `
        <tr>
          <td><strong>${this.esc(item.code)}</strong></td>
          <td><strong>${this.esc(item.name)}</strong></td>
          <td><span class="badge" style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:12px;">${this.esc(item.category || 'Khác')}</span></td>
          <td>${this.esc(item.unit)}</td>
          <td>${window.api.formatMoney(item.cost_price)}</td>
          <td><strong style="font-size:14px;color:${isOut ? '#ef4444' : (isLow ? '#d97706' : '#0f172a')}">${item.current_stock}</strong> <small class="text-muted">${this.esc(item.unit)}</small></td>
          <td><small class="text-muted">${item.min_stock} ${this.esc(item.unit)}</small></td>
          <td><strong>${window.api.formatMoney(totalVal)}</strong></td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');
  },

  async loadInventoryItems() {
    try {
      const res = await window.api.get('/inventory/items?include_inactive=true');
      this.inventoryItems = res.items || [];
      this.filterInventoryItems();
    } catch (err) {
      console.error('loadInventoryItems error:', err);
    }
  },

  filterInventoryItems() {
    const query = (document.getElementById('invItemsSearch')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('invItemsTableBody');
    if (!tbody) return;

    const filtered = (this.inventoryItems || []).filter(item => {
      if (!query) return true;
      return (item.code || '').toLowerCase().includes(query) || (item.name || '').toLowerCase().includes(query) || (item.category || '').toLowerCase().includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;" class="text-muted">Chưa có mặt hàng nào</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${this.esc(item.code)}</strong></td>
        <td><strong>${this.esc(item.name)}</strong></td>
        <td>${this.esc(item.category || '-')}</td>
        <td>${this.esc(item.unit)}</td>
        <td>${window.api.formatMoney(item.cost_price)}</td>
        <td><strong>${item.current_stock}</strong> ${this.esc(item.unit)}</td>
        <td>${item.min_stock} ${this.esc(item.unit)}</td>
        <td>${item.is_active ? '<span style="color:#10b981;font-weight:600;">Đang dùng</span>' : '<span style="color:#94a3b8;">Đã ẩn</span>'}</td>
        <td>
          <div style="display:flex;gap:4px;">
            ${this.isInventorySimpleMode ? `<button type="button" class="btn-primary btn-sm" onclick="adminModule.openQuickImportItem(${item.id})"><i class="fa-solid fa-plus"></i> Nhập</button>` : ''}
            <button type="button" class="btn-secondary btn-sm" onclick="adminModule.openEditInventoryItem(${item.id})">Sửa</button>
            <button type="button" class="btn-secondary btn-sm" onclick="adminModule.deleteInventoryItem(${item.id})">${item.is_active ? 'Xóa' : 'Khôi phục'}</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openQuickImportItem(id) {
    const item = (this.inventoryItems || []).find(i => i.id === id) || (this.inventorySummary?.items || []).find(i => i.id === id);
    if (!item) return;

    const html = `
      <div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <strong style="font-size:15px;color:#0f172a;">${this.esc(item.name)}</strong> <span style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px;">Mã: ${this.esc(item.code)}</span>
        <div style="margin-top:6px;font-size:13px;color:#64748b;">
          Tồn hiện tại: <strong style="color:#0f172a;">${item.current_stock} ${this.esc(item.unit)}</strong> | Giá vốn hiện tại: <strong>${window.api.formatMoney(item.cost_price)}</strong>
        </div>
      </div>
    ` +
    this.field('import_qty', `Số lượng nhập thêm (${this.esc(item.unit)})`, 'number', 1, null, true) +
    this.field('cost_price', 'Đơn giá nhập lần này (VNĐ)', 'number', item.cost_price || 0, null, true);

    this.openEditor('⚡ Nhập thêm hàng nhanh', html, async (data) => {
      const addedQty = Number(data.import_qty || 0);
      if (addedQty <= 0) {
        window.api.showToast('Số lượng nhập thêm phải lớn hơn 0', 'error');
        return;
      }
      const unitCost = Number(data.cost_price || item.cost_price || 0);
      await window.api.put(`/inventory/items/${id}`, {
        import_qty: addedQty,
        cost_price: unitCost
      });
      window.api.showToast(`Đã nhập thêm ${addedQty} ${item.unit} cho ${item.name}`, 'success');
      await Promise.all([this.loadInventorySummary(), this.loadInventoryItems()]);
    });
  },

  openEditInventoryItem(id) {
    const item = id ? this.inventoryItems.find(i => i.id === id) : null;
    const catOptions = this.inventoryCategories.map(c => ({ value: c, label: c }));
    if (item?.category && !this.inventoryCategories.includes(item.category)) {
      catOptions.unshift({ value: item.category, label: item.category });
    }

    let html =
      this.field('code', 'Mã mặt hàng (duy nhất)', 'text', item?.code || '', null, true) +
      this.field('name', 'Tên mặt hàng / Nguyên vật liệu', 'text', item?.name || '', null, true) +
      this.field('category', 'Nhóm phân loại', 'select', item?.category || 'Nguyên liệu', catOptions, true) +
      this.field('unit', 'Đơn vị tính (kg, g, lít, ml, bao, hộp, chai...)', 'text', item?.unit || 'kg', null, true) +
      this.field('cost_price', 'Giá vốn / Giá nhập bình quân (VNĐ)', 'number', item?.cost_price || 0, null, true) +
      this.field('min_stock', 'Định mức tồn tối thiểu (để cảnh báo hết hàng)', 'number', item?.min_stock !== undefined ? item.min_stock : 5, null, true);

    if (!id) {
      html += this.field('current_stock', 'Số lượng tồn ban đầu', 'number', 0, null, true);
    } else {
      html += this.field('current_stock', 'Số lượng tồn kho hiện tại (sửa trực tiếp)', 'number', item?.current_stock !== undefined ? item.current_stock : 0, null, true);
      html += this.field('import_qty', '⚡ Hoặc cộng thêm số lượng nhập lần này', 'number', 0, null, false);
    }

    this.openEditor(id ? 'Sửa thông tin mặt hàng kho' : 'Thêm mặt hàng kho mới', html, async (data) => {
      data.cost_price = Number(data.cost_price || 0);
      data.min_stock = Number(data.min_stock || 0);
      if (data.current_stock !== undefined) data.current_stock = Number(data.current_stock || 0);
      if (data.import_qty !== undefined) data.import_qty = Number(data.import_qty || 0);

      if (id) {
        await window.api.put(`/inventory/items/${id}`, data);
        window.api.showToast('Cập nhật mặt hàng kho thành công', 'success');
      } else {
        await window.api.post('/inventory/items', data);
        window.api.showToast('Thêm mặt hàng kho thành công', 'success');
      }
      await Promise.all([this.loadInventorySummary(), this.loadInventoryItems()]);
    });
  },

  async deleteInventoryItem(id) {
    const item = this.inventoryItems.find(i => i.id === id);
    if (!item) return;

    if (item.is_active) {
      if (!confirm(`Xác nhận xóa mặt hàng "${item.name}" (${item.code})?`)) return;
      await window.api.del(`/inventory/items/${id}`);
      window.api.showToast('Đã xóa mặt hàng kho', 'success');
    } else {
      await window.api.put(`/inventory/items/${id}`, { is_active: true });
      window.api.showToast('Đã khôi phục mặt hàng kho', 'success');
    }
    await Promise.all([this.loadInventorySummary(), this.loadInventoryItems()]);
  },

  openInventoryTransactionModal(type = 'IN', defaultItemId = null) {
    if (this.isInventorySimpleMode) {
      this.openQuickImportItem(defaultItemId || this.inventoryItems[0]?.id);
      return;
    }

    const typeLabel = type === 'IN' ? 'Phiếu Nhập kho' : (type === 'OUT' ? 'Phiếu Xuất kho' : 'Phiếu Kiểm kê cân bằng');
    const items = (this.inventoryItems || []).filter(i => i.is_active);
    if (!items.length) {
      window.api.showToast('Chưa có mặt hàng kho nào. Vui lòng tạo mặt hàng trước.', 'error');
      return;
    }

    const itemOptions = items.map(i => ({
      value: i.id,
      label: `${i.code} - ${i.name} (Tồn: ${i.current_stock} ${i.unit})`
    }));

    const selItem = defaultItemId ? items.find(i => i.id === defaultItemId) : items[0];
    const initialPrice = selItem ? (selItem.cost_price || 0) : 0;

    const html =
      this.field('item_id', 'Chọn mặt hàng', 'select', defaultItemId || items[0]?.id, itemOptions, true) +
      this.field('transaction_type', 'Loại phiếu', 'select', type, [
        { value: 'IN', label: '📥 Nhập kho (Tăng số lượng tồn)' },
        { value: 'OUT', label: '📤 Xuất kho (Giảm số lượng tồn)' },
        { value: 'ADJUST', label: '⚖ Cân bằng kiểm kê (Đặt tồn thực tế)' }
      ], true) +
      (type === 'ADJUST' 
        ? this.field('new_stock', 'Số lượng tồn kiểm kê thực tế', 'number', selItem?.current_stock || 0, null, true)
        : this.field('quantity', type === 'IN' ? 'Số lượng nhập' : 'Số lượng xuất', 'number', 1, null, true)
      ) +
      this.field('price', 'Đơn giá (VNĐ)', 'number', initialPrice, null, true) +
      this.field('note', 'Ghi chú / Lý do (Nhà cung cấp, mục đích dùng, kiểm kê...)', 'textarea', '', null, false);

    this.openEditor(typeLabel, html, async (data) => {
      data.item_id = Number(data.item_id);
      data.price = Number(data.price || 0);
      if (data.transaction_type === 'ADJUST') {
        data.new_stock = Number(data.new_stock);
      } else {
        data.quantity = Number(data.quantity);
      }

      const res = await window.api.post('/inventory/transactions', data);
      window.api.showToast(res.message || 'Lập phiếu kho thành công', 'success');
      await Promise.all([
        this.loadInventorySummary(),
        this.loadInventoryItems(),
        this.loadInventoryReports(),
        this.loadInventoryTransactions()
      ]);
    });
  },

  async loadInventoryReports() {
    const startDate = document.getElementById('invReportStartDate')?.value;
    const endDate = document.getElementById('invReportEndDate')?.value;
    let url = '/inventory/reports';
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }

    try {
      const res = await window.api.get(url);
      if (!res.success) return;
      const rep = res.report;
      this.inventoryReports = rep;

      const isSimple = (typeof rep.inventory_transactions_enabled === 'boolean')
        ? !rep.inventory_transactions_enabled
        : !!this.isInventorySimpleMode;
      const titleEl = document.getElementById('invReportsTableTitle');
      const thead = document.getElementById('invReportsTableHead');
      const tfoot = document.getElementById('invReportsTableFoot');
      const cardExp = document.getElementById('invRepCardExport');
      const cardNet = document.getElementById('invRepCardNet');
      const cardImpLabel = document.querySelector('#invRepCardImport .card-label');
      const elImpVal = document.getElementById('invRepTotalImport');
      const elImpQty = document.getElementById('invRepImportQty');
      const elExpVal = document.getElementById('invRepTotalExport');
      const elExpQty = document.getElementById('invRepExportQty');
      const elNetVal = document.getElementById('invRepNetValue');
      const elNetQty = document.getElementById('invRepNetQty');

      let grandQty = 0;
      let grandTotal = 0;

      (rep.itemsTurnover || []).forEach(item => {
        const price = Number(item.cost_price || 0);
        const qty = Number(item.in_qty || 0);
        grandQty += qty;
        grandTotal += Math.round(price * qty);
      });

      if (isSimple) {
        if (cardExp) cardExp.style.display = 'none';
        if (cardNet) cardNet.style.display = 'none';
        if (cardImpLabel) cardImpLabel.textContent = 'Tổng số tiền đã nhập trong tháng';
        if (elImpVal) elImpVal.textContent = window.api.formatMoney(grandTotal);
        if (elImpQty) elImpQty.textContent = `Tổng số lượng: ${Math.round(grandQty * 100) / 100}`;

        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-table-list text-primary"></i> Thống kê nhập hàng trong tháng (Giá tiền * Số lượng)';
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
        if (cardExp) cardExp.style.display = '';
        if (cardNet) cardNet.style.display = '';
        if (cardImpLabel) cardImpLabel.textContent = 'Tổng giá trị nhập trong kỳ';
        if (elImpVal) elImpVal.textContent = window.api.formatMoney(rep.summary.totalImportValue);
        if (elImpQty) elImpQty.textContent = `Tổng lượng: ${rep.summary.totalImportQty}`;
        if (elExpVal) elExpVal.textContent = window.api.formatMoney(rep.summary.totalExportValue);
        if (elExpQty) elExpQty.textContent = `Tổng lượng: ${rep.summary.totalExportQty}`;
        if (elNetVal) elNetVal.textContent = window.api.formatMoney(rep.summary.netValueChange);
        if (elNetQty) elNetQty.textContent = `Lệch: ${rep.summary.netQtyChange >= 0 ? '+' : ''}${rep.summary.netQtyChange}`;

        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-table-list text-primary"></i> Báo cáo Nhập - Xuất - Tồn theo mặt hàng';
        if (thead) {
          thead.innerHTML = `
            <tr>
              <th>Mã</th>
              <th>Tên mặt hàng</th>
              <th>ĐVT</th>
              <th>Giá vốn</th>
              <th>Tồn đầu kỳ</th>
              <th style="color:var(--success, #10b981)">Tổng nhập</th>
              <th style="color:var(--primary, #ef4b25)">Tổng xuất</th>
              <th>Kiểm kê +/-</th>
              <th>Tồn cuối kỳ</th>
              <th>Giá trị tồn cuối</th>
            </tr>
          `;
        }
      }

      const tbody = document.getElementById('invReportsTableBody');
      if (!tbody) return;

      if (!rep.itemsTurnover || !rep.itemsTurnover.length) {
        tbody.innerHTML = `<tr><td colspan="${isSimple ? 6 : 10}" style="text-align:center;padding:24px;" class="text-muted">Không có dữ liệu trong khoảng thời gian này</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';
        return;
      }

      if (isSimple) {
        tbody.innerHTML = rep.itemsTurnover.map(item => {
          const price = Number(item.cost_price || 0);
          const qty = Number(item.in_qty || 0);
          const total = Math.round(price * qty);
          return `
            <tr>
              <td><strong>${this.esc(item.code)}</strong></td>
              <td><strong>${this.esc(item.name)}</strong></td>
              <td>${this.esc(item.unit)}</td>
              <td style="text-align:right;">${window.api.formatMoney(price)}</td>
              <td style="text-align:right;"><strong style="color:#10b981;font-size:14px;">${qty}</strong></td>
              <td style="text-align:right;"><strong style="color:#0f172a;font-size:14px;">${window.api.formatMoney(total)}</strong></td>
            </tr>
          `;
        }).join('');

        if (tfoot) {
          tfoot.innerHTML = `
            <tr style="background:#f8fafc;font-weight:bold;border-top:2px solid #cbd5e1;">
              <td colspan="4" style="text-align:right;font-size:14px;">TỔNG CỘNG ĐÃ NHẬP:</td>
              <td style="text-align:right;color:#10b981;font-size:15px;">${Math.round(grandQty * 100) / 100}</td>
              <td style="text-align:right;color:#ef4b25;font-size:15px;">${window.api.formatMoney(grandTotal)}</td>
            </tr>
          `;
        }
      } else {
        tbody.innerHTML = rep.itemsTurnover.map(item => `
          <tr>
            <td><strong>${this.esc(item.code)}</strong></td>
            <td><strong>${this.esc(item.name)}</strong></td>
            <td>${this.esc(item.unit)}</td>
            <td>${window.api.formatMoney(item.cost_price)}</td>
            <td><strong>${item.initial_stock}</strong></td>
            <td style="color:#10b981;font-weight:600;">+${item.in_qty} <br><small style="color:#64748b;">(${window.api.formatMoney(item.in_value)})</small></td>
            <td style="color:#ef4444;font-weight:600;">-${item.out_qty} <br><small style="color:#64748b;">(${window.api.formatMoney(item.out_value)})</small></td>
            <td>${item.adjust_qty !== 0 ? (item.adjust_qty > 0 ? `+${item.adjust_qty}` : item.adjust_qty) : '-'}</td>
            <td><strong style="color:#0f172a;font-size:14px;">${item.final_stock}</strong></td>
            <td><strong style="color:#0f172a;">${window.api.formatMoney(item.final_value)}</strong></td>
          </tr>
        `).join('');

        if (tfoot) tfoot.innerHTML = '';
      }
    } catch (err) {
      console.error('loadInventoryReports error:', err);
    }
  },

  async loadInventoryTransactions() {
    const startDate = document.getElementById('invReportStartDate')?.value;
    const endDate = document.getElementById('invReportEndDate')?.value;
    const type = document.getElementById('invTransTypeFilter')?.value || '';

    let url = '/inventory/transactions?limit=100';
    if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
    if (type) url += `&type=${type}`;

    try {
      const res = await window.api.get(url);
      const list = res.transactions || [];
      const tbody = document.getElementById('invTransactionsTableBody');
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;" class="text-muted">Chưa có giao dịch kho nào</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(t => {
        let typeBadge = `<span style="background:#ecfdf5;color:#10b981;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">NHẬP KHO</span>`;
        if (t.transaction_type === 'OUT') {
          typeBadge = `<span style="background:#fef2f2;color:#ef4444;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">XUẤT KHO</span>`;
        } else if (t.transaction_type === 'ADJUST') {
          typeBadge = `<span style="background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">KIỂM KÊ</span>`;
        }

        const dateStr = t.created_at ? new Date(t.created_at).toLocaleString('vi-VN') : '-';
        return `
          <tr>
            <td><small class="text-muted">${dateStr}</small></td>
            <td><strong>${this.esc(t.transaction_code)}</strong></td>
            <td>${typeBadge}</td>
            <td><strong>${this.esc(t.item_name)}</strong> <small class="text-muted">(${this.esc(t.item_code)})</small></td>
            <td><strong>${t.quantity}</strong> ${this.esc(t.item_unit || '')}</td>
            <td>${window.api.formatMoney(t.price)}</td>
            <td><strong>${window.api.formatMoney(t.total_amount)}</strong></td>
            <td>${t.stock_before} ➔ <strong>${t.stock_after}</strong></td>
            <td><small>${this.esc(t.user_name || 'Hệ thống')}</small></td>
            <td><small class="text-muted">${this.esc(t.note || '-')}</small></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('loadInventoryTransactions error:', err);
    }
  }
};
