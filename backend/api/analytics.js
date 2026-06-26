const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, requireRole } = require('./auth');

// GET PERFORMANCE ANALYTICS METRICS (Sellers & Admins)
router.get('/dashboard', authenticateToken, requireRole(['seller', 'admin', 'super_admin']), async (req, res) => {
  try {
    const isSeller = req.user.role === 'seller';
    const storeId = req.user.id;

    // Load orders, order items, and products
    const orders = await db.select('orders');
    const orderItems = await db.select('order_items');
    const products = await db.select('products');

    let relevantItems = orderItems;
    let relevantOrders = orders;

    if (isSeller) {
      relevantItems = orderItems.filter(item => item.store_id === storeId);
      const orderIds = [...new Set(relevantItems.map(item => item.order_id))];
      relevantOrders = orders.filter(o => orderIds.includes(o.id));
    }

    // Calculations
    const totalOrdersCount = relevantOrders.length;
    
    // Revenue calculations (commission check if seller vs admin)
    let totalRevenue = 0;
    if (isSeller) {
      // 90% goes to seller
      totalRevenue = relevantItems.reduce((sum, item) => {
        if (item.status !== 'cancelled') {
          return sum + (item.price * item.quantity) * 0.9;
        }
        return sum;
      }, 0);
    } else {
      // Admin sees gross sales
      totalRevenue = orders.reduce((sum, o) => {
        if (o.status !== 'cancelled') return sum + o.total_amount;
        return sum;
      }, 0);
    }

    // Top Products ranking
    const productQuantities = {};
    relevantItems.forEach(item => {
      if (item.status !== 'cancelled') {
        productQuantities[item.product_id] = (productQuantities[item.product_id] || 0) + item.quantity;
      }
    });

    const topProducts = Object.entries(productQuantities)
      .map(([id, qty]) => {
        const p = products.find(prod => prod.id === id);
        return {
          id,
          title: p ? p.title : 'Deleted Product',
          price: p ? p.price : 0,
          quantity_sold: qty,
          revenue: qty * (p ? p.price : 0)
        };
      })
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, 5);

    // Dynamic Chart Data Simulation
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();

    const chartRevenueData = last7Days.map(() => Math.floor(Math.random() * (isSeller ? 1500 : 5000)) + 200);
    const chartOrdersData = last7Days.map(() => Math.floor(Math.random() * (isSeller ? 5 : 20)) + 1);

    // Summary stats payload
    res.json({
      revenue: parseFloat(totalRevenue.toFixed(2)),
      orders_count: totalOrdersCount,
      conversion_rate: 3.42, // Mock conversion percentage (visitors to purchase)
      visitors_count: isSeller ? 1420 : 8950,
      top_products: topProducts,
      chart: {
        labels: last7Days,
        revenue: chartRevenueData,
        orders: chartOrdersData
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Analytics compilation failed', details: err.message });
  }
});

// EXPORT BULK CSV UTILITY
router.get('/export/csv', authenticateToken, requireRole(['seller', 'admin']), async (req, res) => {
  const { type } = req.query; // 'products' or 'orders'
  
  try {
    let headers = '';
    let rows = [];

    if (type === 'products') {
      headers = 'ID,SKU,Title,Price,Stock,Status,Approved\n';
      const products = await db.select('products');
      const filtered = req.user.role === 'seller' 
        ? products.filter(p => p.store_id === req.user.id)
        : products;
      
      rows = filtered.map(p => 
        `"${p.id}","${p.sku}","${p.title.replace(/"/g, '""')}",${p.price},${p.stock},"${p.status}",${p.is_approved}`
      );
    } else if (type === 'orders') {
      headers = 'Order ID,Customer ID,Total Amount,Status,Payment,Created At\n';
      const orders = await db.select('orders');
      let filtered = orders;
      
      if (req.user.role === 'seller') {
        const sellerItems = await db.select('order_items', { store_id: req.user.id });
        const orderIds = [...new Set(sellerItems.map(i => i.order_id))];
        filtered = orders.filter(o => orderIds.includes(o.id));
      }
      
      rows = filtered.map(o => 
        `"${o.id}","${o.customer_id}",${o.total_amount},"${o.status}","${o.payment_status}","${o.created_at}"`
      );
    } else {
      return res.status(400).json({ error: 'Invalid CSV export type parameter' });
    }

    const csvContent = headers + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=export-${type}-${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'CSV file generation failed', details: err.message });
  }
});

module.exports = router;
