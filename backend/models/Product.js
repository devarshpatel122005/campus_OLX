const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    originalPrice: {
        type: Number,
        default: 0
    },
    ai_suggested_price: {
        type: Number,
        default: null
    },
    category: {
        type: String,
        required: true,
        enum: ['electronics', 'books', 'furniture', 'clothing', 'sports', 'other']
    },
    condition: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        default: 3
    },
    ageMonths: {
        type: Number,
        default: 0
    },
    images: [{
        type: String
    }],
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'sold', 'reserved'],
        default: 'available'
    },
    views: {
        type: Number,
        default: 0
    },
    soldAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
