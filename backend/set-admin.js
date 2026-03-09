require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-olx')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

async function setAdmin() {
    try {
        const adminEmail = '12302040501009@gcet.ac.in';
        
        console.log('\n🔍 Looking for user with email:', adminEmail);
        
        // Find user by email
        const user = await User.findOne({ email: adminEmail });
        
        if (!user) {
            console.log('\n❌ User with email', adminEmail, 'not found.');
            console.log('\n📋 Options:');
            console.log('1. Register this user first at: http://localhost:3000/register');
            console.log('2. Or run: node create-admin.js (to create user automatically)');
            console.log('\n💡 Make sure the email is correct:', adminEmail, '\n');
            process.exit(1);
        }
        
        console.log('✅ User found!');
        console.log('📧 Email:', user.email);
        console.log('🆔 User ID:', user._id);
        console.log('👤 Name:', user.name || 'Not set');
        
        // Check if already admin
        if (user.isAdmin) {
            console.log('\n⚠️  User is already an admin!');
            console.log('👑 Admin:', user.isAdmin);
            console.log('✓ Verified:', user.isVerified);
            console.log('\n✅ No changes needed. You can login and access Admin Dashboard.\n');
            process.exit(0);
        }
        
        // Set as admin
        user.isAdmin = true;
        user.isVerified = true; // Also verify the admin user
        await user.save();
        
        console.log('\n✅ Successfully set', adminEmail, 'as admin!');
        console.log('👑 Admin:', user.isAdmin);
        console.log('✓ Verified:', user.isVerified);
        console.log('\n📋 Next Steps:');
        console.log('1. Login at: http://localhost:3000/login');
        console.log('2. Click Account → Admin Dashboard');
        console.log('3. Start approving products!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error setting admin:', error.message);
        console.error('\n💡 Make sure:');
        console.error('1. MongoDB is running');
        console.error('2. The email is correct');
        console.error('3. You have network connection\n');
        process.exit(1);
    }
}

setAdmin();
