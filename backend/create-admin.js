require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-olx')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

async function createAdmin() {
    try {
        const adminEmail = '12302040501009@gcet.ac.in';
        const adminPassword = 'admin123'; // Default password - CHANGE THIS!
        
        console.log('\n🔧 Creating/Updating Admin User...\n');
        
        // Check if user already exists
        let user = await User.findOne({ email: adminEmail });
        
        if (user) {
            console.log('📌 User already exists. Updating to admin...');
            
            // Update existing user to admin
            user.isAdmin = true;
            user.isVerified = true;
            await user.save();
            
            console.log('\n✅ Successfully updated existing user to admin!');
            console.log(`📧 Email: ${user.email}`);
            console.log(`🔑 User ID: ${user._id}`);
            console.log(`👑 Admin: ${user.isAdmin}`);
            console.log(`✓ Verified: ${user.isVerified}`);
            console.log('\n⚠️  Use your existing password to login.');
            
        } else {
            console.log('📌 User does not exist. Creating new admin user...');
            
            // Hash password
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            
            // Create new admin user
            user = new User({
                email: adminEmail,
                password: hashedPassword,
                isAdmin: true,
                isVerified: true,
                name: 'Admin',
                firstName: 'Admin',
                lastName: 'User'
            });
            
            await user.save();
            
            console.log('\n✅ Successfully created new admin user!');
            console.log(`📧 Email: ${user.email}`);
            console.log(`🔑 Password: ${adminPassword}`);
            console.log(`🆔 User ID: ${user._id}`);
            console.log(`👑 Admin: ${user.isAdmin}`);
            console.log(`✓ Verified: ${user.isVerified}`);
            console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
        }
        
        console.log('\n📋 Next Steps:');
        console.log('1. Login at: http://localhost:3000/login');
        console.log(`2. Email: ${adminEmail}`);
        console.log('3. Access Admin Dashboard from Account menu');
        console.log('4. Start approving products!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error creating admin:', error.message);
        
        if (error.code === 11000) {
            console.error('\n💡 Tip: User with this email already exists.');
            console.error('   Try running: node set-admin.js instead\n');
        }
        
        process.exit(1);
    }
}

createAdmin();
