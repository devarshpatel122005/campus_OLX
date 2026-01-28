# CampusOLX - AI-Powered Campus Marketplace

A full-stack marketplace application built specifically for college students, featuring AI-powered price suggestions, real-time chat, and email verification.

## 🚀 Features

- **Email OTP Verification**: Secure registration with email verification (only @gcet.ac.in emails)
- **AI Price Prediction**: Machine learning-powered price suggestions using Random Forest
- **Real-time Chat**: Socket.io powered instant messaging between buyers and sellers
- **Image Upload**: Support for multiple product images
- **Responsive Design**: Modern dark UI with Bootstrap 5
- **Category System**: Organized product listings by category
- **Condition Rating**: 1-5 star rating system for product condition

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
- **Bootstrap 5** with dark theme
- **Socket.io Client** for real-time features
- **Vanilla JavaScript** for dynamic interactions

## 📁 Project Structure

```
campus-olx/
├── backend/
│   ├── server.js           # Main Node.js server
│   ├── models/
│   │   ├── User.js        # User schema (email, password, verification)
│   │   ├── Product.js     # Product schema
│   │   ├── Chat.js        # Chat schema
│   │   └── OTP.js         # OTP schema with TTL
│   ├── package.json       # Node dependencies
│   └── .env               # Environment variables
├── frontend/
│   ├── views/             # EJS templates
│   │   ├── layout.ejs     # Main layout template
│   │   ├── index.ejs      # Landing page
│   │   ├── login.ejs      # Login page
│   │   ├── register.ejs   # Registration with OTP
│   │   ├── dashboard.ejs  # Product listings
│   │   ├── post-ad.ejs    # Post product form
│   │   ├── product-detail.ejs # Product details
│   │   └── chat.ejs       # Real-time chat
│   └── public/
│       ├── css/
│       │   └── style.css  # Custom styles
│       └── uploads/       # Product images
├── ai_service/
│   ├── train_model.py     # ML model training script
│   ├── app.py             # Flask API server
│   └── requirements.txt   # Python dependencies
├── start.bat              # Windows startup script
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
Edit `backend/.env` file with your settings:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/campus-olx
SESSION_SECRET=your-secret-key
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-specific-password
AI_SERVICE_URL=http://localhost:5000
```

**Gmail Setup for Email OTP:**
1. Enable 2-Factor Authentication in your Google Account
2. Generate an App-Specific Password
3. Use that password in `EMAIL_PASS`

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
- `POST /api/get-price` - Get AI price prediction

### AI Service (Flask - Port 5000)
- `POST /predict` - Predict resale price
- `GET /categories` - Get valid categories
- `GET /` - Health check

## 🎨 UI Features

- Dark theme with gradient accents
- Glassmorphism effects
- Smooth animations and transitions
- Responsive grid layout
- Image carousels
- Real-time message updates
- Loading states for async operations

## 📝 License

This project is for educational purposes.

## 👨‍💻 Author

Built as a mini project demonstrating full-stack development with AI integration.
