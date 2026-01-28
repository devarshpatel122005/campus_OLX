require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const multer = require('multer');

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Chat = require('./models/Chat');
const OTP = require('./models/OTP');
const Wishlist = require('./models/Wishlist');
const Notification = require('./models/Notification');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../frontend/public/uploads/'));
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

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-olx')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

const requireVerified = async (req, res, next) => {
    if (req.session.userId) {
        const user = await User.findById(req.session.userId);
        if (user && user.isVerified) {
            next();
        } else {
            res.redirect('/login?error=not_verified');
        }
    } else {
        res.redirect('/login');
    }
};

// ==================== ROUTES ====================

// Home Page
app.get('/', (req, res) => {
    res.render('index', { user: req.session.userId || null });
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error || null });
});

// Register Page
app.get('/register', (req, res) => {
    res.render('register', { error: req.query.error || null });
});

// Dashboard
app.get('/dashboard', requireVerified, async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, condition, sort } = req.query;

        // Build query
        let query = { status: 'available' };

        // Search by title or description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by category
        if (category && category !== 'all') {
            query.category = category;
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        // Filter by condition
        if (condition) {
            query.condition = parseInt(condition);
        }

        // Build sort option
        let sortOption = { createdAt: -1 }; // Default: newest first
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
});

// Post Ad Page
app.get('/post-ad', requireVerified, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('post-ad', { user });
});

// Product Detail Page
app.get('/product/:id', requireVerified, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('sellerId', 'email');
        const user = await User.findById(req.session.userId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Increment views if not the owner viewing
        if (product.sellerId._id.toString() !== req.session.userId.toString()) {
            await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
            product.views += 1;
        }

        res.render('product-detail', { product, user, currentUserId: req.session.userId });
    } catch (error) {
        console.error('Product detail error:', error);
        res.status(500).send('Error loading product');
    }
});

// Chat Page
app.get('/chat/:productId', requireVerified, async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId).populate('sellerId');
        const user = await User.findById(req.session.userId);

        let chat = await Chat.findOne({
            productId: req.params.productId,
            participants: req.session.userId
        }).populate('participants', 'email').populate('productId');

        if (!chat) {
            // Create new chat if it doesn't exist
            chat = new Chat({
                productId: req.params.productId,
                participants: [req.session.userId, product.sellerId],
                messages: []
            });
            await chat.save();
        }

        res.render('chat', { chat, product, user, currentUserId: req.session.userId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading chat');
    }
});

// User Profile Page
app.get('/profile', requireVerified, async (req, res) => {
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
        console.error('Profile error:', error);
        res.status(500).send('Error loading profile');
    }
});

// Edit Product Page
app.get('/edit-product/:id', requireVerified, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const user = await User.findById(req.session.userId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Check if user owns this product
        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).send('Unauthorized');
        }

        res.render('edit-product', { product, user });
    } catch (error) {
        console.error('Edit product error:', error);
        res.status(500).send('Error loading product');
    }
});

// Wishlist Page
app.get('/wishlist', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const wishlistItems = await Wishlist.find({ userId: req.session.userId })
            .populate({
                path: 'productId',
                populate: { path: 'sellerId', select: 'email' }
            })
            .sort({ addedAt: -1 });

        // Filter out any null products (deleted products)
        const products = wishlistItems
            .filter(item => item.productId)
            .map(item => item.productId);

        res.render('wishlist', { user, products });
    } catch (error) {
        console.error('Wishlist error:', error);
        res.status(500).send('Error loading wishlist');
    }
});

// Notifications Page
app.get('/notifications', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const notifications = await Notification.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.render('notifications', { user, notifications });
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).send('Error loading notifications');
    }
});

// ==================== API ROUTES ====================

// ==================== OTHER API ROUTES ====================

// Send OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email format
        if (!email || !/^[^\s@]+@gcet\.ac\.in$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Email must end with @gcet.ac.in' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTP for this email
        await OTP.deleteMany({ email });

        // Save OTP to database
        const otpDoc = new OTP({ email, otp });
        await otpDoc.save();

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'CampusOLX - Email Verification Code',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to CampusOLX!</h2>
          <p>Your verification code is:</p>
          <h1 style="background: #007bff; color: white; padding: 20px; text-align: center; letter-spacing: 5px;">
            ${otp}
          </h1>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Find OTP in database
        const otpDoc = await OTP.findOne({ email, otp });

        if (!otpDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // OTP is valid
        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, otp } = req.body;

        // Verify OTP first
        const otpDoc = await OTP.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            isVerified: true // Set to true since OTP is verified
        });

        await user.save();

        // Delete OTP after successful registration
        await OTP.deleteOne({ _id: otpDoc._id });

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if verified
        if (!user.isVerified) {
            return res.status(400).json({ success: false, message: 'Please verify your email first' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = user._id;

        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==================== NEW ENHANCED ROUTES ====================

// Categories Page
app.get('/categories', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        // Get product counts by category
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

        // Add counts to categories
        categories.forEach(cat => {
            const stat = categoryStats.find(s => s._id === cat.name);
            cat.count = stat ? stat.count : 0;
        });

        res.render('categories', { user, categories });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).send('Error loading categories');
    }
});

// My Products Page
app.get('/my-products', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const products = await Product.find({ sellerId: req.session.userId })
            .sort({ createdAt: -1 });

        const stats = {
            total: products.length,
            active: products.filter(p => p.status === 'available').length,
            sold: products.filter(p => p.status === 'sold').length,
            totalViews: products.reduce((sum, p) => sum + (p.views || 0), 0)
        };

        res.render('my-products', { user, products, stats });
    } catch (error) {
        console.error('My products error:', error);
        res.status(500).send('Error loading products');
    }
});

// How It Works Page
app.get('/how-it-works', (req, res) => {
    const user = req.session.userId || null;
    res.render('how-it-works', { user });
});

// Help Center Page
app.get('/help', (req, res) => {
    const user = req.session.userId || null;
    res.render('help', { user });
});

// Contact Page
app.get('/contact', (req, res) => {
    const user = req.session.userId || null;
    res.render('contact', { user });
});

// Safety Tips Page
app.get('/safety', (req, res) => {
    const user = req.session.userId || null;
    res.render('safety', { user });
});

// FAQ Page
app.get('/faq', (req, res) => {
    const user = req.session.userId || null;
    res.render('faq', { user });
});

// API: Get wishlist count
app.get('/api/wishlist/count', requireVerified, async (req, res) => {
    try {
        const count = await Wishlist.countDocuments({ userId: req.session.userId });
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get wishlist count' });
    }
});

// API: Toggle wishlist item
app.post('/api/wishlist/toggle', requireVerified, async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.userId;

        const existingItem = await Wishlist.findOne({ userId, productId });

        if (existingItem) {
            // Remove from wishlist
            await Wishlist.deleteOne({ userId, productId });
            res.json({ success: true, added: false, message: 'Removed from wishlist' });
        } else {
            // Add to wishlist
            const wishlistItem = new Wishlist({ userId, productId });
            await wishlistItem.save();
            res.json({ success: true, added: true, message: 'Added to wishlist' });
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({ success: false, message: 'Failed to update wishlist' });
    }
});

// ==================== SETTINGS API ENDPOINTS ====================

// Get AI Price Prediction
app.post('/api/get-price', async (req, res) => {
    try {
        const { original_price, age, condition, category } = req.body;

        // Call Python AI service
        const response = await axios.post(`${process.env.AI_SERVICE_URL}/predict`, {
            original_price: parseFloat(original_price),
            age: parseInt(age),
            condition: parseInt(condition),
            category: category
        });

        res.json({ success: true, predicted_price: response.data.predicted_price });
    } catch (error) {
        console.error('AI prediction error:', error);
        res.status(500).json({ success: false, message: 'Price prediction failed' });
    }
});

// Create Product
app.post('/api/products', requireVerified, upload.array('images', 5), async (req, res) => {
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
});

// Get User's Products
app.get('/api/my-products', requireVerified, async (req, res) => {
    try {
        const products = await Product.find({ sellerId: req.session.userId }).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});

// ==================== WISHLIST API ====================

// Add to Wishlist
app.post('/api/wishlist/:productId', requireVerified, async (req, res) => {
    try {
        const wishlistItem = new Wishlist({
            userId: req.session.userId,
            productId: req.params.productId
        });
        await wishlistItem.save();

        // Create notification for product owner
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
        console.error('Wishlist add error:', error);
        res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
    }
});

// Remove from Wishlist
app.delete('/api/wishlist/:productId', requireVerified, async (req, res) => {
    try {
        await Wishlist.deleteOne({
            userId: req.session.userId,
            productId: req.params.productId
        });
        res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        console.error('Wishlist remove error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
    }
});

// Get Wishlist Status
app.get('/api/wishlist/check/:productId', requireVerified, async (req, res) => {
    try {
        const exists = await Wishlist.exists({
            userId: req.session.userId,
            productId: req.params.productId
        });
        res.json({ success: true, isWishlisted: !!exists });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check wishlist' });
    }
});

// ==================== PRODUCT MANAGEMENT API ====================

// Update Product
app.put('/api/products/:id', requireVerified, upload.array('images', 5), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check ownership
        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { title, description, price, originalPrice, category, condition, ageMonths, ai_suggested_price, keepImages } = req.body;

        // Update fields
        product.title = title;
        product.description = description;
        product.price = price;
        product.originalPrice = originalPrice || price;
        product.ai_suggested_price = ai_suggested_price || null;
        product.category = category;
        product.condition = condition;
        product.ageMonths = ageMonths || 0;

        // Handle images
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
});

// Delete Product
app.delete('/api/products/:id', requireVerified, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check ownership
        if (product.sellerId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await Product.findByIdAndDelete(req.params.id);
        await Wishlist.deleteMany({ productId: req.params.id });

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Product delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
});

// Mark Product as Sold
app.patch('/api/products/:id/mark-sold', requireVerified, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check ownership
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
});

// Get Similar Products
app.get('/api/similar-products/:id', requireVerified, async (req, res) => {
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
});

// ==================== NOTIFICATIONS API ====================

// Get Unread Notifications Count
app.get('/api/notifications/unread-count', requireVerified, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.session.userId,
            read: false
        });
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get notification count' });
    }
});

// Mark Notification as Read
app.patch('/api/notifications/:id/read', requireVerified, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark as read' });
    }
});

// Mark All Notifications as Read
app.patch('/api/notifications/read-all', requireVerified, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.session.userId, read: false },
            { read: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark all as read' });
    }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join chat room
    socket.on('join-chat', async (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    // Send message
    socket.on('send-message', async (data) => {
        try {
            const { chatId, senderId, message } = data;

            const chat = await Chat.findById(chatId).populate('participants', 'email').populate('productId', 'title');
            if (!chat) return;

            chat.messages.push({ senderId, message });
            chat.lastMessage = new Date();
            await chat.save();

            // Find the recipient (the other participant who is not the sender)
            const recipient = chat.participants.find(p => p._id.toString() !== senderId);
            const sender = chat.participants.find(p => p._id.toString() === senderId);

            if (recipient && sender) {
                // Create notification for the recipient
                const notification = new Notification({
                    userId: recipient._id,
                    type: 'new_message',
                    title: 'New Message',
                    message: `${sender.email} sent you a message about "${chat.productId.title}"`,
                    link: `/chat/${chat.productId._id}`
                });
                await notification.save();
            }

            // Emit to all clients in the room
            io.to(chatId).emit('new-message', {
                senderId,
                message,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Message error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email service configured: ${process.env.EMAIL_USER || 'Not configured'}`);
    console.log(`🤖 AI service URL: ${process.env.AI_SERVICE_URL || 'http://localhost:5000'}`);
});
