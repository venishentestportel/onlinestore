const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, requireRole } = require('./auth');
const crypto = require('crypto');

// --- CATEGORIES ---
// GET /api/categories
router.get('/categories', async (req, res) => {
  try {
    const list = await db.select('categories');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
  }
});

// POST /api/categories (Admin only)
router.post('/categories', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { name, slug, parent_id } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    const newCat = {
      id: crypto.randomUUID(),
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      parent_id: parent_id || null
    };
    const inserted = await db.insert('categories', newCat);
    res.status(211).json(inserted);
  } catch (err) {
    console.error('Error creating category:', err);
    let errMsg = 'Failed to create category';
    if (err.code === '23505') {
      errMsg = 'Category already exists. Please choose a unique name or slug.';
    }
    res.status(500).json({ error: errMsg, details: err.message });
  }
});

// DELETE /api/categories/:id (Admin only)
router.delete('/categories/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    await db.delete('categories', { id: req.params.id });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
});

// --- BRANDS ---
// GET /api/brands
router.get('/brands', async (req, res) => {
  try {
    const list = await db.select('brands');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brands', details: err.message });
  }
});

// POST /api/brands (Admin only)
router.post('/brands', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { name, slug, logo_url } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    const newBrand = {
      id: crypto.randomUUID(),
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      logo_url: logo_url || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=100&h=100&q=80'
    };
    const inserted = await db.insert('brands', newBrand);
    res.status(211).json(inserted);
  } catch (err) {
    console.error('Error creating brand:', err);
    let errMsg = 'Failed to create brand';
    if (err.code === '23505') {
      errMsg = 'Brand already exists. Please choose a unique name or slug.';
    }
    res.status(500).json({ error: errMsg, details: err.message });
  }
});

// DELETE /api/brands/:id (Admin only)
router.delete('/brands/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    await db.delete('brands', { id: req.params.id });
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete brand', details: err.message });
  }
});

// --- COUPONS ---
// GET /api/coupons (Admin/Seller)
router.get('/coupons', authenticateToken, async (req, res) => {
  try {
    const list = await db.select('coupons');
    // Filter: Sellers can only see their own coupons or admin coupons (store_id === null)
    if (req.user.role === 'seller') {
      res.json(list.filter(c => c.store_id === null || c.store_id === req.user.id));
    } else {
      res.json(list);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupons', details: err.message });
  }
});

// POST /api/coupons (Admin/Seller)
router.post('/coupons', authenticateToken, requireRole(['admin', 'super_admin', 'seller']), async (req, res) => {
  try {
    const { code, type, value, min_order_amount, max_discount_amount, usage_limit, expiry_date } = req.body;
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: 'Code, type, and value are required' });
    }
    const storeId = req.user.role === 'seller' ? req.user.id : null;
    const newCoupon = {
      id: crypto.randomUUID(),
      code: code.toUpperCase().trim(),
      type,
      value: parseFloat(value),
      min_order_amount: parseFloat(min_order_amount) || 0.00,
      max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      usage_limit: usage_limit ? parseInt(usage_limit) : null,
      used_count: 0,
      expiry_date: expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      store_id: storeId
    };
    const inserted = await db.insert('coupons', newCoupon);
    res.status(211).json(inserted);
  } catch (err) {
    console.error('Error creating coupon:', err);
    let errMsg = 'Failed to create coupon';
    if (err.code === '23505') {
      errMsg = 'Coupon code already exists. Please choose a unique coupon code.';
    }
    res.status(500).json({ error: errMsg, details: err.message });
  }
});

// DELETE /api/coupons/:id (Admin/Seller)
router.delete('/coupons/:id', authenticateToken, requireRole(['admin', 'super_admin', 'seller']), async (req, res) => {
  try {
    const coupon = await db.selectOne('coupons', { id: req.params.id });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    
    if (req.user.role === 'seller' && coupon.store_id !== req.user.id) {
      return res.status(403).json({ error: 'Access Denied: Not your coupon' });
    }

    await db.delete('coupons', { id: req.params.id });
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete coupon', details: err.message });
  }
});

// --- ANNOUNCEMENTS ---
// GET /api/announcements
router.get('/announcements', async (req, res) => {
  try {
    const list = await db.select('announcements');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements', details: err.message });
  }
});

// POST /api/announcements (Admin only)
router.post('/announcements', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { text, is_active } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Announcement text is required' });
    }
    const newAnn = {
      id: crypto.randomUUID(),
      text,
      is_active: is_active !== undefined ? is_active : true
    };
    const inserted = await db.insert('announcements', newAnn);
    res.status(211).json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create announcement', details: err.message });
  }
});

// DELETE /api/announcements/:id (Admin only)
router.delete('/announcements/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    await db.delete('announcements', { id: req.params.id });
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement', details: err.message });
  }
});

// --- STORES ---
// GET /api/stores
router.get('/stores', async (req, res) => {
  try {
    const list = await db.select('stores');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stores', details: err.message });
  }
});

// PUT /api/stores/:id/approve (Admin only)
router.put('/stores/:id/approve', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const updated = await db.update('stores', { id: req.params.id }, { is_approved: true });
    res.json({ success: true, message: 'Store approved successfully', store: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve store', details: err.message });
  }
});

module.exports = router;

