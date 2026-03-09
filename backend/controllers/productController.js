const Product = require('../models/Product');
const User = require('../models/User');

exports.createProduct = async (req, res) => {
    try {
        const { title, description, price, originalPrice, category, condition, ageMonths, ai_suggested_price } = req.body;
        const imagePaths = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];

        const product = new Product({
            title,
            description,
            price,
            originalPrice: originalPrice || price,
            ai_suggested_price: ai_suggested_price || null,
            category,
            condition,
            ageMonths: ageMonths || 0,
            images: imagePaths,
            sellerId: req.session.userId
        });

        await product.save();
        res.json({ success: true, message: 'Product posted successfully', productId: product._id });
    } catch (error) {
        console.error('Product creation error:', error);
        res.status(500).json({ success: false, message: 'Failed to post product' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { title, description, price, originalPrice, category, condition, ageMonths, ai_suggested_price, keepImages } = req.body;

        product.title = title;
        product.description = description;
        product.price = price;
        product.originalPrice = originalPrice || price;
        product.ai_suggested_price = ai_suggested_price || null;
        product.category = category;
        product.condition = condition;
        product.ageMonths = ageMonths || 0;

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => '/uploads/' + file.filename);
            const existingImages = keepImages ? JSON.parse(keepImages) : [];
            product.images = [...existingImages, ...newImages];
        }

        await product.save();
        res.json({ success: true, message: 'Product updated successfully', productId: product._id });
    } catch (error) {
        console.error('Product update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await Product.findByIdAndDelete(req.params.id);
        // Requirement: Delete from wishlist too (handled in original code)
        // We'll need to import Wishlist if we want to handle it here
        // but let's keep it simple for now or import it
        const Wishlist = require('../models/Wishlist');
        await Wishlist.deleteMany({ productId: req.params.id });

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Product delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
};

exports.markSold = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        product.status = 'sold';
        product.soldAt = new Date();
        await product.save();

        res.json({ success: true, message: 'Product marked as sold' });
    } catch (error) {
        console.error('Mark sold error:', error);
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
};

exports.getSimilarProducts = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.json({ success: true, products: [] });
        }

        const similarProducts = await Product.find({
            _id: { $ne: req.params.id },
            category: product.category,
            status: 'available'
        })
            .populate('sellerId', 'email')
            .sort({ createdAt: -1 })
            .limit(4);

        res.json({ success: true, products: similarProducts });
    } catch (error) {
        console.error('Similar products error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch similar products' });
    }
};

exports.getMyProductsAPI = async (req, res) => {
    try {
        const products = await Product.find({ sellerId: req.session.userId }).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
};
