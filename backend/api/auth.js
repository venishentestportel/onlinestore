const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'multi_vendor_jwt_secret_token_123!@#';

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, async (err, jwtPayload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    
    try {
      const profile = await db.selectOne('profiles', { id: jwtPayload.id });
      if (!profile) return res.status(404).json({ error: 'User profile not found' });
      
      req.user = profile;
      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Database verification error', details: dbErr.message });
    }
  });
}

// Middleware to enforce role access controls
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  };
}

// REGISTER ENDPOINT
router.post('/register', async (req, res) => {
  const { email, password, full_name, role, store_name, logo_url } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  const userRole = role || 'customer';
  if (!['customer', 'seller', 'admin'].includes(userRole)) {
    return res.status(400).json({ error: 'Invalid user role selection' });
  }

  try {
    const existing = await db.selectOne('profiles', { email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = crypto.randomUUID();
    const newProfile = {
      id: userId,
      email: email.toLowerCase(),
      full_name,
      avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(full_name)}`,
      role: userRole,
      reward_points: userRole === 'customer' ? 100 : 0, // 100 welcome reward points
      referral_code: `REF-${userId.substring(0, 8).toUpperCase()}`,
      referred_by: null
    };

    // Insert user profile
    await db.insert('profiles', newProfile);

    // If role is seller, insert their store profile
    if (userRole === 'seller') {
      const storeName = store_name || `${full_name}'s Store`;
      await db.insert('stores', {
        id: userId,
        name: storeName,
        description: `Welcome to ${storeName}! Check out our amazing range of products.`,
        logo_url: logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80',
        banner_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=400&q=80',
        rating: 5.0,
        followers_count: 0,
        policies: { shipping: 'Standard shipping details.', returns: 'Returns policy for store products.' },
        social_links: {},
        is_approved: true // Auto-approved on registration
      });
    }

    const token = jwt.sign({ id: userId, email: newProfile.email, role: newProfile.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(211).json({ token, user: newProfile });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// LOGIN ENDPOINT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.selectOne('profiles', { email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // In local dev mode we accept password matches. (Simulating verification)
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// OTP SEND SIMULATOR
router.post('/otp-send', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate a random 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[OTP Engine] Sent OTP code "${code}" to ${email}`);
  
  // Return code in JSON response so frontend can instantly fill it (for testing convenience)
  res.json({ message: 'OTP sent to email', code });
});

// OTP VERIFY SIMULATOR
router.post('/otp-verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and verification code are required' });

  try {
    let user = await db.selectOne('profiles', { email: email.toLowerCase() });
    if (!user) {
      // Auto-register guest OTP log
      const userId = crypto.randomUUID();
      user = {
        id: userId,
        email: email.toLowerCase(),
        full_name: email.split('@')[0],
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(email)}`,
        role: 'customer',
        reward_points: 50,
        referral_code: `REF-${userId.substring(0, 8).toUpperCase()}`
      };
      await db.insert('profiles', user);
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification failed', details: err.message });
  }
});

// PASSWORD RESET REQUEST
router.post('/reset-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  res.json({ message: `Password reset instructions sent to ${email}. Check your inbox/spam folder.` });
});

// GET ME DETAILS
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = {
  router,
  authenticateToken,
  requireRole
};
