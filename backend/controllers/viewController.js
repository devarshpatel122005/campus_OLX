const User = require('../models/User');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');

exports.renderHome = (req, res) => {
    res.render('index', { user: req.session.userId || null });
};

exports.renderLogin = (req, res) => {
    res.render('login', { error: req.query.error || null });
};

exports.renderRegister = (req, res) => {
    res.render('register', { error: req.query.error || null });
};

exports.renderDashboard = async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, condition, sort } = req.query;
        let query = { status: 'available' };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        if (condition) {
            query.condition = parseInt(condition);
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price-asc') {
            sortOption = { price: 1 };
        } else if (sort === 'price-desc') {
            sortOption = { price: -1 };
        }

        const products = await Product.find(query)
            .populate('sellerId', 'email')
            .sort(sortOption);

        const user = await User.findById(req.session.userId);
        res.render('dashboard', { products, user, filters: req.query });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
};

exports.renderPostAd = async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('post-ad', { user });
};

exports.renderProductDetail = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('sellerId', 'email');
        const user = await User.findById(req.session.userId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        if (product.sellerId._id.toString() !== req.session.userId.toString()) {
            await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
            product.views += 1;
        }

        res.render('product-detail', { product, user, currentUserId: req.session.userId });
    } catch (error) {
        res.status(500).send('Error loading product');
    }
};

exports.renderChat = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId).populate('sellerId');
        const user = await User.findById(req.session.userId);

        let chat = await Chat.findOne({
            productId: req.params.productId,
            participants: req.session.userId
        }).populate('participants', 'email').populate('productId');

        if (!chat) {
            chat = new Chat({
                productId: req.params.productId,
                participants: [req.session.userId, product.sellerId],
                messages: []
            });
            await chat.save();
        }

        res.render('chat', { chat, product, user, currentUserId: req.session.userId });
    } catch (error) {
        res.status(500).send('Error loading chat');
    }
};

exports.renderProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const activeProducts = await Product.find({
            sellerId: req.session.userId,
            status: 'available'
        }).sort({ createdAt: -1 });

        const soldProducts = await Product.find({
            sellerId: req.session.userId,
            status: 'sold'
        }).sort({ soldAt: -1 });

        res.render('profile', { user, activeProducts, soldProducts });
    } catch (error) {
        res.status(500).send('Error loading profile');
    }
};

exports.renderEditProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const user = await User.findById(req.session.userId);

        if (!product) return res.status(404).send('Product not found');
        if (product.sellerId.toString() !== req.session.userId.toString()) return res.status(403).send('Unauthorized');

        res.render('edit-product', { product, user });
    } catch (error) {
        res.status(500).send('Error loading product');
    }
};

exports.renderWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const wishlistItems = await Wishlist.find({ userId: req.session.userId })
            .populate({
                path: 'productId',
                populate: { path: 'sellerId', select: 'email' }
            })
            .sort({ addedAt: -1 });

        const products = wishlistItems
            .filter(item => item.productId)
            .map(item => item.productId);

        res.render('wishlist', { user, products });
    } catch (error) {
        res.status(500).send('Error loading wishlist');
    }
};

exports.renderNotifications = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const notifications = await Notification.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.render('notifications', { user, notifications });
    } catch (error) {
        res.status(500).send('Error loading notifications');
    }
};

exports.renderCategories = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const categoryStats = await Product.aggregate([
            { $match: { status: 'available' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const categories = [
            { name: 'Electronics', icon: 'bi-laptop', description: 'Laptops, phones, gadgets & accessories' },
            { name: 'Books', icon: 'bi-book', description: 'Textbooks, novels & study materials' },
            { name: 'Furniture', icon: 'bi-house', description: 'Chairs, tables, storage & decor' },
            { name: 'Clothing', icon: 'bi-bag', description: 'Fashion, shoes & accessories' },
            { name: 'Sports', icon: 'bi-trophy', description: 'Equipment, gear & fitness items' },
            { name: 'Vehicles', icon: 'bi-car-front', description: 'Bikes, scooters & car accessories' },
            { name: 'Other', icon: 'bi-grid', description: 'Everything else you need' }
        ];

        categories.forEach(cat => {
            const stat = categoryStats.find(s => s._id === cat.name);
            cat.count = stat ? stat.count : 0;
        });

        res.render('categories', { user, categories });
    } catch (error) {
        res.status(500).send('Error loading categories');
    }
};

exports.renderMyProducts = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const products = await Product.find({ sellerId: req.session.userId }).sort({ createdAt: -1 });

        const stats = {
            total: products.length,
            active: products.filter(p => p.status === 'available').length,
            sold: products.filter(p => p.status === 'sold').length,
            totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0)
        };

        res.render('my-products', { user, products, stats });
    } catch (error) {
        res.status(500).send('Error loading products');
    }
};

exports.renderStaticPage = (viewName) => (req, res) => {
    const user = req.session.userId || null;
    res.render(viewName, { user });
};
