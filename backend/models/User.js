const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@gcet\.ac\.in$/.test(v);
      },
      message: 'Email must end with @gcet.ac.in'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    default: ''
  },
  // Profile Information
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  college: {
    type: String,
    default: ''
  },
  // Notification Settings
  notificationSettings: {
    emailMessages: { type: Boolean, default: true },
    emailWishlist: { type: Boolean, default: true },
    emailMarketing: { type: Boolean, default: false },
    pushMessages: { type: Boolean, default: true },
    pushOffers: { type: Boolean, default: true }
  },
  // Privacy Settings
  privacySettings: {
    profileVisibility: { type: String, default: 'public' },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false }
  },
  // App Preferences
  appPreferences: {
    language: { type: String, default: 'English' },
    currency: { type: String, default: '₹ Indian Rupee (INR)' },
    theme: { type: String, default: 'Dark Mode' },
    itemsPerPage: { type: Number, default: 24 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
