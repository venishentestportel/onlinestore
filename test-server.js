// Backend Verification Script
// Tests fallback JSON database, product listings queries, and payment QR calculations

const assert = require('assert');
const db = require('./backend/utils/db');
const ai = require('./backend/utils/ai');
const pdf = require('./backend/utils/pdf');

async function runTests() {
  console.log('--- STARTING BACKEND UNIT TESTS ---');

  try {
    // Test 1: Local DB Fallback Load & Seed Check
    console.log('Testing Database fallback loader...');
    const profiles = await db.select('profiles');
    assert(profiles.length > 0, 'Seed profiles should exist');
    const admin = profiles.find(p => p.role === 'super_admin');
    assert.strictEqual(admin.email, 'admin@marketplace.com', 'Admin email should match seed');
    console.log('✓ Database seeded successfully.');

    // Test 2: AI Heuristics Description and SEO Tag checks
    console.log('Testing AI description generator heuristics...');
    const desc = ai.generateProductDescription('iPhone 15 Pro', 'Smartphones', [{ name: 'Color', values: ['Titanium'] }]);
    assert(desc.includes('iPhone 15 Pro'), 'Description should contain title');
    assert(desc.includes('Smartphones'), 'Description should contain category');
    assert(desc.includes('Color'), 'Description should contain attribute key');
    console.log('✓ AI content generators working.');

    // Test 3: QR Code Generator calculation
    console.log('Testing QR Code DataURI generation...');
    const qrDataUrl = await pdf.generateQRCode('upi://pay?pa=merchant@marketplace&am=100.00');
    assert(qrDataUrl.startsWith('data:image/png;base64,'), 'QR Code should be a PNG data URI');
    console.log('✓ QR code generator calculated.');

    // Test 4: PDF Invoice Receipt Creation
    console.log('Testing PDF Invoice compiler stream...');
    const mockOrder = {
      id: 'ord-test-verify',
      created_at: new Date().toISOString(),
      payment_method: 'stripe',
      payment_status: 'paid',
      subtotal: 100.00,
      tax_amount: 8.00,
      shipping_amount: 15.00,
      discount_amount: 0.00,
      total_amount: 123.00,
      shipping_address: {
        fullName: 'John Doe',
        addressLine: '120 Market St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94103'
      }
    };
    const mockItems = [
      { product_title: 'Test Gadget', sku: 'TST-GDG', price: 100.00, quantity: 1 }
    ];

    const pdfUrl = await pdf.generateInvoicePDF(mockOrder, mockItems);
    assert(pdfUrl.includes('invoice-ord-test-verify.pdf'), 'PDF invoice output URL incorrect');
    console.log('✓ PDF Invoice compiled successfully.');

    console.log('--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);

  } catch (err) {
    console.error('❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
