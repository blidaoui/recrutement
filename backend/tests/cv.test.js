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
      .attach('cv', Buffer.from('I am a React and Node.js developer. Email: test@example.com, Phone: 0123456789'), 'my-cv.txt');

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('CV analysé avec succès');
    expect(res.body.cv.skillsExtraites).toEqual(expect.arrayContaining(['React', 'Node.js']));
    // Use matchers that are less strict about exact strings if necessary,
    // but here we check if the extraction logic found them.
    expect(res.body.cv.emailExtrait).toBe('test@example.com');
    expect(res.body.cv.telephoneExtrait).toBe('0123456789');
  });

  it('updates the existing CV on second upload', async () => {
    const { user } = await createUser('CANDIDAT');

    // First upload
    await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', Buffer.from('Content 1'), 'cv1.txt');

    const firstCv = await prisma.cV.findFirst({ where: { candidatId: user.id } });

    // Second upload
    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', Buffer.from('Content 2'), 'cv2.txt');

    expect(res.status).toBe(201);
    const secondCv = await prisma.cV.findFirst({ where: { candidatId: user.id } });
    expect(secondCv.id).toBe(firstCv.id); // Should be the same record
    expect(secondCv.nomFichier).toBe('cv2.txt');
  });

  it('rejects oversized files (e.g., > 10MB)', async () => {
    const { user } = await createUser('CANDIDAT');
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

    const res = await request(app)
      .post('/api/cv/upload')
      .set(as(user))
      .attach('cv', largeBuffer, 'big.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/trop volumineux|limite/i);
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
