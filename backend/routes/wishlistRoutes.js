const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { requireVerified } = require('../middleware/auth');

router.get('/count', requireVerified, wishlistController.getWishlistCount);
router.post('/toggle', requireVerified, wishlistController.toggleWishlist);
router.get('/check/:productId', requireVerified, wishlistController.checkWishlist);
router.post('/:productId', requireVerified, wishlistController.addToWishlist);
router.delete('/:productId', requireVerified, wishlistController.removeFromWishlist);

module.exports = router;
