require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Chat = require('./models/Chat');
const Notification = require('./models/Notification');

// Import routes
const viewRoutes = require('./routes/viewRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');

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

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-olx')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ==================== ROUTES ====================
app.use('/', viewRoutes);
app.use('/', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/get-price', aiRoutes);

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
