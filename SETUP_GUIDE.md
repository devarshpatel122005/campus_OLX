# CampusOLX Setup and Startup Guide

## Quick Start Instructions

Follow these steps to get CampusOLX running on your system.

---

## 1️⃣ Install MongoDB (if not already installed)

### Windows:
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will start automatically as a Windows Service

### Verify MongoDB is running:
```powershell
mongosh
```

If connected, you'll see the MongoDB shell. Type `exit` to quit.

---

## 2️⃣ Install Node.js Dependencies

Open PowerShell in the `campus-olx/backend` directory and run:

```powershell
cd backend
npm install
```

---

## 3️⃣ Configure Email Settings

Edit the `backend/.env` file and update these values:

```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-specific-password
```

### How to get Gmail App-Specific Password:
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to Security → 2-Step Verification → App passwords
4. Generate a new app password for "Mail"
5. Copy the 16-character password and paste it in `.env`

---

## 4️⃣ Set up Python AI Service

### Install Python dependencies:

```powershell
cd ai_service
pip install -r requirements.txt
```

### Train the AI model:

```powershell
python train_model.py
```

You should see output like:
```
🔄 Generating synthetic data...
✅ Generated 1000 samples
🤖 Training Random Forest model...
✅ Model trained successfully!
💾 Model saved to: model.pkl
```

---

## 5️⃣ Start the Application

You need to run **THREE** separate terminals:

### Terminal 1 - Start Flask AI Service:
```powershell
cd ai_service
python app.py
```

Should show: `🤖 CampusOLX AI Service` on `http://localhost:5000`

### Terminal 2 - Start Node.js Server:
```powershell
cd backend
npm start
```

Should show: `🚀 Server running on http://localhost:3000`

### Terminal 3 - (Optional) MongoDB Shell for monitoring:
```powershell
mongosh campus-olx
```

---

## 6️⃣ Access the Application

Open your browser and go to:
```
http://localhost:3000
```

---

## 📧 Testing Email OTP

For testing purposes, you can use a service like **Ethereal Email** (https://ethereal.email/) to capture test emails without using your real Gmail account.

---

## 🔧 Troubleshooting

### MongoDB not starting
- **Windows**: Check Services (Win+R → `services.msc`) and start "MongoDB Server"
- **Manual start**: Run `mongod` in a separate terminal

### AI Service not responding
- Make sure Python dependencies are installed: `pip install -r requirements.txt`
- Ensure model.pkl exists (run `train_model.py`)

### Email not sending
- Check `.env` EMAIL_USER and EMAIL_PASS are correct
- Verify Gmail App Password (not your regular password)
- Check if Less Secure Apps is allowed (for older Gmail accounts)

### Port already in use
- Change PORT in `.env` file
- Or kill the process using the port

---

## 🎯 Default Test Account

For testing, use any email ending with `@gcet.ac.in`:
- Example: `test@gcet.ac.in`
- Password: Your chosen password

---

## 📝 Next Steps

1. **Register** with a @gcet.ac.in email
2. **Verify** your email with the OTP
3. **Login** to access the dashboard
4. **Post** your first item using AI price suggestion
5. **Chat** with other users in real-time

---

## 🛑 Stopping the Application

Press `Ctrl+C` in each terminal to stop the services.

---

Enjoy using CampusOLX! 🚀
