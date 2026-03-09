const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const auctionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    startingBid: {
        type: Number,
        required: true,
        min: 0
    },
    currentBid: {
        type: Number,
        default: function() {
            return this.startingBid;
        }
    },
    bidIncrement: {
        type: Number,
        default: 5,
        min: 1
    },
    bids: [bidSchema],
    highestBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        enum: ['📚 Books & Quantums', '📐 Engineering Tools', '📱 Mobiles & Gadgets', '💻 Laptops & Accessories', '🚲 Bicycles & Ride-ons', '🏠 Hostel & PG Essentials', '⚡ Electronics & Components', '❄️ Coolers & Fans', '🎒 Bags & Luggage', '🎸 Hobbies & Music', '🔨 Auction Items'],
        required: true
    },
    images: [{
        type: String
    }],
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number, // in hours
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'ended', 'cancelled'],
        default: 'active'
    },
    watchers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    views: {
        type: Number,
        default: 0
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    winningBid: {
        type: Number
    }
}, {
    timestamps: true
});

// Virtual for time remaining
auctionSchema.virtual('timeRemaining').get(function() {
    const now = new Date();
    const remaining = this.endTime - now;
    return Math.max(0, remaining);
});

// Virtual for bid count
auctionSchema.virtual('bidCount').get(function() {
    return this.bids.length;
});

// Method to check if auction is active
auctionSchema.methods.isActive = function() {
    return this.status === 'active' && new Date() < this.endTime;
};

// Method to place a bid
auctionSchema.methods.placeBid = function(userId, amount) {
    if (!this.isActive()) {
        throw new Error('Auction is not active');
    }
    
    if (amount <= this.currentBid) {
        throw new Error(`Bid must be higher than current bid of $${this.currentBid}`);
    }
    
    if (amount < this.currentBid + this.bidIncrement) {
        throw new Error(`Minimum bid increment is $${this.bidIncrement}`);
    }
    
    this.bids.push({ userId, amount });
    this.currentBid = amount;
    this.highestBidder = userId;
    
    return this.save();
};

// Index for better performance
auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ sellerId: 1, status: 1 });
auctionSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Auction', auctionSchema);