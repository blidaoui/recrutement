require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./config/db');

const authRoutes         = require('./routes/auth.routes');
const cvRoutes           = require('./routes/cv.routes');
const offresRoutes       = require('./routes/offres.routes');
const candidaturesRoutes = require('./routes/candidatures.routes');
const statsRoutes        = require('./routes/stats.routes');
const adminRoutes        = require('./routes/admin.routes');
const messagesRoutes     = require('./routes/messages.routes');

const app    = express();
const server = http.createServer(app);

const profileRoutes = require('./routes/profile');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_fallback',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',         authRoutes);
app.use('/api/cv',           cvRoutes);
app.use('/api/offres',       offresRoutes);
app.use('/api/candidatures', candidaturesRoutes);
app.use('/api/stats',        statsRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/messages',     messagesRoutes);
app.use('/api/profile',      profileRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

// Socket.io middleware: authenticate via JWT from cookie or handshake auth
io.use((socket, next) => {
  try {
    let token = socket.handshake.auth?.token;
    const cookieHeader = socket.handshake.headers?.cookie;

    if (!token && cookieHeader) {
      const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
      if (match) token = match.split('=')[1];
    }

    if (!token) return next(new Error('Non authentifié'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change_this_secret_key_in_production');
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Token invalide'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their own room so they can receive targeted notifications
  socket.join(`user:${socket.userId}`);

  socket.on('join_conversation', (convId) => socket.join(`conv:${convId}`));
  socket.on('leave_conversation', (convId) => socket.leave(`conv:${convId}`));

  socket.on('send_message', async ({ conversationId, contenu }) => {
    try {
      if (!contenu?.trim()) return;

      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return;
      if (conv.candidatId !== socket.userId && conv.recruteurId !== socket.userId) return;

      const message = await prisma.message.create({
        data: { conversationId, senderId: socket.userId, contenu: contenu.trim() },
        include: { sender: { select: { id: true, nom: true } } },
      });

      io.to(`conv:${conversationId}`).emit('new_message', message);

      // Push a notification to the other party even if they are not in the conversation room
      const otherId = conv.candidatId === socket.userId ? conv.recruteurId : conv.candidatId;
      io.to(`user:${otherId}`).emit('notification', { conversationId, from: message.sender.nom });
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  socket.on('edit_message', ({ conversationId, id, contenu }) => {
    io.to(`conv:${conversationId}`).emit('message_edited', { id, contenu });
  });

  socket.on('delete_message', ({ conversationId, id }) => {
    io.to(`conv:${conversationId}`).emit('message_deleted', { id });
  });

  // Mark messages as read
  socket.on('mark_read', async ({ conversationId }) => {
    try {
      const convId = Number(conversationId);
      const conv = await prisma.conversation.findUnique({ where: { id: convId } });
      if (!conv || (conv.candidatId !== socket.userId && conv.recruteurId !== socket.userId)) return;

      await prisma.message.updateMany({
        where: { conversationId: convId, senderId: { not: socket.userId }, lu: false },
        data: { lu: true },
      });

      io.to(`user:${conv.candidatId}`)
        .to(`user:${conv.recruteurId}`)
        .emit('messages_read', { conversationId: convId, byUserId: socket.userId });
    } catch (err) {
      console.error('Socket mark_read error:', err);
    }
  });
});
const PORT = process.env.PORT || 5000;

// Only start listening when this file is run directly (npm run dev),
// not when the tests import it.
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
