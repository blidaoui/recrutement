const express = require('express');
const multer = require('../config/multer');
const { requireAuth } = require('../middleware/auth');
const {
  getUsersForMessaging,
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getUnreadCount,
} = require('../controllers/messages.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/users', getUsersForMessaging);
router.get('/unread-count', getUnreadCount);
router.get('/conversations', getConversations);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id', multer.single('file'), sendMessage);
router.patch('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);

module.exports = router;
