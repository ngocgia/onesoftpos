const { pool, isPostgresConnected, memoryStore } = require('../config/db');

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

async function getProducts(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;

  try {
    let products = [];
    let options = [];

    if (isPostgresConnected()) {
      let queryStr = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.store_id = $1 AND p.is_active = TRUE
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
      const optRes = await pool.query('SELECT * FROM product_options WHERE store_id = $1 AND is_active = TRUE ORDER BY id ASC', [storeId]);
      options = optRes.rows;
    } else {
      let filtered = memoryStore.products.filter(p => p.store_id === storeId && p.is_active);
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

module.exports = {
  getCategories,
  createCategory,
  getProducts,
  createProduct,
  getOptions
};
