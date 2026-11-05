const prisma = require('../config/db');

const CONV_INCLUDE = {
  candidat:  { select: { id: true, nom: true, email: true, photoProfil: true } },
  recruteur: { select: { id: true, nom: true, email: true, photoProfil: true } },
        messages:  { orderBy: { createdAt: 'desc' }, take: 1 },
};

async function getUsersForMessaging(req, res) {
  try {
    const { search } = req.query;
    const userId = req.user.id;
    const role = req.user.role;

    const allowedRoles = role === 'CANDIDAT'
      ? ['RECRUTEUR']
      : role === 'RECRUTEUR'
        ? ['CANDIDAT']
        : ['CANDIDAT', 'RECRUTEUR', 'ADMIN'];

    const where = {
      id: { not: userId },
      role: { in: allowedRoles },
      actif: true,
      ...(search ? {
        OR: [
          { nom: { contains: String(search), mode: 'insensitive' } },
          { email: { contains: String(search), mode: 'insensitive' } },
        ],
      } : {}),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        photoProfil: true,
      },
    });

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// GET /api/messages/conversations
async function getConversations(req, res) {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    const where = role === 'RECRUTEUR' || role === 'ADMIN'
      ? { recruteurId: userId }
      : { candidatId: userId };

    const convs = await prisma.conversation.findMany({
      where,
      include: {
        candidat:  { select: { id: true, nom: true, email: true, photoProfil: true } },
        recruteur: { select: { id: true, nom: true, email: true, photoProfil: true } },
        messages:  { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    // attach unread count
    const result = await Promise.all(convs.map(async (c) => {
      const unread = await prisma.message.count({
        where: { conversationId: c.id, lu: false, senderId: { not: userId } },
      });
      return { ...c, unread };
    }));

    res.json({ conversations: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// POST /api/messages/conversations  { recruteurId } (candidat initiates)
async function createOrGetConversation(req, res) {
  try {
    const candidatId  = req.user.role === 'CANDIDAT' ? req.user.id : req.body.candidatId;
    const recruteurId = req.user.role !== 'CANDIDAT' ? req.user.id : req.body.recruteurId;

    if (!candidatId || !recruteurId)
      return res.status(400).json({ message: 'candidatId et recruteurId requis' });

    let conv = await prisma.conversation.findUnique({
      where: { candidatId_recruteurId: { candidatId, recruteurId } },
    });

    if (!conv) {
      conv = await prisma.conversation.create({ data: { candidatId, recruteurId } });
    }

    res.json({ conversation: conv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// GET /api/messages/conversations/:id
async function getMessages(req, res) {
  try {
    const convId = Number(req.params.id);
    const userId = req.user.id;

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ message: 'Conversation introuvable' });
    if (conv.candidatId !== userId && conv.recruteurId !== userId)
      return res.status(403).json({ message: 'Accès refusé' });

    const messages = await prisma.message.findMany({
      where: { conversationId: convId },
      include: { sender: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // mark received messages as read
    await prisma.message.updateMany({
      where: { conversationId: convId, senderId: { not: userId }, lu: false },
      data: { lu: true },
    });

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// POST /api/messages/conversations/:id  { contenu }  or multipart file upload
async function sendMessage(req, res) {
  try {
    const convId = Number(req.params.id);
    const userId = req.user.id;
    const rawContenu = req.body?.contenu ?? '';
    const trimmed = typeof rawContenu === 'string' ? rawContenu.trim() : '';

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ message: 'Conversation introuvable' });
    if (conv.candidatId !== userId && conv.recruteurId !== userId)
      return res.status(403).json({ message: 'Accès refusé' });

    const hasAttachment = Boolean(req.file);
    const attachmentType = req.body?.attachmentType || (req.file ? (req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE') : 'TEXT');
    const attachmentUrl = req.file ? `/uploads/messages/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;
    const mimeType = req.file ? req.file.mimetype : null;

    if (!hasAttachment && !trimmed) {
      return res.status(400).json({ message: 'Message vide' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: userId,
        contenu: trimmed || (hasAttachment ? 'Pièce jointe' : ''),
        attachmentType: hasAttachment ? attachmentType : null,
        attachmentUrl,
        attachmentName,
        mimeType,
      },
      include: { sender: { select: { id: true, nom: true } } },
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// PATCH /api/messages/messages/:id — sender edits their own message text
async function editMessage(req, res) {
  try {
    const msgId = Number(req.params.id);
    const { contenu } = req.body;
    const trimmed = typeof contenu === 'string' ? contenu.trim() : '';

    if (!trimmed) return res.status(400).json({ message: 'Le message ne peut pas être vide' });

    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg) return res.status(404).json({ message: 'Message introuvable' });
    if (msg.senderId !== req.user.id) return res.status(403).json({ message: 'Accès refusé' });

    const updated = await prisma.message.update({
      where: { id: msgId },
      data: { contenu: trimmed, edited: true },
      include: { sender: { select: { id: true, nom: true } } },
    });

    res.json({ message: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// DELETE /api/messages/messages/:id — sender deletes their own message
async function deleteMessage(req, res) {
  try {
    const msgId = Number(req.params.id);

    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg) return res.status(404).json({ message: 'Message introuvable' });
    if (msg.senderId !== req.user.id) return res.status(403).json({ message: 'Accès refusé' });

    await prisma.message.delete({ where: { id: msgId } });

    res.json({ id: msgId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// GET /api/messages/unread-count
async function getUnreadCount(req, res) {
  try {
    const count = await prisma.message.count({
      where: { senderId: { not: req.user.id }, lu: false,
        conversation: req.user.role === 'CANDIDAT'
          ? { candidatId: req.user.id }
          : { recruteurId: req.user.id },
      },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = {
  getUsersForMessaging,
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getUnreadCount,
};