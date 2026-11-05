import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { io as ClientIO } from 'socket.io-client';
import { cleanDb, createUser } from './helpers.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const nodeRequire = createRequire(import.meta.url);
const { server, io: ServerIO } = nodeRequire('../src/server.js');
const { app } = nodeRequire('../src/server.js');
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

describe('Socket.io Messaging Comprehensive', () => {
  let serverPort;
  let activeSockets = [];

  beforeAll(async () => {
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

  afterEach(async () => {
    for (const socket of activeSockets) {
      socket.disconnect();
    }
    activeSockets = [];
  });

  const track = (socket) => {
    activeSockets.push(socket);
    return socket;
  };

  it('refuses connection without valid JWT', async () => {
    const socket = new ClientIO(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid-token' },
      forceNew: true,
      reconnection: false,
    });

    const errorPromise = new Promise((resolve) => {
      socket.on('connect_error', (err) => resolve(err));
    });

    const err = await errorPromise;
    expect(err.message).toBe('Token invalide');
    socket.disconnect();
  });

  it('transmits message from A to B and keeps C isolated', async () => {
    const { user: userA } = await createUser('CANDIDAT');
    const { user: userB } = await createUser('RECRUTEUR');
    const { user: userC } = await createUser('CANDIDAT');

    const conv = await prisma.conversation.create({
      data: { candidatId: userA.id, recruteurId: userB.id },
    });

    const socketA = track(await createAuthenticatedSocket(userA, serverPort));
    const socketB = track(await createAuthenticatedSocket(userB, serverPort));
    const socketC = track(await createAuthenticatedSocket(userC, serverPort));

    socketB.emit('join_conversation', conv.id);

    const bReceived = new Promise((resolve) => {
      socketB.on('new_message', (msg) => resolve(msg));
    });

    let cReceived = false;
    socketC.on('new_message', () => { cReceived = true; });

    socketA.emit('send_message', {
      conversationId: conv.id,
      contenu: 'Hello B!',
    });

    const msg = await bReceived;
    expect(msg.contenu).toBe('Hello B!');
    expect(cReceived).toBe(false);
  });

  it('propagates message edits and deletions', async () => {
    const { user: userA } = await createUser('CANDIDAT');
    const { user: userB } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: userA.id, recruteurId: userB.id },
    });

    const socketA = track(await createAuthenticatedSocket(userA, serverPort));
    const socketB = track(await createAuthenticatedSocket(userB, serverPort));

    // Ensure both are connected before proceeding
    await Promise.all([
      new Promise(resolve => socketA.on('connect', resolve)),
      new Promise(resolve => socketB.on('connect', resolve))
    ]);

    socketB.emit('join_conversation', conv.id);

    // Small delay to ensure the join_conversation event is processed by the server
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test Edit
    const editPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message_edited')), 5000);
      socketB.on('message_edited', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    socketA.emit('edit_message', {
      conversationId: conv.id,
      id: 1,
      contenu: 'Edited content'
    });

    const edited = await editPromise;
    expect(edited.contenu).toBe('Edited content');

    // Test Delete
    const delPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message_deleted')), 5000);
      socketB.on('message_deleted', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    socketA.emit('delete_message', {
      conversationId: conv.id,
      id: 1
    });

    const deleted = await delPromise;
    expect(deleted.id).toBe(1);
  });

  it('triggers notification when recipient is not in conversation and clears on read', async () => {
    const { user: userA } = await createUser('CANDIDAT');
    const { user: userB } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: userA.id, recruteurId: userB.id },
    });

    const socketA = track(await createAuthenticatedSocket(userA, serverPort));
    const socketB = track(await createAuthenticatedSocket(userB, serverPort));

    // User B DOES NOT join the conversation room
    const notifyPromise = new Promise((resolve) => {
      socketB.on('notification', (data) => resolve(data));
    });

    socketA.emit('send_message', {
      conversationId: conv.id,
      contenu: 'You have a notification!',
    });

    const notification = await notifyPromise;
    expect(notification.conversationId).toBe(conv.id);

    // Mark as read
    const readPromise = new Promise((resolve) => {
      socketB.on('messages_read', (data) => resolve(data));
    });

    socketB.emit('mark_read', { conversationId: conv.id });
    const readData = await readPromise;
    expect(readData.conversationId).toBe(conv.id);
  });

  it('recovers missed messages via REST after reconnection', async () => {
    const { user: userA } = await createUser('CANDIDAT');
    const { user: userB } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: userA.id, recruteurId: userB.id },
    });

    const socketA = track(await createAuthenticatedSocket(userA, serverPort));

    // User A disconnects
    socketA.disconnect();

    // User B sends message while A is away
    const socketB = track(await createAuthenticatedSocket(userB, serverPort));
    socketB.emit('send_message', {
      conversationId: conv.id,
      contenu: 'Message while offline',
    });

    // Wait a bit for DB persistence
    await new Promise(r => setTimeout(r, 100));

    // User A reconnects and fetches messages via REST
    const res = await request(app)
      .get(`/api/messages/conversations/${conv.id}`)
      .set('Cookie', [`token=${jwt.sign({ id: userA.id, email: userA.email, role: userA.role }, secret)}`]);

    expect(res.status).toBe(200);
    expect(res.body.messages.some(m => m.contenu === 'Message while offline')).toBe(true);
  });
});
