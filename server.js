const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload & invoice directories exist
const publicUploads = path.join(__dirname, 'public', 'uploads');
const publicInvoices = path.join(__dirname, 'public', 'invoices');
if (!fs.existsSync(publicUploads)) fs.mkdirSync(publicUploads, { recursive: true });
if (!fs.existsSync(publicInvoices)) fs.mkdirSync(publicInvoices, { recursive: true });

// Static folders
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/customer', express.static(path.join(__dirname, 'customer')));
app.use('/seller', express.static(path.join(__dirname, 'seller')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(publicUploads));
app.use('/invoices', express.static(publicInvoices));

// Serve main static HTML pages explicitly to keep backend source files secure
const htmlPages = ['index.html', 'cart.html', 'checkout.html', 'login.html', 'product.html', 'search.html'];
htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, page));
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Import API Routers
const auth = require('./backend/api/auth');
const products = require('./backend/api/products');
const orders = require('./backend/api/orders');
const chat = require('./backend/api/chat');
const payments = require('./backend/api/payments');
const analytics = require('./backend/api/analytics');
const meta = require('./backend/api/meta');

// Mount API Endpoints
app.use('/api/auth', auth.router);
app.use('/api/products', products);
app.use('/api/orders', orders);
app.use('/api/chat', chat);
app.use('/api/payments', payments);
app.use('/api/analytics', analytics);
app.use('/api', meta);

// AI Description & SEO Tag API endpoints
const ai = require('./backend/utils/ai');
app.post('/api/ai/description', auth.authenticateToken, auth.requireRole(['seller', 'admin']), (req, res) => {
  const { title, category, attributes } = req.body;
  if (!title) return res.status(400).json({ error: 'Product title is required' });
  
  const description = ai.generateProductDescription(title, category, attributes);
  res.json({ description });
});

app.post('/api/ai/seo', auth.authenticateToken, auth.requireRole(['seller', 'admin']), (req, res) => {
  const { title, description, keywords } = req.body;
  if (!title) return res.status(400).json({ error: 'Product title is required' });

  const seo = ai.generateSeoTags(title, description, keywords);
  res.json(seo);
});

// CSV bulk upload helper endpoint
const storage = require('./backend/utils/storage');
const db = require('./backend/utils/db');
app.post('/api/products/bulk-csv', auth.authenticateToken, auth.requireRole(['seller', 'admin']), storage.upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file was uploaded' });

  try {
    const csvPath = req.file.path;
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
    
    if (lines.length <= 1) {
      return res.status(400).json({ error: 'CSV file is empty or missing headers' });
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const insertedProducts = [];
    const storeId = req.user.role === 'admin' ? req.body.store_id || req.user.id : req.user.id;

    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(',').map(cell => cell.replace(/"/g, '').trim());
      if (currentline.length < headers.length) continue;

      const rowData = {};
      headers.forEach((h, index) => {
        rowData[h] = currentline[index];
      });

      // Insert product simulation
      const newProd = {
        id: `prod-${Math.random().toString(36).substr(2, 9)}`,
        store_id: storeId,
        sku: rowData.SKU || `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        title: rowData.Title || 'CSV Product Item',
        price: parseFloat(rowData.Price) || 0.00,
        stock: parseInt(rowData.Stock) || 0,
        status: rowData.Status || 'draft',
        description: rowData.Description || 'Imported via CSV file.',
        low_stock_threshold: 5,
        is_approved: req.user.role === 'admin', // Auto-approved if admin
        images: ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80'],
        rating: 0,
        reviews_count: 0
      };

      const inserted = await db.insert('products', newProd);
      insertedProducts.push(inserted);
    }

    // Clean up temporary CSV file
    fs.unlinkSync(csvPath);

    res.json({
      success: true,
      count: insertedProducts.length,
      products: insertedProducts
    });
  } catch (err) {
    res.status(500).json({ error: 'Bulk CSV import failed', details: err.message });
  }
});

// Single File Image Upload Helper Endpoint
app.post('/api/upload', auth.authenticateToken, storage.upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    if (db.useSupabase && db.supabase) {
      const bucketName = req.body.bucket || req.query.bucket || 'products';
      const fileBuffer = fs.readFileSync(req.file.path);
      const uniqueName = `${Date.now()}-${req.file.filename}`;

      const { data, error } = await db.supabase.storage
        .from(bucketName)
        .upload(uniqueName, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase Storage upload error:', error.message);
        // Fall back to local file if Supabase upload fails
        const url = storage.getUploadUrl(req.file.filename);
        return res.json({ success: true, file_url: url, fallback: true, warning: error.message });
      }

      // Get public URL from Supabase Storage
      const { data: urlData } = db.supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueName);

      return res.json({ success: true, file_url: urlData.publicUrl });
    } else {
      const url = storage.getUploadUrl(req.file.filename);
      res.json({ success: true, file_url: url });
    }
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: 'File upload integration error', details: err.message });
  }
});

// Public Image Upload Endpoint (e.g. for registration logo)
app.post('/api/upload-public', storage.upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    if (db.useSupabase && db.supabase) {
      const bucketName = req.body.bucket || req.query.bucket || 'products';
      const fileBuffer = fs.readFileSync(req.file.path);
      const uniqueName = `${Date.now()}-${req.file.filename}`;

      const { data, error } = await db.supabase.storage
        .from(bucketName)
        .upload(uniqueName, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase Storage upload error:', error.message);
        const url = storage.getUploadUrl(req.file.filename);
        return res.json({ success: true, file_url: url, fallback: true, warning: error.message });
      }

      const { data: urlData } = db.supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueName);

      return res.json({ success: true, file_url: urlData.publicUrl });
    } else {
      const url = storage.getUploadUrl(req.file.filename);
      res.json({ success: true, file_url: url });
    }
  } catch (err) {
    console.error('Public upload handler error:', err);
    res.status(500).json({ error: 'File upload integration error', details: err.message });
  }
});



// Catch-all route to serve index.html for undefined frontend routes (SPA client-side navigation support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Standard Error Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
