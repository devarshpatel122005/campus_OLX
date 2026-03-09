# CampusOLX - AI-Powered Campus Marketplace 🎓

A modern, full-stack marketplace application built specifically for college students, featuring AI-powered price suggestions, real-time auctions, lost & found, and comprehensive admin controls.

## ✨ Features

### Core Features
- **Email OTP Verification**: Secure registration with email verification (only @gcet.ac.in emails)
- **AI Price Prediction**: Machine learning-powered price suggestions using Random Forest
- **Real-time Chat**: Socket.io powered instant messaging between buyers and sellers
- **Product Marketplace**: Buy and sell campus essentials with image uploads
- **Admin Verification System**: Products require admin approval before going live
- **Wishlist**: Save favorite items for later
- **Notifications**: Real-time notifications for bids, messages, and updates

### Advanced Features
- **Live Auctions**: Create and participate in real-time bidding with countdown timers
- **Lost & Found**: Report lost items or claim found items with image support
- **Progressive Web App (PWA)**: Install on mobile devices, works offline
- **Mobile-First Design**: Light glass theme optimized for mobile devices
- **Campus-Specific Categories**: 📚 Books, 📐 Engineering Tools, 📱 Gadgets, and more

### Admin Features
- **Product Approval System**: Review and approve/reject product listings
- **User Management**: View all registered users
- **Admin Dashboard**: Comprehensive overview of platform activity

## 🛠️ Tech Stack

### Backend
- **Node.js** + Express.js (Port 3000)
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **Nodemailer** for OTP email delivery
- **Multer** for file uploads
- **bcryptjs** for password hashing

### AI Microservice
- **Python** + Flask (Port 5000)
- **scikit-learn** Random Forest Regressor
- **pandas** + **numpy** for data processing
- **joblib** for model persistence

### Frontend
- **EJS** templating engine
- **Bootstrap 5** with light glass theme
- **Socket.io Client** for real-time features
- **Service Worker** for PWA functionality
- **Vanilla JavaScript** for dynamic interactions

## 📁 Project Structure

```
campus-olx/
├── backend/
│   ├── server.js              # Main Node.js server
│   ├── models/
│   │   ├── User.js           # User schema with admin role
│   │   ├── Product.js        # Product schema with status
│   │   ├── Auction.js        # Auction schema with bids
│   │   ├── LostFound.js      # Lost & Found schema
│   │   ├── Chat.js           # Chat schema
│   │   ├── Notification.js   # Notification schema
│   │   ├── Wishlist.js       # Wishlist schema
│   │   └── OTP.js            # OTP schema with TTL
│   ├── create-admin.js       # Admin creation utility
│   ├── set-admin.js          # Set user as admin
│   ├── package.json          # Node dependencies
│   ├── .env                  # Environment variables (not in git)
│   └── .env.example          # Environment template
├── frontend/
│   ├── views/                # EJS templates
│   │   ├── layout.ejs        # Main layout
│   │   ├── mobile-layout.ejs # Mobile PWA layout
│   │   ├── index.ejs         # Landing page
│   │   ├── login.ejs         # Login page
│   │   ├── register.ejs      # Registration with OTP
│   │   ├── dashboard.ejs     # Product listings
│   │   ├── admin-dashboard.ejs # Admin panel
│   │   ├── auctions.ejs      # Live auctions
│   │   ├── lost-found.ejs    # Lost & Found
│   │   ├── post-ad.ejs       # Post product form
│   │   ├── product-detail.ejs # Product details
│   │   ├── chat.ejs          # Real-time chat
│   │   ├── wishlist.ejs      # Saved items
│   │   └── notifications.ejs # Notifications
│   └── public/
│       ├── css/
│       │   ├── style.css     # Base styles
│       │   ├── mobile-light-glass.css # Mobile theme
│       │   └── enhancements.css # Additional styles
│       ├── manifest.json     # PWA manifest
│       ├── sw.js             # Service worker
│       └── uploads/          # Product images
├── ai_service/
│   ├── train_model.py        # ML model training script
│   ├── app.py                # Flask API server
│   ├── requirements.txt      # Python dependencies
│   ├── model.pkl             # Trained model (generated)
│   └── label_encoder.pkl     # Category encoder (generated)
├── start.bat                 # Windows startup script
├── README.md
└── SETUP_GUIDE.md
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Python (v3.8 or higher)
- MongoDB (running locally or MongoDB Atlas)

### Step 1: Install Node.js Dependencies
```bash
cd campus-olx/backend
npm install
```

### Step 2: Configure Environment Variables
Copy the example environment file and edit with your settings:
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` file:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/campus-olx
SESSION_SECRET=your-secret-key-change-this
EMAIL_USER=your-email@gcet.ac.in
EMAIL_PASS=your-app-specific-password
AI_SERVICE_URL=http://localhost:5000
```

**Gmail Setup for Email OTP:**
1. Enable 2-Factor Authentication in your Google Account
2. Go to Google Account → Security → App Passwords
3. Generate an App-Specific Password for "Mail"
4. Use that 16-character password in `EMAIL_PASS`

### Step 3: Set up Python AI Service
```bash
cd ai_service
pip install -r requirements.txt
python train_model.py
```

This will generate synthetic data and train the Random Forest model, saving `model.pkl`.

### Step 4: Start the Services

**Terminal 1 - Start MongoDB** (if running locally):
```bash
mongod
```

**Terminal 2 - Start Flask AI Service**:
```bash
cd ai_service
python app.py
```

**Terminal 3 - Start Node.js Server**:
```bash
cd backend
npm start
```

## 🌐 Usage

1. Open browser to `http://localhost:3000`
2. Register with a `@gcet.ac.in` email
3. Verify your email with the OTP sent to your inbox
4. Login and start browsing or posting items
5. Use the AI price suggestion when posting items
6. Chat with sellers in real-time
7. Participate in live auctions
8. Report lost items or claim found items

### Setting Up Admin Account
To create an admin account:
```bash
cd backend
node create-admin.js
# Or set existing user as admin:
node set-admin.js
```

Admin email: `12302040501009@gcet.ac.in` (default)

## 🤖 AI Price Prediction

The AI model uses the following formula for training data:
```
Resale Price = Original Price × (0.95 ^ Age in Months) × Condition Factor
```

Where:
- Condition Factor: 1=0.5, 2=0.65, 3=0.8, 4=0.9, 5=1.0
- Model: Random Forest Regressor with 100 estimators

## 📧 Email Verification Flow

1. User enters email ending with `@gcet.ac.in` and password
2. Clicks "Send Verification Code"
3. Receives 6-digit OTP via email
4. Enters OTP and clicks "Verify Code"
5. Registration button becomes enabled
6. Completes registration

OTPs automatically expire after 5 minutes using MongoDB TTL index.

## 🔒 Security Features

- Password hashing with bcryptjs
- Session-based authentication
- Email domain validation (@gcet.ac.in only)
- TTL-based OTP expiration
- File upload validation (type and size)

## 📱 API Endpoints

### Authentication
- `POST /api/send-otp` - Send OTP to email
- `POST /api/verify-otp` - Verify OTP code
- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `GET /logout` - Logout user

### Products
- `POST /api/products` - Create product listing
- `GET /api/my-products` - Get user's products
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/get-price` - Get AI price prediction

### Auctions
- `POST /api/auctions` - Create auction
- `GET /api/auctions` - Get active auctions
- `GET /api/auctions/:id` - Get auction details
- `POST /api/auctions/:id/bid` - Place bid
- `POST /api/auctions/:id/watch` - Watch/unwatch auction

### Lost & Found
- `POST /api/lost-found` - Report lost/found item
- `GET /api/lost-found` - Get all items
- `POST /api/lost-found/:id/claim` - Claim item

### Admin
- `GET /api/admin/products` - Get all products (pending/approved/rejected)
- `PUT /api/admin/products/:id/approve` - Approve product
- `PUT /api/admin/products/:id/reject` - Reject product
- `GET /api/admin/users` - Get all users

### Wishlist & Notifications
- `POST /api/wishlist/:productId` - Add to wishlist
- `DELETE /api/wishlist/:productId` - Remove from wishlist
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read

### AI Service (Flask - Port 5000)
- `POST /predict` - Predict resale price
- `GET /categories` - Get valid categories
- `GET /` - Health check

## 🎨 UI Features

- Light glass theme with gradient accents
- Mobile-first responsive design
- Glassmorphism effects with backdrop blur
- Smooth animations and transitions
- Progressive Web App (PWA) support
- Offline functionality
- Real-time auction countdown timers
- Image carousels for product galleries
- Real-time message updates
- Toast notifications
- Loading states for async operations
- Admin dashboard with approval workflow

## 🔐 Security Features

- Password hashing with bcryptjs
- Session-based authentication
- Email domain validation (@gcet.ac.in only)
- TTL-based OTP expiration (5 minutes)
- File upload validation (type and size)
- Admin role-based access control
- Product approval system
- Content Security Policy (CSP) compliant

## 📱 PWA Features

- Install on mobile devices
- Offline page caching
- App manifest with icons
- Service worker for offline support
- Mobile-optimized layouts
- Touch-friendly interface

## 🚀 Deployment

### Environment Variables for Production
Make sure to set these in your production environment:
- `MONGODB_URI` - Your MongoDB connection string
- `SESSION_SECRET` - Strong random secret
- `EMAIL_USER` - Your email for OTP
- `EMAIL_PASS` - App-specific password
- `AI_SERVICE_URL` - URL of your AI service

### Recommended Platforms
- **Backend**: Heroku, Railway, Render
- **Database**: MongoDB Atlas
- **AI Service**: PythonAnywhere, Heroku
- **Static Files**: Cloudinary, AWS S3

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📸 Screenshots

<!-- Add screenshots here -->
- Landing Page
- Product Listings
- Live Auctions
- Admin Dashboard
- Mobile PWA View
- Chat Interface

## 🙏 Acknowledgments

- Built as a college mini project
- AI model trained using scikit-learn
- UI inspired by modern glassmorphism design trends

## 📞 Support

For support, email your-email@gcet.ac.in or open an issue in the repository.

---

Made with ❤️ for campus students
