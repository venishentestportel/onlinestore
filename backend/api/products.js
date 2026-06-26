const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, requireRole } = require('./auth');
const crypto = require('crypto');

// GET PRODUCTS LIST WITH FILTERING & LIVE SEARCH
router.get('/', async (req, res) => {
  try {
    const { 
      search, category, brand, rating, min_price, max_price, 
      color, size, sort, discount, availability, store_id, limit
    } = req.query;

    let products = await db.select('products');

    // Filter by store
    if (store_id) {
      products = products.filter(p => p.store_id === store_id);
    } else {
      // For general buyer requests, only show active & approved products
      const approvedOnly = req.query.approved_only !== 'false';
      if (approvedOnly) {
        products = products.filter(p => p.status === 'active' && p.is_approved === true);
      }
    }

    // Filter by search query (live search)
    if (search) {
      const q = search.toLowerCase().trim();
      products = products.filter(p => 
        p.title.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q) ||
        (p.seo_keywords && p.seo_keywords.toLowerCase().includes(q))
      );
    }

    // Filter by Category
    if (category) {
      // Find subcategories if parents
      const cats = await db.select('categories');
      const targetCat = cats.find(c => c.slug === category || c.id === category);
      if (targetCat) {
        const matchingCatIds = [targetCat.id, ...cats.filter(c => c.parent_id === targetCat.id).map(c => c.id)];
        products = products.filter(p => matchingCatIds.includes(p.category_id));
      }
    }

    // Filter by Brand
    if (brand) {
      const brandsList = await db.select('brands');
      const targetBrand = brandsList.find(b => b.slug === brand || b.id === brand);
      if (targetBrand) {
        products = products.filter(p => p.brand_id === targetBrand.id);
      }
    }

    // Filter by Price range
    if (min_price) {
      products = products.filter(p => p.price >= parseFloat(min_price));
    }
    if (max_price) {
      products = products.filter(p => p.price <= parseFloat(max_price));
    }

    // Filter by Rating
    if (rating) {
      products = products.filter(p => p.rating >= parseFloat(rating));
    }

    // Filter by Discount (compare_at_price > price)
    if (discount === 'true') {
      products = products.filter(p => p.compare_at_price && p.compare_at_price > p.price);
    }

    // Filter by Availability (Stock > 0)
    if (availability === 'in_stock') {
      products = products.filter(p => p.stock > 0);
    } else if (availability === 'out_of_stock') {
      products = products.filter(p => p.stock === 0);
    }

    // Filter by Attributes (Color, Size) in variant options
    if (color || size) {
      const variants = await db.select('product_variants');
      products = products.filter(p => {
        const prodVariants = variants.filter(v => v.product_id === p.id);
        if (prodVariants.length === 0) {
          // Check product-level fallback attributes
          if (color) {
            const hasColor = p.attributes && p.attributes.some(a => a.name === 'Color' && a.values.includes(color));
            if (!hasColor) return false;
          }
          if (size) {
            const hasSize = p.attributes && p.attributes.some(a => a.name === 'Size' && a.values.includes(size));
            if (!hasSize) return false;
          }
          return true;
        }
        // Match actual variants attributes
        return prodVariants.some(v => {
          let match = true;
          if (color && v.attributes.Color !== color) match = false;
          if (size && v.attributes.Size !== size) match = false;
          return match;
        });
      });
    }

    // Sorting Logic
    if (sort === 'price-asc') {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      products.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'newest') {
      products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (limit) {
      products = products.slice(0, parseInt(limit));
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// GET LIVE SEARCH SUGGESTIONS
router.get('/suggestions', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);
  
  try {
    const products = await db.select('products', { status: 'active', is_approved: true });
    const q = query.toLowerCase().trim();
    const matches = products
      .filter(p => p.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ id: p.id, title: p.title, price: p.price, image: p.images[0] }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Suggestions lookup failed' });
  }
});

// GET PRODUCT DETAILS BY ID
router.get('/:id', async (req, res) => {
  try {
    const product = await db.selectOne('products', { id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Retrieve associated content
    const variants = await db.select('product_variants', { product_id: product.id });
    const reviews = await db.select('reviews', { product_id: product.id });
    const store = await db.selectOne('stores', { id: product.store_id });
    const brand = product.brand_id ? await db.selectOne('brands', { id: product.brand_id }) : null;

    res.json({
      ...product,
      variants,
      reviews,
      store,
      brand
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve product info', details: err.message });
  }
});

// ADD NEW PRODUCT (Seller / Admin)
router.post('/', authenticateToken, requireRole(['seller', 'admin']), async (req, res) => {
  try {
    const { 
      title, description, price, compare_at_price, currency, category_id, brand_id, 
      sku, stock, attributes, specifications, images, seo_title, seo_description, seo_keywords 
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Title and price are required' });
    }

    const storeId = req.user.role === 'admin' ? req.body.store_id : req.user.id;
    if (!storeId) return res.status(400).json({ error: 'A valid store ID is required' });

    const finalSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newProduct = {
      id: crypto.randomUUID(),
      store_id: storeId,
      category_id: category_id || null,
      brand_id: brand_id || null,
      title,
      description: description || '',
      price: parseFloat(price),
      compare_at_price: compare_at_price ? parseFloat(compare_at_price) : null,
      currency: currency || 'USD',
      sku: finalSku,
      barcode: req.body.barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      stock: parseInt(stock) || 0,
      low_stock_threshold: parseInt(req.body.low_stock_threshold) || 5,
      is_approved: true, // Auto-approved on creation
      status: 'active', // Auto-activate if admin adds it, otherwise status can default
      attributes: attributes || [],
      specifications: specifications || {},
      seo_title: seo_title || title,
      seo_description: seo_description || description?.substring(0, 150),
      seo_keywords: seo_keywords || '',
      images: images || ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80'],
      rating: 0,
      reviews_count: 0
    };

    const inserted = await db.insert('products', newProduct);
    res.status(211).json(inserted);
  } catch (err) {
    console.error('Error creating product:', err);
    let errMsg = 'Failed to create product';
    if (err.code === '23505') {
      errMsg = 'Product SKU already exists. Please choose a unique SKU.';
    }
    res.status(500).json({ error: errMsg, details: err.message });
  }
});

// UPDATE PRODUCT details
router.put('/:id', authenticateToken, requireRole(['seller', 'admin']), async (req, res) => {
  try {
    const product = await db.selectOne('products', { id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // RLS: Seller can only edit their own products
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && product.store_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this product' });
    }

    const updates = {};
    const allowedUpdates = [
      'title', 'description', 'price', 'compare_at_price', 'currency', 'category_id', 'brand_id',
      'stock', 'low_stock_threshold', 'status', 'attributes', 'specifications',
      'seo_title', 'seo_description', 'seo_keywords', 'images', 'is_approved'
    ];

    allowedUpdates.forEach(key => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    const updated = await db.update('products', { id: req.params.id }, updates);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    let errMsg = 'Failed to update product';
    if (err.code === '23505') {
      errMsg = 'Product SKU already exists. Please choose a unique SKU.';
    }
    res.status(500).json({ error: errMsg, details: err.message });
  }
});

// DELETE PRODUCT
router.delete('/:id', authenticateToken, requireRole(['seller', 'admin']), async (req, res) => {
  try {
    const product = await db.selectOne('products', { id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && product.store_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this product' });
    }

    await db.delete('products', { id: req.params.id });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
});

// POST PRODUCT REVIEW
router.post('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { rating, comment, images } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }

    const productId = req.params.id;
    const existing = await db.selectOne('reviews', { product_id: productId, customer_id: req.user.id });
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Verify purchase badge logic (mock verification: check if customer has ordered this product)
    const orders = await db.select('orders', { customer_id: req.user.id });
    let isVerified = false;
    for (const o of orders) {
      const items = await db.select('order_items', { order_id: o.id, product_id: productId });
      if (items.length > 0) {
        isVerified = true;
        break;
      }
    }

    const review = {
      id: crypto.randomUUID(),
      product_id: productId,
      customer_id: req.user.id,
      rating: parseInt(rating),
      comment: comment || '',
      images: images || [],
      is_verified: isVerified,
      helpful_count: 0
    };

    const inserted = await db.insert('reviews', review);
    
    // Trigger calculation updates
    const allReviews = await db.select('reviews', { product_id: productId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await db.update('products', { id: productId }, {
      rating: parseFloat(avgRating.toFixed(2)),
      reviews_count: allReviews.length
    });

    res.status(211).json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post review', details: err.message });
  }
});

// UPVOTE REVIEW HELPFULNESS
router.post('/reviews/:reviewId/helpful', authenticateToken, async (req, res) => {
  try {
    const review = await db.selectOne('reviews', { id: req.params.reviewId });
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const updated = await db.update('reviews', { id: req.params.reviewId }, {
      helpful_count: review.helpful_count + 1
    });
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Action failed', details: err.message });
  }
});

module.exports = router;
