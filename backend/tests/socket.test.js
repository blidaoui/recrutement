import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { cleanDb, createUser } from './helpers.js';
import jwt from 'jsonwebtoken';

const nodeRequire = createRequire(import.meta.url);
const { server, io: ServerIO } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

const secret = process.env.JWT_SECRET;

beforeEach(async () => {
  await cleanDb();
});

async function createAuthenticatedSocket(user, port) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret);
  const clientSocket = new ClientIO(`http://localhost:${port}`, {
    auth: { token },
    forceNew: true,
    reconnection: false,
  });
  return clientSocket;
}

describe('Socket.io Messaging', () => {
  let serverPort;

  beforeAll(async () => {
    // Use port 0 to let the OS assign any available free port
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  it('allows a user to send a message and notifies the recipient', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id },
    });

    const socketC = await createAuthenticatedSocket(candidat, serverPort);
    const socketR = await createAuthenticatedSocket(recruteur, serverPort);

    // Recruiter joins conversation
    socketR.emit('join_conversation', conv.id);

    const messagePromise = new Promise((resolve) => {
      socketR.on('new_message', (msg) => resolve(msg));
    });

    // Candidate sends message
    socketC.emit('send_message', {
      conversationId: conv.id,
      contenu: 'Hello from socket!',
    });

    const receivedMsg = await messagePromise;
    expect(receivedMsg.contenu).toBe('Hello from socket!');
    expect(receivedMsg.sender.id).toBe(candidat.id);

    socketC.disconnect();
    socketR.disconnect();
  });

  it('marks messages as read via socket', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id },
    });

    await prisma.message.create({
      data: { conversationId: conv.id, senderId: recruteur.id, contenu: 'Read me', lu: false },
    });

    const socketC = await createAuthenticatedSocket(candidat, serverPort);

    const readPromise = new Promise((resolve) => {
      socketC.on('messages_read', (data) => resolve(data));
    });

    socketC.emit('mark_read', { conversationId: conv.id });

    const readData = await readPromise;
    expect(readData.conversationId).toBe(conv.id);
    expect(readData.byUserId).toBe(candidat.id);

    const msg = await prisma.message.findFirst({ where: { conversationId: conv.id } });
    expect(msg.lu).toBe(true);

    socketC.disconnect();
  });
});
