const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('./auth');
const { generateQRCode } = require('../utils/pdf');

// STRIPE PAYMENTS INTENT SIMULATOR
router.post('/stripe/create-intent', authenticateToken, (req, res) => {
  const { amount, currency } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required' });
  
  res.json({
    clientSecret: `pi_mock_${Math.random().toString(36).substr(2, 12)}_secret_${Math.random().toString(36).substr(2, 6)}`,
    amount,
    currency: currency || 'usd',
    status: 'requires_payment_method'
  });
});

// RAZORPAY ORDER GENERATOR SIMULATOR
router.post('/razorpay/create-order', authenticateToken, (req, res) => {
  const { amount, currency } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required' });

  res.json({
    id: `order_${Math.random().toString(36).substr(2, 14)}`,
    entity: 'order',
    amount: amount * 100, // Razorpay uses paisa/cents
    currency: currency || 'INR',
    receipt: `rcpt_${Math.random().toString(36).substr(2, 8)}`,
    status: 'created'
  });
});

// PAYPAL TRANSACTION SIMULATOR
router.post('/paypal/capture-order', authenticateToken, (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'PayPal Order ID is required' });

  res.json({
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [{
      payments: {
        captures: [{
          id: `cap_${Math.random().toString(36).substr(2, 10)}`,
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '12.00' }
        }]
      }
    }]
  });
});

// UPI DYNAMIC PAYOUT QR CODE GENERATOR
router.post('/upi/generate-qr', authenticateToken, async (req, res) => {
  const { amount, orderId } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required' });

  const upiId = 'merchant@marketplace';
  const name = 'Multi Vendor Marketplace';
  const transactionId = orderId || `TXN${Date.now()}`;
  
  // Format standard UPI payment string scheme
  const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&tr=${transactionId}&cu=INR`;
  const qrDataUrl = await generateQRCode(upiString);

  if (!qrDataUrl) {
    return res.status(500).json({ error: 'QR Code generation failed' });
  }

  res.json({
    upi_string: upiString,
    qr_code_url: qrDataUrl,
    merchant_name: name,
    upi_id: upiId
  });
});

// WALLET / REWARD POINTS PAYMENT PROCESSOR
router.post('/wallet/pay', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required' });

  try {
    const profile = await db.selectOne('profiles', { id: req.user.id });
    if (!profile) return res.status(404).json({ error: 'User profile not found' });

    // Assuming 1 point = $0.10 value. (e.g. $10 needs 100 reward points)
    const pointsNeeded = Math.ceil(amount * 10);
    if ((profile.reward_points || 0) < pointsNeeded) {
      return res.status(400).json({
        error: `Insufficient points. Needed: ${pointsNeeded} points ($${amount}), Current balance: ${profile.reward_points || 0} points`
      });
    }

    const updatedPoints = (profile.reward_points || 0) - pointsNeeded;
    await db.update('profiles', { id: req.user.id }, { reward_points: updatedPoints });

    res.json({
      success: true,
      deducted_points: pointsNeeded,
      remaining_points: updatedPoints,
      message: `Successfully paid $${amount.toFixed(2)} using wallet points.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Wallet transaction processing failed', details: err.message });
  }
});

module.exports = router;
