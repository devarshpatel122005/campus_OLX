const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireVerified } = require('../middleware/auth');

router.get('/unread-count', requireVerified, notificationController.getUnreadCount);
router.patch('/:id/read', requireVerified, notificationController.markAsRead);
router.patch('/read-all', requireVerified, notificationController.markAllAsRead);

module.exports = router;
