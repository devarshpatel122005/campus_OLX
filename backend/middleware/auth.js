const User = require('../models/User');

const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

const requireVerified = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            if (user && user.isVerified) {
                next();
            } else {
                res.redirect('/login?error=not_verified');
            }
        } catch (error) {
            console.error('requireVerified error:', error);
            res.redirect('/login');
        }
    } else {
        res.redirect('/login');
    }
};

module.exports = {
    requireAuth,
    requireVerified
};
