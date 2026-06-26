const multer = require('multer');
const path = require('path');
const fs = require('fs');

const os = require('os');
const isServerless = process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV;
const uploadDir = isServerless ? os.tmpdir() : path.join(__dirname, '..', '..', 'public', 'uploads');
if (!isServerless && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File type validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|pdf|csv|mp4|webm/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only images, PDFs, CSVs, and videos are allowed!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

module.exports = {
  upload,
  getUploadUrl: (filename) => `/uploads/${filename}`
};
