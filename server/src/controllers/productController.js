const { pool, isPostgresConnected, memoryStore } = require('../config/db');

function normalizeProductIds(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map(Number).filter(id => Number.isInteger(id) && id > 0))];
}

async function assertProductsBelongToStore(client, productIds, storeId) {
  if (!productIds.length) return;
  const result = await client.query(
    'SELECT id FROM products WHERE store_id=$1 AND id=ANY($2::int[])',
    [storeId, productIds]
  );
  if (result.rowCount !== productIds.length) {
    const error = new Error('Có món không thuộc cửa hàng đang chọn');
    error.statusCode = 400;
    throw error;
  }
}

async function replaceOptionProducts(client, optionId, productIds, storeId) {
  await assertProductsBelongToStore(client, productIds, storeId);
  await client.query('DELETE FROM product_option_products WHERE option_id=$1', [optionId]);
  if (productIds.length) {
    await client.query(
      `INSERT INTO product_option_products (option_id, product_id)
       SELECT $1, unnest($2::int[])`,
      [optionId, productIds]
    );
  }
}

async function getCategories(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  try {
    let categories = [];
    if (isPostgresConnected()) {
      const result = await pool.query(
        'SELECT * FROM categories WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, id ASC',
        [storeId]
      );
      categories = result.rows;
    } else {
      categories = memoryStore.categories
        .filter(c => c.store_id === storeId && c.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    res.json({ success: true, categories });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh mục sản phẩm' });
  }
}

async function createCategory(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const { name, code, description, sort_order } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục' });
  }

  try {
    let newCat = null;
    if (isPostgresConnected()) {
      const result = await pool.query(
        `INSERT INTO categories (store_id, code, name, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING *`,
        [storeId, code || name.substring(0, 5).toUpperCase(), name, description, sort_order || 0]
      );
      newCat = result.rows[0];
    } else {
      const id = memoryStore.categories.length ? Math.max(...memoryStore.categories.map(c => c.id)) + 1 : 1;
      newCat = {
        id,
        store_id: storeId,
        code: code || name.substring(0, 5).toUpperCase(),
        name,
        description,
        sort_order: sort_order || 0,
        is_active: true
      };
      memoryStore.categories.push(newCat);
    }

    res.status(201).json({ success: true, message: 'Tạo danh mục thành công', category: newCat });
  } catch (error) {
    console.error('createCategory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo danh mục' });
  }
}

async function updateCategory(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId || Number(req.body.store_id);
  const { code, name, description, sort_order, is_active } = req.body;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`UPDATE categories SET code=COALESCE($1,code),name=COALESCE($2,name),
        description=COALESCE($3,description),sort_order=COALESCE($4,sort_order),is_active=COALESCE($5,is_active)
        WHERE id=$6 AND store_id=$7 RETURNING id`, [code, name, description, sort_order, is_active, id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    } else {
      const category = memoryStore.categories.find(item => item.id === id && item.store_id === storeId);
      if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
      for (const field of ['code', 'name', 'description', 'sort_order', 'is_active']) if (req.body[field] !== undefined) category[field] = req.body[field];
    }
    res.json({ success: true, message: 'Cập nhật danh mục thành công' });
  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật danh mục' });
  }
}

async function deleteCategory(req, res) {
  if (req.user?.role === 'STORE_MANAGER') {
    req.body = { ...(req.body || {}), is_active: false };
    return updateCategory(req, res);
  }
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('DELETE FROM categories WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    } else {
      const exists = memoryStore.categories.some(item => item.id === id && item.store_id === storeId);
      if (!exists) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
      memoryStore.categories = memoryStore.categories.filter(item => item.id !== id);
      memoryStore.products.forEach(product => { if (product.category_id === id) product.category_id = null; });
    }
    res.json({ success: true, message: 'Đã xóa danh mục' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa danh mục' });
  }
}

async function getSizes(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  try {
    let sizes = [];
    if (isPostgresConnected()) {
      const result = await pool.query(
        'SELECT * FROM sizes WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, id ASC',
        [storeId]
      );
      sizes = result.rows;
    } else {
      sizes = memoryStore.sizes
        .filter(s => s.store_id === storeId && s.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    res.json({ success: true, sizes });
  } catch (error) {
    console.error('getSizes error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách kích cỡ' });
  }
}

async function createSize(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const { name, description, sort_order } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên kích cỡ' });

  try {
    let newSize = null;
    if (isPostgresConnected()) {
      const result = await pool.query(
        `INSERT INTO sizes (store_id, name, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
        [storeId, name, description, sort_order || 0]
      );
      newSize = result.rows[0];
    } else {
      const id = memoryStore.sizes.length ? Math.max(...memoryStore.sizes.map(s => s.id)) + 1 : 1;
      newSize = { id, store_id: storeId, name, description, sort_order: sort_order || 0, is_active: true };
      memoryStore.sizes.push(newSize);
    }
    res.status(201).json({ success: true, message: 'Tạo kích cỡ thành công', size: newSize });
  } catch (error) {
    console.error('createSize error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo kích cỡ' });
  }
}

async function updateSize(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId || Number(req.body.store_id);
  const { name, description, sort_order, is_active } = req.body;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(
        `UPDATE sizes SET name=COALESCE($1,name), description=COALESCE($2,description),
         sort_order=COALESCE($3,sort_order), is_active=COALESCE($4,is_active)
         WHERE id=$5 AND store_id=$6 RETURNING id`,
        [name, description, sort_order, is_active, id, storeId]
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy kích cỡ' });
    } else {
      const size = memoryStore.sizes.find(item => item.id === id && item.store_id === storeId);
      if (!size) return res.status(404).json({ success: false, message: 'Không tìm thấy kích cỡ' });
      for (const field of ['name', 'description', 'sort_order', 'is_active']) {
        if (req.body[field] !== undefined) size[field] = req.body[field];
      }
    }
    res.json({ success: true, message: 'Cập nhật kích cỡ thành công' });
  } catch (error) {
    console.error('updateSize error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật kích cỡ' });
  }
}

async function deleteSize(req, res) {
  if (req.user?.role === 'STORE_MANAGER') {
    req.body = { ...(req.body || {}), is_active: false };
    return updateSize(req, res);
  }
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('DELETE FROM sizes WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy kích cỡ' });
    } else {
      const exists = memoryStore.sizes.some(item => item.id === id && item.store_id === storeId);
      if (!exists) return res.status(404).json({ success: false, message: 'Không tìm thấy kích cỡ' });
      memoryStore.sizes = memoryStore.sizes.filter(item => item.id !== id);
    }
    res.json({ success: true, message: 'Đã xóa kích cỡ' });
  } catch (error) {
    console.error('deleteSize error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa kích cỡ' });
  }
}

async function getProducts(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
  const includeInactive = req.query.include_inactive === 'true' && ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'].includes(req.user.role);

  try {
    let products = [];
    let options = [];

    if (isPostgresConnected()) {
      let queryStr = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.store_id = $1 ${includeInactive ? '' : 'AND p.is_active = TRUE'}
      `;
      const params = [storeId];
      if (categoryId) {
        queryStr += ' AND p.category_id = $2';
        params.push(categoryId);
      }
      queryStr += ' ORDER BY p.id ASC';

      const prodRes = await pool.query(queryStr, params);
      products = prodRes.rows;

      // Fetch variants for each product
      for (let p of products) {
        const vRes = await pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [p.id]);
        p.variants = vRes.rows;
      }

      // Fetch toppings / options for store
      const optRes = await pool.query(`SELECT po.*,tg.name AS group_name FROM product_options po
        LEFT JOIN topping_groups tg ON tg.id=po.group_id
        WHERE po.store_id=$1 AND po.is_active=TRUE ORDER BY tg.sort_order,po.id`, [storeId]);
      options = optRes.rows;
      const linksRes = await pool.query(`SELECT pop.product_id, pop.option_id
        FROM product_option_products pop
        JOIN products p ON p.id=pop.product_id
        JOIN product_options po ON po.id=pop.option_id
        WHERE p.store_id=$1 AND po.store_id=$1 AND po.is_active=TRUE`, [storeId]);
      const optionById = new Map(options.map(option => [option.id, option]));
      const optionsByProduct = new Map();
      for (const link of linksRes.rows) {
        if (!optionsByProduct.has(link.product_id)) optionsByProduct.set(link.product_id, []);
        const option = optionById.get(link.option_id);
        if (option) optionsByProduct.get(link.product_id).push(option);
      }
      products.forEach(product => { product.options = optionsByProduct.get(product.id) || []; });
    } else {
      let filtered = memoryStore.products.filter(p => p.store_id === storeId && (includeInactive || p.is_active));
      if (categoryId) {
        filtered = filtered.filter(p => p.category_id === categoryId);
      }

      products = filtered.map(p => {
        const cat = memoryStore.categories.find(c => c.id === p.category_id);
        const variants = memoryStore.product_variants.filter(v => v.product_id === p.id);
        return {
          ...p,
          category_name: cat ? cat.name : '',
          variants
        };
      });

      options = memoryStore.product_options.filter(o => o.store_id === storeId && o.is_active);
      products.forEach(product => {
        const optionIds = new Set(memoryStore.product_option_products
          .filter(link => link.product_id === product.id)
          .map(link => link.option_id));
        product.options = options.filter(option => optionIds.has(option.id));
      });
    }

    res.json({ success: true, products, options });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách sản phẩm' });
  }
}

async function createProduct(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const { code, name, category_id, description, price, cost_price, unit, image_url, kitchen_type, variants } = req.body;

  if (!code || !name || price === undefined) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền đủ Mã, Tên và Giá sản phẩm' });
  }

  try {
    let newProduct = null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const prodRes = await client.query(
          `INSERT INTO products (store_id, category_id, code, name, description, price, cost_price, unit, image_url, kitchen_type, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING *`,
          [storeId, category_id || null, code, name, description || '', price, cost_price || 0, unit || 'Phần', image_url || '🍗', kitchen_type || 'KITCHEN']
        );
        newProduct = prodRes.rows[0];

        if (variants && Array.isArray(variants) && variants.length > 0) {
          for (let v of variants) {
            await client.query(
              `INSERT INTO product_variants (product_id, size_name, price_adjustment, is_default)
               VALUES ($1, $2, $3, $4)`,
              [newProduct.id, v.size_name, v.price_adjustment || 0, !!v.is_default]
            );
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const id = memoryStore.products.length ? Math.max(...memoryStore.products.map(p => p.id)) + 1 : 1;
      newProduct = {
        id,
        store_id: storeId,
        category_id: category_id ? parseInt(category_id, 10) : null,
        code,
        name,
        description: description || '',
        price: parseFloat(price),
        cost_price: parseFloat(cost_price || 0),
        unit: unit || 'Phần',
        image_url: image_url || '🍗',
        kitchen_type: kitchen_type || 'KITCHEN',
        is_active: true
      };
      memoryStore.products.push(newProduct);

      if (variants && Array.isArray(variants)) {
        variants.forEach((v, idx) => {
          memoryStore.product_variants.push({
            id: memoryStore.product_variants.length + idx + 1,
            product_id: id,
            size_name: v.size_name,
            price_adjustment: parseFloat(v.price_adjustment || 0),
            is_default: !!v.is_default
          });
        });
      }
    }

    res.status(201).json({ success: true, message: 'Thêm món thành công', product: newProduct });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo món: ' + error.message });
  }
}

async function getOptions(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  try {
    let options = [];
    if (isPostgresConnected()) {
      const resQuery = await pool.query('SELECT * FROM product_options WHERE store_id = $1 AND is_active = TRUE ORDER BY id ASC', [storeId]);
      options = resQuery.rows;
    } else {
      options = memoryStore.product_options.filter(o => o.store_id === storeId && o.is_active);
    }
    res.json({ success: true, options });
  } catch (error) {
    console.error('getOptions error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy toppings/options' });
  }
}

async function updateProduct(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId || Number(req.body.store_id);
  const { variants } = req.body;
  const fields = ['category_id','code','name','description','price','cost_price','unit','image_url','kitchen_type','is_active'];
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const values = fields.map(key => req.body[key]);
        const result = await client.query(`UPDATE products SET category_id=CASE WHEN $13 THEN $1 ELSE category_id END, code=COALESCE($2,code),
          name=COALESCE($3,name), description=COALESCE($4,description), price=COALESCE($5,price),
          cost_price=COALESCE($6,cost_price), unit=COALESCE($7,unit), image_url=COALESCE($8,image_url),
          kitchen_type=COALESCE($9,kitchen_type), is_active=COALESCE($10,is_active), updated_at=CURRENT_TIMESTAMP
          WHERE id=$11 AND store_id=$12 RETURNING id`, [...values, id, storeId, Object.prototype.hasOwnProperty.call(req.body, 'category_id')]);
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        }
        
        if (variants && Array.isArray(variants)) {
          await client.query('DELETE FROM product_variants WHERE product_id = $1', [id]);
          for (let v of variants) {
            await client.query(
              `INSERT INTO product_variants (product_id, size_name, price_adjustment, is_default) VALUES ($1, $2, $3, $4)`,
              [id, v.size_name, v.price_adjustment || 0, !!v.is_default]
            );
          }
        }
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const product = memoryStore.products.find(item => item.id === id && item.store_id === storeId);
      if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
      for (const key of fields) if (req.body[key] !== undefined) product[key] = key === 'category_id' && req.body[key] === null
        ? null
        : (['category_id','price','cost_price'].includes(key) ? Number(req.body[key]) : req.body[key]);
        
      if (variants && Array.isArray(variants)) {
        memoryStore.product_variants = memoryStore.product_variants.filter(v => v.product_id !== id);
        variants.forEach((v, idx) => {
          memoryStore.product_variants.push({
            id: memoryStore.product_variants.length ? Math.max(...memoryStore.product_variants.map(x => x.id)) + 1 + idx : 1,
            product_id: id,
            size_name: v.size_name,
            price_adjustment: parseFloat(v.price_adjustment || 0),
            is_default: !!v.is_default
          });
        });
      }
    }
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Mã sản phẩm đã tồn tại' : 'Lỗi cập nhật sản phẩm' });
  }
}

async function getToppings(req, res) {
  const storeId = req.storeId;
  try {
    let toppings;
    if (isPostgresConnected()) {
      const result = await pool.query(`SELECT po.*,tg.name AS group_name,
        COALESCE(array_agg(pop.product_id ORDER BY pop.product_id)
          FILTER (WHERE pop.product_id IS NOT NULL), '{}') AS product_ids
        FROM product_options po
        LEFT JOIN topping_groups tg ON tg.id=po.group_id
        LEFT JOIN product_option_products pop ON pop.option_id=po.id
        WHERE po.store_id=$1
        GROUP BY po.id,tg.name,tg.sort_order ORDER BY tg.sort_order,po.id`, [storeId]);
      toppings = result.rows.map(item => ({ ...item, product_ids: item.product_ids.map(Number) }));
    } else {
      toppings = memoryStore.product_options.filter(item => item.store_id === storeId).map(item => ({
        ...item,
        group_name: memoryStore.topping_groups.find(group => group.id === item.group_id)?.name || null,
        product_ids: memoryStore.product_option_products.filter(link => link.option_id === item.id).map(link => link.product_id)
      }));
    }
    res.json({ success: true, toppings });
  } catch (error) {
    console.error('getToppings error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách topping' });
  }
}

async function getToppingGroups(req, res) {
  const storeId = req.storeId;
  try {
    let groups;
    if (isPostgresConnected()) {
      const result = await pool.query(`SELECT tg.*,COUNT(po.id)::int AS topping_count
        FROM topping_groups tg LEFT JOIN product_options po ON po.group_id=tg.id
        WHERE tg.store_id=$1 GROUP BY tg.id ORDER BY tg.sort_order,tg.id`, [storeId]);
      groups = result.rows;
    } else {
      groups = memoryStore.topping_groups.filter(group => group.store_id === storeId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(group => ({ ...group, topping_count: memoryStore.product_options.filter(item => item.group_id === group.id).length }));
    }
    res.json({ success: true, groups });
  } catch (error) {
    console.error('getToppingGroups error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy nhóm topping' });
  }
}

async function createToppingGroup(req, res) {
  const storeId = req.storeId;
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const sortOrder = Number(req.body.sort_order || 0);
  if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên nhóm topping' });
  try {
    let group;
    if (isPostgresConnected()) {
      const result = await pool.query(`INSERT INTO topping_groups (store_id,name,description,sort_order,is_active)
        VALUES ($1,$2,$3,$4,TRUE) RETURNING *`, [storeId, name, description, sortOrder]);
      group = result.rows[0];
    } else {
      if (memoryStore.topping_groups.some(item => item.store_id === storeId && item.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ success: false, message: 'Tên nhóm topping đã tồn tại' });
      }
      const id = memoryStore.topping_groups.length ? Math.max(...memoryStore.topping_groups.map(item => item.id)) + 1 : 1;
      group = { id, store_id: storeId, name, description, sort_order: sortOrder, is_active: true };
      memoryStore.topping_groups.push(group);
    }
    res.status(201).json({ success: true, message: 'Đã thêm nhóm topping', group });
  } catch (error) {
    console.error('createToppingGroup error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Tên nhóm topping đã tồn tại' : 'Lỗi thêm nhóm topping' });
  }
}

async function updateToppingGroup(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const description = req.body.description === undefined ? undefined : String(req.body.description).trim();
  const sortOrder = req.body.sort_order === undefined ? undefined : Number(req.body.sort_order);
  const isActive = req.body.is_active;
  if (name === '') return res.status(400).json({ success: false, message: 'Tên nhóm topping không hợp lệ' });
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`UPDATE topping_groups SET name=COALESCE($1,name),description=COALESCE($2,description),
        sort_order=COALESCE($3,sort_order),is_active=COALESCE($4,is_active)
        WHERE id=$5 AND store_id=$6 RETURNING id`, [name, description, sortOrder, isActive, id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm topping' });
    } else {
      const group = memoryStore.topping_groups.find(item => item.id === id && item.store_id === storeId);
      if (!group) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm topping' });
      if (name !== undefined) group.name = name;
      if (description !== undefined) group.description = description;
      if (sortOrder !== undefined) group.sort_order = sortOrder;
      if (isActive !== undefined) group.is_active = !!isActive;
    }
    res.json({ success: true, message: 'Đã cập nhật nhóm topping' });
  } catch (error) {
    console.error('updateToppingGroup error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Tên nhóm topping đã tồn tại' : 'Lỗi cập nhật nhóm topping' });
  }
}

async function createTopping(req, res) {
  const storeId = req.storeId;
  const name = String(req.body.name || '').trim();
  const price = Number(req.body.price || 0);
  const productIds = normalizeProductIds(req.body.product_ids) || [];
  const groupId = req.body.group_id ? Number(req.body.group_id) : null;
  if (!name || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ success: false, message: 'Tên topping và giá bán không hợp lệ' });
  }
  if (groupId !== null && (!Number.isInteger(groupId) || groupId <= 0)) {
    return res.status(400).json({ success: false, message: 'Nhóm topping không hợp lệ' });
  }
  try {
    let topping;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (groupId) {
          const group = await client.query('SELECT id FROM topping_groups WHERE id=$1 AND store_id=$2', [groupId, storeId]);
          if (!group.rowCount) { const error = new Error('Nhóm topping không thuộc cửa hàng đang chọn'); error.statusCode = 400; throw error; }
        }
        const result = await client.query(`INSERT INTO product_options (store_id,group_id,name,price,is_active)
          VALUES ($1,$2,$3,$4,TRUE) RETURNING *`, [storeId, groupId, name, price]);
        topping = result.rows[0];
        await replaceOptionProducts(client, topping.id, productIds, storeId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    } else {
      const validIds = new Set(memoryStore.products.filter(item => item.store_id === storeId).map(item => item.id));
      if (productIds.some(id => !validIds.has(id))) return res.status(400).json({ success: false, message: 'Có món không thuộc cửa hàng đang chọn' });
      const id = memoryStore.product_options.length ? Math.max(...memoryStore.product_options.map(item => item.id)) + 1 : 1;
      if (groupId && !memoryStore.topping_groups.some(group => group.id === groupId && group.store_id === storeId)) return res.status(400).json({ success: false, message: 'Nhóm topping không thuộc cửa hàng đang chọn' });
      topping = { id, store_id: storeId, group_id: groupId, name, price, is_active: true };
      memoryStore.product_options.push(topping);
      productIds.forEach(product_id => memoryStore.product_option_products.push({ option_id: id, product_id }));
    }
    res.status(201).json({ success: true, message: 'Đã thêm topping', topping: { ...topping, product_ids: productIds } });
  } catch (error) {
    console.error('createTopping error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi thêm topping' });
  }
}

async function updateTopping(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  const productIds = normalizeProductIds(req.body.product_ids);
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const price = req.body.price === undefined ? undefined : Number(req.body.price);
  const isActive = req.body.is_active;
  const hasGroupId = Object.prototype.hasOwnProperty.call(req.body, 'group_id');
  const groupId = req.body.group_id ? Number(req.body.group_id) : null;
  if (name === '' || (price !== undefined && (!Number.isFinite(price) || price < 0))) {
    return res.status(400).json({ success: false, message: 'Tên topping và giá bán không hợp lệ' });
  }
  if (hasGroupId && groupId !== null && (!Number.isInteger(groupId) || groupId <= 0)) {
    return res.status(400).json({ success: false, message: 'Nhóm topping không hợp lệ' });
  }
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (hasGroupId && groupId) {
          const group = await client.query('SELECT id FROM topping_groups WHERE id=$1 AND store_id=$2', [groupId, storeId]);
          if (!group.rowCount) { const error = new Error('Nhóm topping không thuộc cửa hàng đang chọn'); error.statusCode = 400; throw error; }
        }
        const result = await client.query(`UPDATE product_options SET
          name=COALESCE($1,name), price=COALESCE($2,price), is_active=COALESCE($3,is_active),
          group_id=CASE WHEN $6 THEN $7 ELSE group_id END
          WHERE id=$4 AND store_id=$5 RETURNING *`, [name, price, isActive, id, storeId, hasGroupId, groupId]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy topping'); error.statusCode = 404; throw error; }
        if (productIds) await replaceOptionProducts(client, id, productIds, storeId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    } else {
      const topping = memoryStore.product_options.find(item => item.id === id && item.store_id === storeId);
      if (!topping) return res.status(404).json({ success: false, message: 'Không tìm thấy topping' });
      if (name !== undefined) topping.name = name;
      if (price !== undefined) topping.price = price;
      if (isActive !== undefined) topping.is_active = !!isActive;
      if (hasGroupId) {
        if (groupId && !memoryStore.topping_groups.some(group => group.id === groupId && group.store_id === storeId)) return res.status(400).json({ success: false, message: 'Nhóm topping không thuộc cửa hàng đang chọn' });
        topping.group_id = groupId;
      }
      if (productIds) {
        const validIds = new Set(memoryStore.products.filter(item => item.store_id === storeId).map(item => item.id));
        if (productIds.some(productId => !validIds.has(productId))) return res.status(400).json({ success: false, message: 'Có món không thuộc cửa hàng đang chọn' });
        memoryStore.product_option_products = memoryStore.product_option_products.filter(link => link.option_id !== id);
        productIds.forEach(product_id => memoryStore.product_option_products.push({ option_id: id, product_id }));
      }
    }
    res.json({ success: true, message: 'Đã cập nhật topping' });
  } catch (error) {
    console.error('updateTopping error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi cập nhật topping' });
  }
}

async function deleteTopping(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('DELETE FROM product_options WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy topping' });
    } else {
      const exists = memoryStore.product_options.some(item => item.id === id && item.store_id === storeId);
      if (!exists) return res.status(404).json({ success: false, message: 'Không tìm thấy topping' });
      memoryStore.product_options = memoryStore.product_options.filter(item => item.id !== id);
      memoryStore.product_option_products = memoryStore.product_option_products.filter(link => link.option_id !== id);
      memoryStore.order_item_options.forEach(option => { if (option.option_id === id) option.option_id = null; });
    }
    res.json({ success: true, message: 'Đã xóa topping' });
  } catch (error) {
    console.error('deleteTopping error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa topping' });
  }
}

async function deleteToppingGroup(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('DELETE FROM topping_groups WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm topping' });
    } else {
      const exists = memoryStore.topping_groups.some(item => item.id === id && item.store_id === storeId);
      if (!exists) return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm topping' });
      memoryStore.topping_groups = memoryStore.topping_groups.filter(item => item.id !== id);
      memoryStore.product_options.forEach(option => { if (option.group_id === id) option.group_id = null; });
    }
    res.json({ success: true, message: 'Đã xóa nhóm topping' });
  } catch (error) {
    console.error('deleteToppingGroup error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa nhóm topping' });
  }
}

async function updateProductToppings(req, res) {
  const productId = Number(req.params.id);
  const storeId = req.storeId;
  const toppingIds = normalizeProductIds(req.body.topping_ids);
  if (!toppingIds) return res.status(400).json({ success: false, message: 'Danh sách topping không hợp lệ' });
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const product = await client.query('SELECT id FROM products WHERE id=$1 AND store_id=$2', [productId, storeId]);
        if (!product.rowCount) { const error = new Error('Không tìm thấy sản phẩm'); error.statusCode = 404; throw error; }
        if (toppingIds.length) {
          const toppings = await client.query('SELECT id FROM product_options WHERE store_id=$1 AND id=ANY($2::int[])', [storeId, toppingIds]);
          if (toppings.rowCount !== toppingIds.length) { const error = new Error('Có topping không thuộc cửa hàng đang chọn'); error.statusCode = 400; throw error; }
        }
        await client.query('DELETE FROM product_option_products WHERE product_id=$1', [productId]);
        if (toppingIds.length) {
          await client.query(`INSERT INTO product_option_products (option_id,product_id)
            SELECT unnest($1::int[]),$2`, [toppingIds, productId]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    } else {
      const product = memoryStore.products.find(item => item.id === productId && item.store_id === storeId);
      if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
      const validIds = new Set(memoryStore.product_options.filter(item => item.store_id === storeId).map(item => item.id));
      if (toppingIds.some(id => !validIds.has(id))) return res.status(400).json({ success: false, message: 'Có topping không thuộc cửa hàng đang chọn' });
      memoryStore.product_option_products = memoryStore.product_option_products.filter(link => link.product_id !== productId);
      toppingIds.forEach(option_id => memoryStore.product_option_products.push({ option_id, product_id: productId }));
    }
    res.json({ success: true, message: 'Đã cập nhật topping cho món' });
  } catch (error) {
    console.error('updateProductToppings error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi cập nhật topping cho món' });
  }
}

async function deleteProduct(req, res) {
  if (req.user?.role === 'STORE_MANAGER') {
    req.body = { ...(req.body || {}), is_active: false };
    return updateProduct(req, res);
  }
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query('DELETE FROM products WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    } else {
      const exists = memoryStore.products.some(item => item.id === id && item.store_id === storeId);
      if (!exists) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
      const variantIds = new Set(memoryStore.product_variants.filter(item => item.product_id === id).map(item => item.id));
      memoryStore.products = memoryStore.products.filter(item => item.id !== id);
      memoryStore.product_variants = memoryStore.product_variants.filter(item => item.product_id !== id);
      memoryStore.product_option_products = memoryStore.product_option_products.filter(link => link.product_id !== id);
      memoryStore.order_items.forEach(item => {
        if (item.product_id === id) item.product_id = null;
        if (variantIds.has(item.variant_id)) item.variant_id = null;
      });
    }
    res.json({ success: true, message: 'Đã xóa sản phẩm' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa sản phẩm' });
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOptions,
  getToppings,
  getToppingGroups,
  createToppingGroup,
  updateToppingGroup,
  deleteToppingGroup,
  createTopping,
  updateTopping,
  deleteTopping,
  updateProductToppings,
  getSizes,
  createSize,
  updateSize,
  deleteSize
};
