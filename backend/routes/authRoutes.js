const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/api/send-otp', authController.sendOTP);
router.post('/api/verify-otp', authController.verifyOTP);
router.post('/api/register', authController.register);
router.post('/api/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;
