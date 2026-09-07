const prisma = require('../config/db');

const CONV_INCLUDE = {
  candidat:  { select: { id: true, nom: true, email: true } },
  recruteur: { select: { id: true, nom: true, email: true } },
        messages:  { orderBy: { createdAt: 'desc' }, take: 1 },
};

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
        candidat:  { select: { id: true, nom: true, email: true } },
        recruteur: { select: { id: true, nom: true, email: true } },
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

// POST /api/messages/conversations/:id  { contenu }
async function sendMessage(req, res) {
  try {
    const convId  = Number(req.params.id);
    const userId  = req.user.id;
    const { contenu } = req.body;

    if (!contenu?.trim()) return res.status(400).json({ message: 'Message vide' });

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ message: 'Conversation introuvable' });
    if (conv.candidatId !== userId && conv.recruteurId !== userId)
      return res.status(403).json({ message: 'Accès refusé' });

    const message = await prisma.message.create({
      data: { conversationId: convId, senderId: userId, contenu: contenu.trim() },
      include: { sender: { select: { id: true, nom: true } } },
    });

    res.status(201).json({ message });
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

module.exports = { getConversations, createOrGetConversation, getMessages, sendMessage, getUnreadCount };
