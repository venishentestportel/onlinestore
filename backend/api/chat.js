const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

// GET CHAT THREADS LIST
router.get('/threads', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const messages = await db.select('chat_messages');
    
    // Find all unique correspondents
    const correspondents = new Set();
    messages.forEach(msg => {
      if (msg.sender_id === currentUserId) correspondents.add(msg.receiver_id);
      if (msg.receiver_id === currentUserId) correspondents.add(msg.sender_id);
    });

    const profiles = await db.select('profiles');
    const threads = [];

    for (const corrId of correspondents) {
      const profile = profiles.find(p => p.id === corrId);
      if (!profile) continue;

      // Get last message in the thread
      const threadMsgs = messages.filter(msg => 
        (msg.sender_id === currentUserId && msg.receiver_id === corrId) ||
        (msg.sender_id === corrId && msg.receiver_id === currentUserId)
      );
      threadMsgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMsg = threadMsgs[0];

      // Calculate unread count
      const unreadCount = threadMsgs.filter(msg => msg.receiver_id === currentUserId && !msg.is_read).length;

      threads.push({
        correspondent: {
          id: profile.id,
          name: profile.full_name,
          avatar: profile.avatar_url,
          role: profile.role
        },
        last_message: lastMsg ? lastMsg.message : '',
        last_message_time: lastMsg ? lastMsg.created_at : null,
        unread_count: unreadCount
      });
    }

    // Sort threads by latest message timestamp
    threads.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve threads', details: err.message });
  }
});

// GET CHAT HISTORY BETWEEN TWO USERS
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;
    
    const messages = await db.select('chat_messages');
    
    // Mark received messages as read
    const messagesToUpdate = messages.filter(msg => 
      msg.sender_id === targetUserId && msg.receiver_id === currentUserId && !msg.is_read
    );
    for (const msg of messagesToUpdate) {
      await db.update('chat_messages', { id: msg.id }, { is_read: true });
    }

    // Return conversation records
    const conversation = messages.filter(msg => 
      (msg.sender_id === currentUserId && msg.receiver_id === targetUserId) ||
      (msg.sender_id === targetUserId && msg.receiver_id === currentUserId)
    );
    
    // Sort in chronological order
    conversation.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chat history', details: err.message });
  }
});

// SEND MESSAGE
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, message, file_url, file_type } = req.body;
    if (!receiver_id || (!message && !file_url)) {
      return res.status(400).json({ error: 'Receiver ID and message content are required' });
    }

    const newMessage = {
      id: crypto.randomUUID(),
      sender_id: req.user.id,
      receiver_id,
      message: message || '',
      file_url: file_url || null,
      file_type: file_type || null,
      is_read: false
    };

    const inserted = await db.insert('chat_messages', newMessage);
    res.status(211).json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// MOCK TYPING INDICATOR METADATA TRIGGER
router.post('/typing', authenticateToken, (req, res) => {
  const { receiver_id, is_typing } = req.body;
  // Just simulate an echo webhook event
  res.json({ sender_id: req.user.id, receiver_id, is_typing: !!is_typing });
});

module.exports = router;
