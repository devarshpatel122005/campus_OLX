const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const User = require('../models/User');

exports.toggleWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.userId;

        const existingItem = await Wishlist.findOne({ userId, productId });

        if (existingItem) {
            await Wishlist.deleteOne({ userId, productId });
            res.json({ success: true, added: false, message: 'Removed from wishlist' });
        } else {
            const wishlistItem = new Wishlist({ userId, productId });
            await wishlistItem.save();
            res.json({ success: true, added: true, message: 'Added to wishlist' });
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({ success: false, message: 'Failed to update wishlist' });
    }
};

exports.getWishlistCount = async (req, res) => {
    try {
        const count = await Wishlist.countDocuments({ userId: req.session.userId });
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get wishlist count' });
    }
};

exports.checkWishlist = async (req, res) => {
    try {
        const exists = await Wishlist.exists({
            userId: req.session.userId,
            productId: req.params.productId
        });
        res.json({ success: true, isWishlisted: !!exists });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check wishlist' });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const wishlistItem = new Wishlist({
            userId: req.session.userId,
            productId: req.params.productId
        });
        await wishlistItem.save();

        const product = await Product.findById(req.params.productId);
        if (product && product.sellerId.toString() !== req.session.userId.toString()) {
            const user = await User.findById(req.session.userId);
            const notification = new Notification({
                userId: product.sellerId,
                type: 'wishlist',
                title: 'Someone wishlisted your product!',
                message: `${user.email.split('@')[0]} added your product to their wishlist`,
                link: `/product/${product._id}`
            });
            await notification.save();
        }

        res.json({ success: true, message: 'Added to wishlist' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Already in wishlist' });
        }
        res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        await Wishlist.deleteOne({
            userId: req.session.userId,
            productId: req.params.productId
        });
        res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
    }
};
