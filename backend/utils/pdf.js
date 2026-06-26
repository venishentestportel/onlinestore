const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const invoiceDir = path.join(__dirname, '..', '..', 'public', 'invoices');
if (!fs.existsSync(invoiceDir)) {
  fs.mkdirSync(invoiceDir, { recursive: true });
}

// Generates a QR Code as a data URI
async function generateQRCode(text) {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error('Error generating QR Code:', err);
    return null;
  }
}

// Generates a PDF invoice file
async function generateInvoicePDF(order, items) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const invoiceFilename = `invoice-${order.id}.pdf`;
      const invoicePath = path.join(invoiceDir, invoiceFilename);
      const writeStream = fs.createWriteStream(invoicePath);

      doc.pipe(writeStream);

      // --- Header ---
      doc.fillColor('#1a1a1a')
         .fontSize(20)
         .text('MULTI-VENDOR MARKETPLACE', 50, 50, { align: 'left' });
      doc.fontSize(10)
         .text('Premium Commerce Ecosystem', 50, 75, { align: 'left' });

      doc.fontSize(20)
         .fillColor('#4f46e5')
         .text('INVOICE', 400, 50, { align: 'right' });
      
      doc.fontSize(9)
         .fillColor('#4b5563')
         .text(`Invoice No: INV-${order.id.substring(0, 8).toUpperCase()}`, 400, 75, { align: 'right' })
         .text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 400, 90, { align: 'right' })
         .text(`Payment: ${order.payment_method.toUpperCase()} (${order.payment_status.toUpperCase()})`, 400, 105, { align: 'right' });

      doc.moveDown(2);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 130).lineTo(550, 130).stroke();

      // --- Bill To & Details ---
      doc.fontSize(10).fillColor('#1f2937').text('BILL TO:', 50, 150, { underline: true });
      doc.fontSize(9).fillColor('#4b5563');
      
      const addr = order.shipping_address || {};
      doc.text(addr.fullName || 'Valued Customer', 50, 165)
         .text(addr.addressLine || 'Address details', 50, 177)
         .text(`${addr.city || ''}, ${addr.state || ''} ${addr.zipCode || ''}`, 50, 189)
         .text(`Phone: ${addr.phone || 'N/A'}`, 50, 201);

      // --- Items Table Header ---
      let y = 240;
      doc.fillColor('#f3f4f6').rect(50, y, 500, 20).fill();
      doc.fillColor('#374151').fontSize(9);
      doc.text('Item / SKU', 60, y + 6);
      doc.text('Price', 320, y + 6, { width: 60, align: 'right' });
      doc.text('Qty', 400, y + 6, { width: 40, align: 'center' });
      doc.text('Total', 470, y + 6, { width: 70, align: 'right' });

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, y + 20).lineTo(550, y + 20).stroke();
      y += 20;

      // --- Table Items ---
      doc.fillColor('#4b5563');
      for (const item of items) {
        doc.text(`${item.product_title || 'Product'} (${item.sku || 'SKU'})`, 60, y + 6, { width: 250, height: 12, ellipsis: true });
        doc.text(`$${Number(item.price).toFixed(2)}`, 320, y + 6, { width: 60, align: 'right' });
        doc.text(`${item.quantity}`, 400, y + 6, { width: 40, align: 'center' });
        doc.text(`$${(Number(item.price) * item.quantity).toFixed(2)}`, 470, y + 6, { width: 70, align: 'right' });
        
        doc.strokeColor('#f3f4f6').lineWidth(0.5).moveTo(50, y + 20).lineTo(550, y + 20).stroke();
        y += 20;
      }

      // --- Totals ---
      y += 10;
      doc.fontSize(9).fillColor('#374151');
      doc.text('Subtotal:', 380, y, { width: 80, align: 'right' });
      doc.text(`$${Number(order.subtotal).toFixed(2)}`, 470, y, { width: 70, align: 'right' });

      doc.text('Shipping:', 380, y + 15, { width: 80, align: 'right' });
      doc.text(`$${Number(order.shipping_amount).toFixed(2)}`, 470, y + 15, { width: 70, align: 'right' });

      doc.text('Tax:', 380, y + 30, { width: 80, align: 'right' });
      doc.text(`$${Number(order.tax_amount).toFixed(2)}`, 470, y + 30, { width: 70, align: 'right' });

      if (Number(order.discount_amount) > 0) {
        doc.text('Discount:', 380, y + 45, { width: 80, align: 'right' });
        doc.text(`-$${Number(order.discount_amount).toFixed(2)}`, 470, y + 45, { width: 70, align: 'right' });
        y += 15;
      }

      doc.fontSize(11).fillColor('#1f2937');
      doc.text('Total Amount:', 380, y + 50, { width: 80, align: 'right', bold: true });
      doc.text(`$${Number(order.total_amount).toFixed(2)}`, 470, y + 50, { width: 70, align: 'right', bold: true });

      // --- Embed QR Code for tracking ---
      const trackingUrl = `https://marketplace.com/orders/track?id=${order.id}`;
      const qrDataUri = await generateQRCode(trackingUrl);
      if (qrDataUri) {
        // Strip out the data:image/png;base64 header to write standard buffer
        const qrBuffer = Buffer.from(qrDataUri.replace(/^data:image\/png;base64,/, ''), 'base64');
        doc.image(qrBuffer, 50, y + 20, { width: 80, height: 80 });
        doc.fontSize(7).fillColor('#9ca3af').text('Scan to track order', 50, y + 105);
      }

      // --- Footer ---
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text('Thank you for shopping with us! For customer support, visit marketplace.com/support', 50, 700, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(`/invoices/${invoiceFilename}`);
      });
      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateQRCode,
  generateInvoicePDF
};
