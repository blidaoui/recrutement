import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { cleanDb, createUser, authCookie } from './helpers.js';

const nodeRequire = createRequire(import.meta.url);
const { app } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

beforeEach(async () => {
  await cleanDb();
});
afterAll(() => prisma.$disconnect());

const as = (user) => ({ Cookie: authCookie(user) });

describe('Messaging REST API', () => {
  it('refuses access to anonymous users (401)', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  it('allows creating a conversation between a candidate and a recruiter', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');

    const res = await request(app)
      .post('/api/messages/conversations')
      .set(as(candidat))
      .send({ recruteurId: recruteur.id });

    expect(res.status).toBe(200);
    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.candidatId).toBe(candidat.id);
    expect(res.body.conversation.recruteurId).toBe(recruteur.id);
  });

  it('lets a user send a message in a conversation', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id }
    });

    const res = await request(app)
      .post(`/api/messages/conversations/${conv.id}`)
      .set(as(candidat))
      .send({ contenu: 'Hello recruiter!' });

    expect(res.status).toBe(201);
    expect(res.body.message.contenu).toBe('Hello recruiter!');
    expect(res.body.message.senderId).toBe(candidat.id);
  });

  it('prevents a third party from sending messages to a conversation (403)', async () => {
    const { user: c1 } = await createUser('CANDIDAT');
    const { user: r1 } = await createUser('RECRUTEUR');
    const { user: c2 } = await createUser('CANDIDAT');
    const conv = await prisma.conversation.create({
      data: { candidatId: c1.id, recruteurId: r1.id }
    });

    const res = await request(app)
      .post(`/api/messages/conversations/${conv.id}`)
      .set(as(c2))
      .send({ contenu: 'I am a hacker' });

    expect(res.status).toBe(403);
  });

  it('returns conversation messages and marks them as read', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id }
    });

    await prisma.message.create({
      data: { conversationId: conv.id, senderId: recruteur.id, contenu: 'Hello candidate!', lu: false }
    });

    const res = await request(app)
      .get(`/api/messages/conversations/${conv.id}`)
      .set(as(candidat));

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].contenu).toBe('Hello candidate!');

    // Check if it's marked as read
    const msg = await prisma.message.findFirst({ where: { conversationId: conv.id } });
    expect(msg.lu).toBe(true);
  });

  it('allows editing a message sent by the user', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id }
    });
    const msg = await prisma.message.create({
      data: { conversationId: conv.id, senderId: candidat.id, contenu: 'Original text' }
    });

    const res = await request(app)
      .patch(`/api/messages/messages/${msg.id}`)
      .set(as(candidat))
      .send({ contenu: 'Edited text' });

    expect(res.status).toBe(200);
    expect(res.body.message.contenu).toBe('Edited text');
    expect(res.body.message.edited).toBe(true);
  });

  it('prevents editing a message sent by someone else (403)', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const { user: recruteur } = await createUser('RECRUTEUR');
    const conv = await prisma.conversation.create({
      data: { candidatId: candidat.id, recruteurId: recruteur.id }
    });
    const msg = await prisma.message.create({
      data: { conversationId: conv.id, senderId: recruteur.id, contenu: 'Recruiter message' }
    });

    const res = await request(app)
      .patch(`/api/messages/messages/${msg.id}`)
      .set(as(candidat))
      .send({ contenu: 'Hacked!' });

    expect(res.status).toBe(403);
  });
});
