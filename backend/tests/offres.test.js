import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { cleanDb, createUser, authCookie, createOffre } from './helpers.js';

const nodeRequire = createRequire(import.meta.url);
const { app } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', ''); // never call the real Gemini API in tests
  await cleanDb();
});
afterAll(() => prisma.$disconnect());

const as = (user) => ({ Cookie: authCookie(user) });

describe('POST /api/offres', () => {
  it('lets a recruiter create an offer owned by them', async () => {
    const { user } = await createUser('RECRUTEUR');
    const res = await request(app)
      .post('/api/offres')
      .set(as(user))
      .send({ titre: 'Dev React', description: 'Offre de test', skillsObligatoires: ['React', 'Node'] });

    expect(res.status).toBe(201);
    expect(res.body.offre.recruteurId).toBe(user.id);
    expect(res.body.offre.skillsRequises).toEqual(expect.arrayContaining(['React', 'Node']));
  });

  it('accepts skills as a comma-separated string', async () => {
    const { user } = await createUser('RECRUTEUR');
    const res = await request(app)
      .post('/api/offres')
      .set(as(user))
      .send({ titre: 'Dev', description: 'x', skillsObligatoires: 'React, Node ,  ' });

    expect(res.status).toBe(201);
    expect(res.body.offre.skillsObligatoires).toEqual(['React', 'Node']);
  });

  it('rejects a missing title or description with 400', async () => {
    const { user } = await createUser('RECRUTEUR');
    const noTitle = await request(app).post('/api/offres').set(as(user)).send({ description: 'x' });
    const noDesc = await request(app).post('/api/offres').set(as(user)).send({ titre: 'x' });

    expect(noTitle.status).toBe(400);
    expect(noDesc.status).toBe(400);
  });

  it('refuses a candidate (403) and an anonymous caller (401)', async () => {
    const { user } = await createUser('CANDIDAT');
    const body = { titre: 'x', description: 'y' };

    expect((await request(app).post('/api/offres').set(as(user)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/offres').send(body)).status).toBe(401);
  });
});

describe('GET /api/offres and /api/offres/:id', () => {
  it('lists offers, newest first', async () => {
    const { user } = await createUser('RECRUTEUR');
    await createOffre(user.id, { titre: 'Ancienne' });
    await createOffre(user.id, { titre: 'Récente' });

    // If your route requires login, add .set(as(user)) here.
    const res = await request(app).get('/api/offres');

    expect(res.status).toBe(200);
    expect(res.body.offres.map((o) => o.titre)).toEqual(['Récente', 'Ancienne']);
  });

  it('returns one offer, and 404 for an unknown id', async () => {
    const { user } = await createUser('RECRUTEUR');
    const offre = await createOffre(user.id);

    expect((await request(app).get(`/api/offres/${offre.id}`)).status).toBe(200);
    expect((await request(app).get('/api/offres/999999')).status).toBe(404);
  });
});

describe('PUT /api/offres/:id', () => {
  it('lets the owner update the offer and keeps untouched fields', async () => {
    const { user } = await createUser('RECRUTEUR');
    const offre = await createOffre(user.id, { description: 'Description initiale' });

    const res = await request(app).put(`/api/offres/${offre.id}`).set(as(user)).send({ titre: 'Nouveau titre' });

    expect(res.status).toBe(200);
    expect(res.body.offre.titre).toBe('Nouveau titre');
    expect(res.body.offre.description).toBe('Description initiale');
  });

  it('refuses another recruiter with 403 and leaves the offer unchanged', async () => {
    const { user: owner } = await createUser('RECRUTEUR');
    const { user: other } = await createUser('RECRUTEUR');
    const offre = await createOffre(owner.id, { titre: 'Original' });

    const res = await request(app).put(`/api/offres/${offre.id}`).set(as(other)).send({ titre: 'Piraté' });

    expect(res.status).toBe(403);
    expect((await prisma.offre.findUnique({ where: { id: offre.id } })).titre).toBe('Original');
  });

  it('lets an admin update any offer', async () => {
    const { user: owner } = await createUser('RECRUTEUR');
    const { user: admin } = await createUser('ADMIN');
    const offre = await createOffre(owner.id);

    const res = await request(app).put(`/api/offres/${offre.id}`).set(as(admin)).send({ titre: 'Par admin' });
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown offer', async () => {
    const { user } = await createUser('RECRUTEUR');
    const res = await request(app).put('/api/offres/999999').set(as(user)).send({ titre: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/offres/:id', () => {
  it('lets the owner delete the offer and its applications', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const { user: candidat } = await createUser('CANDIDAT');
    const offre = await createOffre(recruteur.id);
    await prisma.candidature.create({ data: { candidatId: candidat.id, offreId: offre.id, scoreMatching: 50 } });

    const res = await request(app).delete(`/api/offres/${offre.id}`).set(as(recruteur));

    expect(res.status).toBe(200);
    expect(await prisma.offre.count()).toBe(0);
    expect(await prisma.candidature.count()).toBe(0);
  });

  it('refuses another recruiter with 403 and keeps the offer', async () => {
    const { user: owner } = await createUser('RECRUTEUR');
    const { user: other } = await createUser('RECRUTEUR');
    const offre = await createOffre(owner.id);

    const res = await request(app).delete(`/api/offres/${offre.id}`).set(as(other));

    expect(res.status).toBe(403);
    expect(await prisma.offre.count()).toBe(1);
  });

  it('lets an admin delete any offer, and returns 404 for an unknown one', async () => {
    const { user: owner } = await createUser('RECRUTEUR');
    const { user: admin } = await createUser('ADMIN');
    const offre = await createOffre(owner.id);

    expect((await request(app).delete(`/api/offres/${offre.id}`).set(as(admin))).status).toBe(200);
    expect((await request(app).delete('/api/offres/999999').set(as(admin))).status).toBe(404);
  });
});