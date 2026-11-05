import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { cleanDb, createUser, authCookie, createOffre, createCv } from './helpers.js';

const nodeRequire = createRequire(import.meta.url);
const { app } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

beforeEach(cleanDb);
afterAll(() => prisma.$disconnect());

const as = (user) => ({ Cookie: authCookie(user) });
const apply = (user, offreId) => request(app).post('/api/candidatures').set(as(user)).send({ offreId });

async function candidateWithCv(skills) {
  const { user } = await createUser('CANDIDAT');
  await createCv(user.id, skills);
  return user;
}

// Offer requires 4 skills: react, node, sql, docker (see createOffre in helpers.js)
describe('POST /api/candidatures', () => {
  it('stores the matching score (2 of 4 required skills = 50)', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const candidat = await candidateWithCv(['react', 'node']);

    const res = await apply(candidat, offre.id);

    expect(res.status).toBe(201);
    expect(res.body.candidature.scoreMatching).toBe(50);
    expect(res.body.candidature.statut).toBe('EN_ATTENTE');
  });

  it('answers 400 with noCv when the candidate has no CV', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const { user: candidat } = await createUser('CANDIDAT');

    const res = await apply(candidat, offre.id);

    expect(res.status).toBe(400);
    expect(res.body.noCv).toBe(true);
    expect(await prisma.candidature.count()).toBe(0);
  });

  it('answers 404 for an unknown offer', async () => {
    const candidat = await candidateWithCv(['react']);
    expect((await apply(candidat, 999999)).status).toBe(404);
  });

  it('applying twice keeps a single row (current behaviour: upsert, not blocked)', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const candidat = await candidateWithCv(['react']);

    await apply(candidat, offre.id);
    const second = await apply(candidat, offre.id);

    expect(second.status).toBe(201);
    expect(await prisma.candidature.count()).toBe(1);
  });

  it('refreshes the score when the CV changed before the second application', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const candidat = await candidateWithCv(['react']); // 25

    await apply(candidat, offre.id);
    await prisma.cV.update({ where: { candidatId: candidat.id }, data: { skillsExtraites: ['react', 'node', 'sql'] } });
    const res = await apply(candidat, offre.id);

    expect(res.body.candidature.scoreMatching).toBe(75);
  });

  it.todo('decide: a missing offreId currently reaches Prisma with NaN and likely returns 500 instead of 400');
});

describe('GET /api/candidatures/offre/:offreId', () => {
  it('lists applications sorted by score, highest first', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);

    // Created out of order on purpose, so the test cannot pass by insertion order.
    const medium = await candidateWithCv(['react', 'node']);                   // 50
    const low = await candidateWithCv(['react']);                              // 25
    const high = await candidateWithCv(['react', 'node', 'sql', 'docker']);    // 100
    for (const c of [medium, low, high]) await apply(c, offre.id);

    const res = await request(app).get(`/api/candidatures/offre/${offre.id}`).set(as(recruteur));

    expect(res.status).toBe(200);
    expect(res.body.candidatures.map((c) => c.scoreMatching)).toEqual([100, 50, 25]);
    expect(res.body.candidatures.map((c) => c.candidatId)).toEqual([high.id, medium.id, low.id]);
  });

  it('includes the candidate CV in each application', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const candidat = await candidateWithCv(['react']);
    await apply(candidat, offre.id);

    const res = await request(app).get(`/api/candidatures/offre/${offre.id}`).set(as(recruteur));

    expect(res.body.candidatures[0].cv).not.toBeNull();
  });

  // IDOR: if this fails, any recruiter can read another recruiter's applicants.
  it("refuses a recruiter who does not own the offer (403)", async () => {
    const { user: owner } = await createUser('RECRUTEUR');
    const { user: other } = await createUser('RECRUTEUR');
    const offre = await createOffre(owner.id);

    const res = await request(app).get(`/api/candidatures/offre/${offre.id}`).set(as(other));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/candidatures/mes-candidatures', () => {
  it('returns only the calling candidate’s applications', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const offre = await createOffre(recruteur.id);
    const a = await candidateWithCv(['react']);
    const b = await candidateWithCv(['node']);
    await apply(a, offre.id);
    await apply(b, offre.id);

    const res = await request(app).get('/api/candidatures/mes-candidatures').set(as(a));

    expect(res.status).toBe(200);
    expect(res.body.candidatures).toHaveLength(1);
    expect(res.body.candidatures[0].candidatId).toBe(a.id);
  });
});

describe('PATCH /api/candidatures/:id/statut', () => {
  async function setup() {
    const { user: owner } = await createUser('RECRUTEUR');
    const offre = await createOffre(owner.id);
    const { user: candidat } = await createUser('CANDIDAT');
    const candidature = await prisma.candidature.create({
      data: { candidatId: candidat.id, offreId: offre.id, scoreMatching: 50 },
    });
    return { owner, candidature };
  }
  const patch = (user, id, statut) =>
    request(app).patch(`/api/candidatures/${id}/statut`).set(as(user)).send({ statut });

  it('lets the owner accept an application', async () => {
    const { owner, candidature } = await setup();

    const res = await patch(owner, candidature.id, 'ACCEPTEE');

    expect(res.status).toBe(200);
    expect((await prisma.candidature.findUnique({ where: { id: candidature.id } })).statut).toBe('ACCEPTEE');
  });

  it('rejects an invalid status with 400', async () => {
    const { owner, candidature } = await setup();
    expect((await patch(owner, candidature.id, 'PEUT_ETRE')).status).toBe(400);
  });

  // IDOR: if this fails, any recruiter can accept or refuse anyone's applicants.
  it('refuses a recruiter who does not own the offer (403)', async () => {
    const { candidature } = await setup();
    const { user: other } = await createUser('RECRUTEUR');

    const res = await patch(other, candidature.id, 'REFUSEE');

    expect(res.status).toBe(403);
    expect((await prisma.candidature.findUnique({ where: { id: candidature.id } })).statut).toBe('EN_ATTENTE');
  });

it('answers 400 when offreId is missing', async () => {
  const candidat = await candidateWithCv(['react']);
  const res = await request(app).post('/api/candidatures').set(as(candidat)).send({});
  expect(res.status).toBe(400);
});
});