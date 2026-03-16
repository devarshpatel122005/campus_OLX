const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireVerified } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure Multer for file uploads (copied from server.js)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../frontend/public/uploads/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg').split(',');
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and JPG are allowed.'));
        }
    }
});

router.post('/', requireVerified, upload.array('images', 5), productController.createProduct);
router.put('/:id', requireVerified, upload.array('images', 5), productController.updateProduct);
router.delete('/:id', requireVerified, productController.deleteProduct);
router.patch('/:id/mark-sold', requireVerified, productController.markSold);
router.get('/similar/:id', requireVerified, productController.getSimilarProducts);
router.get('/my-products', requireVerified, productController.getMyProductsAPI);

module.exports = router;
