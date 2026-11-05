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

describe('GET /api/stats', () => {
  it('returns correct totals for a recruiter', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');

    // Create 2 offers: one open, one closed
    const o1 = await prisma.offre.create({
      data: { titre: 'Offre 1', description: 'Desc 1', recruteurId: recruteur.id, statut: 'ouverte' }
    });
    await prisma.offre.create({
      data: { titre: 'Offre 2', description: 'Desc 2', recruteurId: recruteur.id, statut: 'fermée' }
    });

    // Create candidatures with specific scores
    const c1 = await createUser('CANDIDAT');
    const c2 = await createUser('CANDIDAT');
    const c3 = await createUser('CANDIDAT');

    // Offre 1: 3 candidatures (one high score)
    await prisma.candidature.create({ data: { candidatId: c1.user.id, offreId: o1.id, scoreMatching: 85, statut: 'ACCEPTEE' } });
    await prisma.candidature.create({ data: { candidatId: c2.user.id, offreId: o1.id, scoreMatching: 45, statut: 'EN_ATTENTE' } });
    await prisma.candidature.create({ data: { candidatId: c3.user.id, offreId: o1.id, scoreMatching: 20, statut: 'REFUSEE' } });

    const res = await request(app).get('/api/stats').set(as(recruteur));

    expect(res.status).toBe(200);
    expect(res.body.totalOffres).toBe(2);
    expect(res.body.offresOuvertes).toBe(1);
    expect(res.body.totalCandidatures).toBe(3);
    expect(res.body.profilsHautScore).toBe(1); // Only the 85 score

    // Verify tranches
    expect(res.body.tranches['0-39']).toBe(1);
    expect(res.body.tranches['40-59']).toBe(1);
    expect(res.body.tranches['60-79']).toBe(0);
    expect(res.body.tranches['80-100']).toBe(1);

    // Verify statuts
    expect(res.body.statuts.ACCEPTEE).toBe(1);
    expect(res.body.statuts.EN_ATTENTE).toBe(1);
    expect(res.body.statuts.REFUSEE).toBe(1);
  });

  it('returns admin-specific global stats when called by ADMIN', async () => {
    const { user: admin } = await createUser('ADMIN');

    // Create some global data
    await prisma.user.create({ data: { nom: 'C1', email: 'c1@test.com', motDePasse: 'hashed', role: 'CANDIDAT', actif: true } });
    await prisma.user.create({ data: { nom: 'C2', email: 'c2@test.com', motDePasse: 'hashed', role: 'CANDIDAT', actif: true } });
    const { user: globalCan } = await createUser('CANDIDAT');
    await prisma.cV.create({ data: { candidatId: globalCan.id, urlFichier: 'path/1', nomFichier: 'cv1.pdf' } });

    const res = await request(app).get('/api/stats').set(as(admin));

    expect(res.status).toBe(200);
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.totalCandidats).toBeGreaterThanOrEqual(2);
    expect(res.body.admin.totalCVs).toBeGreaterThanOrEqual(1);
  });

  it('refuses access to candidates (403)', async () => {
    const { user: candidat } = await createUser('CANDIDAT');
    const res = await request(app).get('/api/stats').set(as(candidat));
    expect(res.status).toBe(403);
  });

  it('refuses anonymous access (401)', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });
});
