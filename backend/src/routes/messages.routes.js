const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getConversations, createOrGetConversation,
  getMessages, sendMessage, getUnreadCount,
} = require('../controllers/messages.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/unread-count', getUnreadCount);
router.get('/conversations', getConversations);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id', sendMessage);

module.exports = router;
