import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

describe('CV Upload & Management', () => {
  it('refuses upload from a non-candidate (403)', async () => {
    const { user } = await createUser('RECRUTEUR');
    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', Buffer.from('fake pdf content'), 'test.pdf');
    expect(res.status).toBe(403);
  });

  it('refuses upload if no file is provided (400)', async () => {
    const { user } = await createUser('CANDIDAT');
    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Aucun fichier fourni');
  });

  it('successfully uploads a CV and extracts data (via test-mode fallback)', async () => {
    const { user } = await createUser('CANDIDAT');

    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', Buffer.from('some content'), 'my-cv.txt');

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('CV analysé avec succès');
    expect(res.body.cv.skillsExtraites).toEqual(['React', 'Node.js']);
    expect(res.body.cv.texteExtrait).toBe('I am a React and Node.js developer');
  });

  it('rejects invalid file types (e.g., .exe)', async () => {
    const { user } = await createUser('CANDIDAT');
    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', Buffer.from('malware'), 'virus.exe');

    expect(res.status).toBe(400);
  });

  it('allows updating contact details and validates email/phone', async () => {
    const { user } = await createUser('CANDIDAT');

    await prisma.cV.create({
      data: { candidatId: user.id, urlFichier: 'path/to/cv', nomFichier: 'cv.pdf' }
    });

    const resValid = await request(app)
      .put('/api/cv/contact')
      .set(as(user))
      .send({ emailExtrait: 'valid@email.com', telephoneExtrait: '123456789' });
    expect(resValid.status).toBe(200);

    const resEmail = await request(app)
      .put('/api/cv/contact')
      .set(as(user))
      .send({ emailExtrait: 'not-an-email' });
    expect(resEmail.status).toBe(400);

    const resPhone = await request(app)
      .put('/api/cv/contact')
      .set(as(user))
      .send({ telephoneExtrait: '123' });
    expect(resPhone.status).toBe(400);
  });

  it('handles CV download and 404 for missing files', async () => {
    const { user } = await createUser('CANDIDAT');
    const res404 = await request(app)
      .get('/api/cv/download/non-existent.pdf')
      .set(as(user));
    expect(res404.status).toBe(404);
  });
});
