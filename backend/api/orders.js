const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, requireRole } = require('./auth');
const { generateInvoicePDF } = require('../utils/pdf');
const crypto = require('crypto');

// GET ORDERS (For current logged-in user / role-specific)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      const allOrders = await db.select('orders');
      res.json(allOrders);
    } else if (req.user.role === 'seller') {
      // Find order items associated with this seller's store
      const sellerItems = await db.select('order_items', { store_id: req.user.id });
      const orderIds = [...new Set(sellerItems.map(item => item.order_id))];
      
      const allOrders = await db.select('orders');
      const filteredOrders = allOrders.filter(o => orderIds.includes(o.id));
      
      // Inject items specific to this seller
      const result = filteredOrders.map(order => {
        const items = sellerItems.filter(i => i.order_id === order.id);
        return { ...order, items };
      });
      res.json(result);
    } else {
      // Customer: select only their own orders
      const myOrders = await db.select('orders', { customer_id: req.user.id });
      // Map item details
      const allItems = await db.select('order_items');
      const result = myOrders.map(order => {
        const items = allItems.filter(i => i.order_id === order.id);
        return { ...order, items };
      });
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders', details: err.message });
  }
});

// GET ORDER DETAILS BY ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await db.selectOne('orders', { id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Auth validation
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && order.customer_id !== req.user.id) {
      // Check if seller owns items in this order
      const items = await db.select('order_items', { order_id: order.id, store_id: req.user.id });
      if (items.length === 0) {
        return res.status(403).json({ error: 'Access Denied' });
      }
    }

    const items = await db.select('order_items', { order_id: order.id });
    const tracking = await db.select('order_tracking', { order_id: order.id });

    // Join product titles if local mock mode
    const products = await db.select('products');
    const enrichedItems = items.map(item => {
      const p = products.find(prod => prod.id === item.product_id);
      return {
        ...item,
        product_title: p ? p.title : 'Product Item',
        sku: p ? p.sku : 'SKU'
      };
    });

    res.json({
      ...order,
      items: enrichedItems,
      tracking
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order information', details: err.message });
  }
});

// CREATE NEW ORDER (CHECKOUT)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, coupon_code, shipping_address, payment_method, payment_details, currency } = req.body;
    if (!items || items.length === 0 || !shipping_address || !payment_method) {
      return res.status(400).json({ error: 'Missing required checkout information' });
    }

    // Calculate totals
    let subtotal = 0;
    const dbItems = [];

    // Verify stock and price
    for (const item of items) {
      const prod = await db.selectOne('products', { id: item.product_id });
      if (!prod || prod.status !== 'active') {
        return res.status(404).json({ error: `Product ${item.product_title || 'item'} is no longer available` });
      }
      
      if (prod.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${prod.title}. Only ${prod.stock} left.` });
      }

      let price = prod.price;
      // Handle variant pricing if applicable
      if (item.variant_id) {
        const variant = await db.selectOne('product_variants', { id: item.variant_id });
        if (variant) price = variant.price;
      }

      subtotal += price * item.quantity;
      dbItems.push({
        product_id: prod.id,
        variant_id: item.variant_id || null,
        store_id: prod.store_id,
        quantity: item.quantity,
        price,
        product_title: prod.title,
        sku: prod.sku
      });
    }

    // Apply Coupon Logic
    let discount = 0;
    if (coupon_code) {
      const coupon = await db.selectOne('coupons', { code: coupon_code.toUpperCase() });
      if (coupon) {
        const now = new Date();
        const expiry = coupon.expiry_date ? new Date(coupon.expiry_date) : null;
        
        if ((!expiry || expiry > now) && subtotal >= coupon.min_order_amount) {
          if (coupon.type === 'percentage') {
            discount = subtotal * (coupon.value / 100);
            if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
              discount = coupon.max_discount_amount;
            }
          } else if (coupon.type === 'fixed_amount') {
            discount = coupon.value;
          }
          
          // Increment usage limit
          await db.update('coupons', { id: coupon.id }, { used_count: (coupon.used_count || 0) + 1 });
        }
      }
    }

    const shipping = subtotal > 150 ? 0 : 15; // Free shipping above $150
    const tax = subtotal * 0.08; // 8% sales tax
    const total = Math.max(0, subtotal + tax + shipping - discount);

    const orderId = crypto.randomUUID();
    const newOrder = {
      id: orderId,
      customer_id: req.user.id,
      status: 'pending',
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_amount: parseFloat(tax.toFixed(2)),
      shipping_amount: parseFloat(shipping.toFixed(2)),
      discount_amount: parseFloat(discount.toFixed(2)),
      total_amount: parseFloat(total.toFixed(2)),
      coupon_code: coupon_code || null,
      currency: currency || 'USD',
      shipping_address,
      payment_method,
      payment_status: payment_method === 'cod' ? 'pending' : 'paid',
      payment_details: payment_details || {}
    };

    // Save main order
    await db.insert('orders', newOrder);

    // Save order items & decrement catalog stock
    for (const dbItem of dbItems) {
      await db.insert('order_items', {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: dbItem.product_id,
        variant_id: dbItem.variant_id,
        store_id: dbItem.store_id,
        quantity: dbItem.quantity,
        price: dbItem.price,
        status: 'pending'
      });

      // Update variant or product stock
      if (dbItem.variant_id) {
        const v = await db.selectOne('product_variants', { id: dbItem.variant_id });
        if (v) await db.update('product_variants', { id: dbItem.variant_id }, { stock: Math.max(0, v.stock - dbItem.quantity) });
      }
      const p = await db.selectOne('products', { id: dbItem.product_id });
      if (p) await db.update('products', { id: dbItem.product_id }, { stock: Math.max(0, p.stock - dbItem.quantity) });
    }

    // Create Initial Tracking Entry
    await db.insert('order_tracking', {
      order_id: orderId,
      status: 'pending',
      details: 'Order submitted and awaiting seller processing.'
    });

    // Award loyalty reward points to Customer
    const pointEarnings = Math.floor(total * 0.1); // 10% cash back in points
    await db.update('profiles', { id: req.user.id }, {
      reward_points: (req.user.reward_points || 0) + pointEarnings
    });

    // Generate Invoice PDF asynchronously
    const invoiceUrl = await generateInvoicePDF(newOrder, dbItems);
    await db.update('orders', { id: orderId }, {
      payment_details: { ...newOrder.payment_details, invoice_pdf_url: invoiceUrl }
    });

    res.status(211).json({ success: true, orderId, invoiceUrl, total });
  } catch (err) {
    res.status(500).json({ error: 'Checkout failed', details: err.message });
  }
});

// UPDATE ORDER STATUS (For Sellers / Admins)
router.put('/:id/status', authenticateToken, requireRole(['seller', 'admin']), async (req, res) => {
  const { status, details } = req.body;
  const allowedStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid tracking status' });
  }

  try {
    const order = await db.selectOne('orders', { id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update main order status
    await db.update('orders', { id: req.params.id }, { status });

    // Update corresponding items if seller-specific
    if (req.user.role === 'seller') {
      await db.update('order_items', { order_id: req.params.id, store_id: req.user.id }, { status });
    } else {
      await db.update('order_items', { order_id: req.params.id }, { status });
    }

    // Insert tracking update
    await db.insert('order_tracking', {
      order_id: req.params.id,
      status: status,
      details: details || `Order status updated to: ${status}`
    });

    // Trigger vendor payouts if status is "delivered"
    if (status === 'delivered') {
      const items = await db.select('order_items', { order_id: req.params.id });
      for (const item of items) {
        // Compute earnings (e.g. 90% payout, 10% platform marketplace commission)
        const payoutAmount = (item.price * item.quantity) * 0.9;
        
        await db.insert('payouts', {
          store_id: item.store_id,
          amount: parseFloat(payoutAmount.toFixed(2)),
          status: 'pending',
          details: { reason: `Earnings for order item in ${order.id}` }
        });
      }
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order tracking', details: err.message });
  }
});

// GENERATE DYNAMIC DELIVERY ESTIMATES
router.get('/delivery/estimate', (req, res) => {
  const zip = req.query.zip;
  if (!zip) return res.status(400).json({ error: 'Zip code is required' });
  
  // Dynamic business logic simulation
  const days = zip.startsWith('9') ? 2 : zip.startsWith('1') ? 3 : 5;
  const estimateDate = new Date();
  estimateDate.setDate(estimateDate.getDate() + days);

  res.json({
    days,
    date: estimateDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    shipping_carrier: days <= 2 ? 'FedEx Priority' : 'USPS Ground'
  });
});

module.exports = router;
