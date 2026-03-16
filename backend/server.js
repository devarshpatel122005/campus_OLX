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
const LostFound = require('./models/LostFound');
const Auction = require('./models/Auction');

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

// Admin Middleware
const requireAdmin = async (req, res, next) => {
    if (req.session.userId) {
        const user = await User.findById(req.session.userId);
        if (user && user.isAdmin) {
            next();
        } else {
            res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
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

        // Build query - only show approved products
        let query = { status: 'approved' };

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
            { name: '📚 Books & Quantums', icon: 'bi-book', description: 'Textbooks, study guides & academic materials' },
            { name: '📐 Engineering Tools', icon: 'bi-tools', description: 'Drafters, scientific calculators, lab coats' },
            { name: '📱 Mobiles & Gadgets', icon: 'bi-phone', description: 'Smartphones, tablets & mobile accessories' },
            { name: '💻 Laptops & Accessories', icon: 'bi-laptop', description: 'Laptops, keyboards, mice & tech accessories' },
            { name: '🚲 Bicycles & Ride-ons', icon: 'bi-bicycle', description: 'Bikes, scooters, skateboards & accessories' },
            { name: '🏠 Hostel & PG Essentials', icon: 'bi-house', description: 'Mattresses, buckets, extension boards' },
            { name: '⚡ Electronics & Components', icon: 'bi-cpu', description: 'Arduino, sensors, Raspberry Pi for projects' },
            { name: '❄️ Coolers & Fans', icon: 'bi-fan', description: 'High demand cooling solutions for hostels' },
            { name: '🎒 Bags & Luggage', icon: 'bi-bag', description: 'Backpacks, travel bags & luggage' },
            { name: '🎸 Hobbies & Music', icon: 'bi-music-note', description: 'Musical instruments, art supplies & hobby items' },
            { name: '🕵️ Lost & Found', icon: 'bi-search-heart', description: 'Lost and found items on campus' },
            { name: '🔨 Auction Items', icon: 'bi-hammer', description: 'Bid on exclusive items and deals' }
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

// Lost & Found Page
app.get('/lost-found', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { type, search, category } = req.query;

        // Build query
        let query = { status: 'active' };
        if (type && ['lost', 'found'].includes(type)) {
            query.type = type;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        const lostFoundItems = await LostFound.find(query)
            .populate('userId', 'email')
            .sort({ dateReported: -1 })
            .limit(50);

        res.render('lost-found', { user, lostFoundItems, filters: req.query });
    } catch (error) {
        console.error('Lost & Found error:', error);
        res.status(500).send('Error loading Lost & Found');
    }
});

// Auctions Page
app.get('/auctions', requireVerified, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { filter, search, category } = req.query;

        // Build query
        let query = {};
        const now = new Date();

        if (filter === 'ending-soon') {
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
            query = {
                status: 'active',
                endTime: { $gte: now, $lte: oneHourFromNow }
            };
        } else if (filter === 'my-bids') {
            query = {
                status: 'active',
                'bids.userId': req.session.userId
            };
        } else {
            // Default: active auctions
            query = {
                status: 'active',
                endTime: { $gt: now }
            };
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        const auctions = await Auction.find(query)
            .populate('sellerId', 'email')
            .populate('highestBidder', 'email')
            .populate('watchers', '_id')
            .sort({ endTime: 1 })
            .limit(50);

        res.render('auctions', { user, auctions, filters: req.query });
    } catch (error) {
        console.error('Auctions error:', error);
        res.status(500).send('Error loading Auctions');
    }
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

// ==================== LOST & FOUND API ====================

// Create Lost/Found Item
app.post('/api/lost-found', requireVerified, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, type, location, contactInfo, category, dateIncident } = req.body;

        const imagePaths = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];

        const lostFoundItem = new LostFound({
            title,
            description,
            type,
            location,
            contactInfo,
            category: category || 'Other',
            dateIncident: dateIncident || new Date(),
            images: imagePaths,
            userId: req.session.userId
        });

        await lostFoundItem.save();

        // Create notification for relevant users (optional)
        const notificationTitle = type === 'lost' ? 'New Lost Item Reported' : 'New Found Item Reported';
        const notification = new Notification({
            userId: req.session.userId, // For now, notify the creator
            type: 'lost_found',
            title: notificationTitle,
            message: `${title} has been reported as ${type}`,
            link: `/lost-found`
        });
        await notification.save();

        res.json({ success: true, message: `${type} item reported successfully`, itemId: lostFoundItem._id });
    } catch (error) {
        console.error('Lost & Found creation error:', error);
        res.status(500).json({ success: false, message: 'Failed to report item' });
    }
});

// Get Lost & Found Items
app.get('/api/lost-found', requireVerified, async (req, res) => {
    try {
        const { type, search, category, limit = 20 } = req.query;
        
        let query = { status: 'active' };
        if (type) query.type = type;
        if (category && category !== 'all') query.category = category;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }

        const items = await LostFound.find(query)
            .populate('userId', 'email')
            .sort({ dateReported: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, items });
    } catch (error) {
        console.error('Get Lost & Found error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items' });
    }
});

// Mark Lost & Found Item as Resolved
app.patch('/api/lost-found/:id/resolve', requireVerified, async (req, res) => {
    try {
        const item = await LostFound.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.userId.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        item.status = 'resolved';
        item.resolved = true;
        item.resolvedAt = new Date();
        await item.save();

        res.json({ success: true, message: 'Item marked as resolved' });
    } catch (error) {
        console.error('Resolve item error:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve item' });
    }
});

// ==================== AUCTIONS API ====================

// Create Auction
app.post('/api/auctions', requireVerified, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, startingBid, duration, category, bidIncrement } = req.body;

        const imagePaths = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];
        
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + (parseInt(duration) * 60 * 60 * 1000));

        const auction = new Auction({
            title,
            description,
            startingBid: parseFloat(startingBid),
            bidIncrement: bidIncrement ? parseFloat(bidIncrement) : 5,
            duration: parseInt(duration),
            category,
            images: imagePaths,
            sellerId: req.session.userId,
            startTime,
            endTime
        });

        await auction.save();

        res.json({ success: true, message: 'Auction created successfully', auctionId: auction._id });
    } catch (error) {
        console.error('Auction creation error:', error);
        res.status(500).json({ success: false, message: 'Failed to create auction' });
    }
});

// Get Auctions
app.get('/api/auctions', requireVerified, async (req, res) => {
    try {
        const { filter, search, category, limit = 20 } = req.query;
        const now = new Date();
        
        let query = {};
        
        if (filter === 'ending-soon') {
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
            query = {
                status: 'active',
                endTime: { $gte: now, $lte: oneHourFromNow }
            };
        } else if (filter === 'my-bids') {
            query = {
                status: 'active',
                'bids.userId': req.session.userId
            };
        } else {
            query = {
                status: 'active',
                endTime: { $gt: now }
            };
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category && category !== 'all') {
            query.category = category;
        }

        const auctions = await Auction.find(query)
            .populate('sellerId', 'email')
            .populate('highestBidder', 'email')
            .sort({ endTime: 1 })
            .limit(parseInt(limit));

        res.json({ success: true, auctions });
    } catch (error) {
        console.error('Get auctions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch auctions' });
    }
});

// Place Bid
app.post('/api/auctions/:id/bid', requireVerified, async (req, res) => {
    try {
        const { amount } = req.body;
        const auction = await Auction.findById(req.params.id);

        if (!auction) {
            return res.status(404).json({ success: false, message: 'Auction not found' });
        }

        if (auction.sellerId.toString() === req.session.userId.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot bid on your own auction' });
        }

        if (!auction.isActive()) {
            return res.status(400).json({ success: false, message: 'Auction is not active' });
        }

        const bidAmount = parseFloat(amount);
        if (bidAmount <= auction.currentBid) {
            return res.status(400).json({ 
                success: false, 
                message: `Bid must be higher than current bid of $${auction.currentBid}` 
            });
        }

        if (bidAmount < auction.currentBid + auction.bidIncrement) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum bid increment is $${auction.bidIncrement}` 
            });
        }

        // Place the bid
        auction.bids.push({ userId: req.session.userId, amount: bidAmount });
        auction.currentBid = bidAmount;
        auction.highestBidder = req.session.userId;
        await auction.save();

        // Create notification for previous highest bidder
        if (auction.bids.length > 1) {
            const previousBid = auction.bids[auction.bids.length - 2];
            if (previousBid.userId.toString() !== req.session.userId.toString()) {
                const notification = new Notification({
                    userId: previousBid.userId,
                    type: 'auction_outbid',
                    title: 'You have been outbid!',
                    message: `Someone placed a higher bid on "${auction.title}"`,
                    link: `/auctions`
                });
                await notification.save();
            }
        }

        // Create notification for seller
        const user = await User.findById(req.session.userId);
        const sellerNotification = new Notification({
            userId: auction.sellerId,
            type: 'auction_bid',
            title: 'New bid on your auction!',
            message: `${user.email.split('@')[0]} placed a bid of $${bidAmount} on "${auction.title}"`,
            link: `/auctions`
        });
        await sellerNotification.save();

        res.json({ success: true, message: 'Bid placed successfully', currentBid: bidAmount });
    } catch (error) {
        console.error('Place bid error:', error);
        res.status(500).json({ success: false, message: 'Failed to place bid' });
    }
});

// Watch/Unwatch Auction
app.post('/api/auctions/:id/watch', requireVerified, async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id);
        
        if (!auction) {
            return res.status(404).json({ success: false, message: 'Auction not found' });
        }

        const userId = req.session.userId;
        const isWatching = auction.watchers.includes(userId);

        if (isWatching) {
            auction.watchers.pull(userId);
            await auction.save();
            res.json({ success: true, watching: false, message: 'Stopped watching auction' });
        } else {
            auction.watchers.push(userId);
            await auction.save();
            res.json({ success: true, watching: true, message: 'Now watching auction' });
        }
    } catch (error) {
        console.error('Watch auction error:', error);
        res.status(500).json({ success: false, message: 'Failed to update watch status' });
    }
});

// Get Auction Details
app.get('/api/auctions/:id', requireVerified, async (req, res) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate('sellerId', 'email')
            .populate('highestBidder', 'email')
            .populate('bids.userId', 'email');

        if (!auction) {
            return res.status(404).json({ success: false, message: 'Auction not found' });
        }

        // Increment views if not the owner viewing
        if (auction.sellerId._id.toString() !== req.session.userId.toString()) {
            auction.views += 1;
            await auction.save();
        }

        res.json({ success: true, auction });
    } catch (error) {
        console.error('Get auction details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch auction details' });
    }
});

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

// ==================== ADMIN API ====================

// Admin Dashboard Route
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('admin-dashboard', { user });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Server error');
    }
});

// Get Pending Products for Admin
app.get('/api/admin/products/pending', requireAdmin, async (req, res) => {
    try {
        const products = await Product.find({ status: 'pending' })
            .populate('sellerId', 'email name firstName lastName')
            .sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        console.error('Fetch pending products error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending products' });
    }
});

// Get All Products for Admin (with filters)
app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        
        const products = await Product.find(filter)
            .populate('sellerId', 'email name firstName lastName')
            .populate('verifiedBy', 'email name')
            .sort({ createdAt: -1 });
        
        res.json({ success: true, products });
    } catch (error) {
        console.error('Fetch products error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});

// Approve Product
app.post('/api/admin/products/:productId/approve', requireAdmin, async (req, res) => {
    try {
        const { productId } = req.params;
        const { note } = req.body;

        console.log('Approving product:', productId, 'by user:', req.session.userId);

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                status: 'approved',
                verificationNote: note || '',
                verifiedBy: req.session.userId,
                verifiedAt: new Date()
            },
            { new: true }
        ).populate('sellerId', 'email name');

        if (!product) {
            console.log('Product not found:', productId);
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        console.log('Product approved successfully:', product.title);

        // Send notification to seller
        try {
            const notification = new Notification({
                userId: product.sellerId._id,
                type: 'product_approved',
                title: '✅ Product Approved!',
                message: `Your product "${product.title}" has been approved and is now live on the marketplace.`,
                link: `/product/${product._id}`
            });
            await notification.save();
        } catch (notifError) {
            console.error('Notification error (non-critical):', notifError);
        }

        res.json({ success: true, message: 'Product approved successfully', product });
    } catch (error) {
        console.error('Approve product error:', error);
        res.status(500).json({ success: false, message: 'Failed to approve product: ' + error.message });
    }
});

// Reject Product
app.post('/api/admin/products/:productId/reject', requireAdmin, async (req, res) => {
    try {
        const { productId } = req.params;
        const { note } = req.body;

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                status: 'rejected',
                verificationNote: note || 'Product does not meet our guidelines',
                verifiedBy: req.session.userId,
                verifiedAt: new Date()
            },
            { new: true }
        ).populate('sellerId', 'email name');

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Send notification to seller
        const notification = new Notification({
            userId: product.sellerId._id,
            type: 'product_rejected',
            title: '❌ Product Rejected',
            message: `Your product "${product.title}" was rejected. Reason: ${note || 'Does not meet guidelines'}`,
            link: `/my-products`
        });
        await notification.save();

        res.json({ success: true, message: 'Product rejected', product });
    } catch (error) {
        console.error('Reject product error:', error);
        res.status(500).json({ success: false, message: 'Failed to reject product' });
    }
});

// Get Admin Stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const pendingProducts = await Product.countDocuments({ status: 'pending' });
        const approvedProducts = await Product.countDocuments({ status: 'approved' });
        const rejectedProducts = await Product.countDocuments({ status: 'rejected' });
        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ isVerified: true });

        res.json({
            success: true,
            stats: {
                totalProducts,
                pendingProducts,
                approvedProducts,
                rejectedProducts,
                totalUsers,
                verifiedUsers
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
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
