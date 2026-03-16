const express = require('express');
const router = express.Router();
const viewController = require('../controllers/viewController');
const { requireVerified } = require('../middleware/auth');

router.get('/', viewController.renderHome);
router.get('/login', viewController.renderLogin);
router.get('/register', viewController.renderRegister);
router.get('/dashboard', requireVerified, viewController.renderDashboard);
router.get('/post-ad', requireVerified, viewController.renderPostAd);
router.get('/product/:id', requireVerified, viewController.renderProductDetail);
router.get('/chat/:productId', requireVerified, viewController.renderChat);
router.get('/profile', requireVerified, viewController.renderProfile);
router.get('/edit-product/:id', requireVerified, viewController.renderEditProduct);
router.get('/wishlist', requireVerified, viewController.renderWishlist);
router.get('/notifications', requireVerified, viewController.renderNotifications);
router.get('/categories', requireVerified, viewController.renderCategories);
router.get('/my-products', requireVerified, viewController.renderMyProducts);

router.get('/how-it-works', viewController.renderStaticPage('how-it-works'));
router.get('/help', viewController.renderStaticPage('help'));
router.get('/contact', viewController.renderStaticPage('contact'));
router.get('/safety', viewController.renderStaticPage('safety'));
router.get('/faq', viewController.renderStaticPage('faq'));

module.exports = router;
