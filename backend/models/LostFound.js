const mongoose = require('mongoose');

const lostFoundSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['lost', 'found'],
        required: true
    },
    location: {
        type: String,
        required: true
    },
    contactInfo: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'expired'],
        default: 'active'
    },
    category: {
        type: String,
        enum: ['📱 Mobiles & Gadgets', '📚 Books & Quantums', '🎒 Bags & Luggage', '📐 Engineering Tools', 'Keys', 'ID Cards', 'Documents', '⚡ Electronics & Components', 'Other'],
        default: 'Other'
    },
    dateReported: {
        type: Date,
        default: Date.now
    },
    dateIncident: {
        type: Date,
        required: true
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolvedAt: {
        type: Date
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for better search performance
lostFoundSchema.index({ type: 1, status: 1, dateReported: -1 });
lostFoundSchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('LostFound', lostFoundSchema);