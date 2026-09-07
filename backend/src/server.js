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

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

// ── Socket.io — real-time messaging ──────────────────────────
// Authenticate socket via JWT cookie or auth header
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];

    if (!token) return next(new Error('Non authentifié'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Token invalide'));
  }
});

io.on('connection', (socket) => {
  // Join personal room to receive targeted messages
  socket.join(`user:${socket.userId}`);

  // Join a conversation room
  socket.on('join_conversation', (convId) => {
    socket.join(`conv:${convId}`);
  });

  socket.on('leave_conversation', (convId) => {
    socket.leave(`conv:${convId}`);
  });

  // Send a message in real time
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

      // Broadcast to everyone in the conversation room
      io.to(`conv:${conversationId}`).emit('new_message', message);

      // Notify the other user even if not in the room
      const otherId = conv.candidatId === socket.userId ? conv.recruteurId : conv.candidatId;
      io.to(`user:${otherId}`).emit('notification', { conversationId, from: message.sender.nom });
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  // Mark messages as read
  socket.on('mark_read', async ({ conversationId }) => {
    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: socket.userId }, lu: false },
      data: { lu: true },
    });
    io.to(`conv:${conversationId}`).emit('messages_read', { conversationId, byUserId: socket.userId });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
