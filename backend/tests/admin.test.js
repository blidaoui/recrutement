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

async function admin() {
  return (await createUser('ADMIN')).user;
}

describe('GET /api/admin/users', () => {
  it('lists users with counts and never exposes password hashes', async () => {
    const a = await admin();
    await createUser('CANDIDAT');

    const res = await request(app).get('/api/admin/users').set(as(a));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.users[0]).toHaveProperty('_count');
    for (const u of res.body.users) {
      expect(u.motDePasse).toBeUndefined();
      expect(u.resetPasswordToken).toBeUndefined();
    }
  });

  it('filters by role and ignores the TOUS value', async () => {
    const a = await admin();
    await createUser('RECRUTEUR');
    await createUser('CANDIDAT');

    const onlyRecruiters = await request(app).get('/api/admin/users?role=RECRUTEUR').set(as(a));
    const all = await request(app).get('/api/admin/users?role=TOUS').set(as(a));

    expect(onlyRecruiters.body.users.map((u) => u.role)).toEqual(['RECRUTEUR']);
    expect(all.body.total).toBe(3);
  });

  it('searches by name or email, case-insensitively', async () => {
    const a = await admin();
    await createUser('CANDIDAT', { nom: 'Alice Martin' });
    await createUser('CANDIDAT', { nom: 'Bob Durand', email: 'bob@example.com' });

    const byName = await request(app).get('/api/admin/users?search=ALICE').set(as(a));
    const byEmail = await request(app).get('/api/admin/users?search=BOB@EXAMPLE').set(as(a));

    expect(byName.body.users.map((u) => u.nom)).toEqual(['Alice Martin']);
    expect(byEmail.body.users.map((u) => u.nom)).toEqual(['Bob Durand']);
  });
});

describe('POST /api/admin/users', () => {
  const valid = { nom: 'Sarah Benali', email: 'sarah.benali@talent.tn', motDePasse: 'secret123', role: 'RECRUTEUR' };

  it('creates an account with the requested role and a hashed password', async () => {
    const a = await admin();

    const res = await request(app).post('/api/admin/users').set(as(a)).send(valid);

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('RECRUTEUR');
    expect(res.body.user.motDePasse).toBeUndefined();

    const row = await prisma.user.findUnique({ where: { email: valid.email } });
    expect(row.motDePasse).not.toBe(valid.motDePasse);
    expect(row.motDePasse).toMatch(/^\$2[aby]\$/);
  });

  it('falls back to CANDIDAT when the role is unknown', async () => {
    const a = await admin();
    const res = await request(app).post('/api/admin/users').set(as(a)).send({ ...valid, role: 'ROOT' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CANDIDAT');
  });

  it.each([
    ['missing name', { ...valid, nom: undefined }],
    ['missing email', { ...valid, email: undefined }],
    ['missing password', { ...valid, motDePasse: undefined }],
    ['invalid email', { ...valid, email: 'not-an-email' }],
    ['password shorter than 6 characters', { ...valid, motDePasse: '12345' }],
  ])('rejects %s with 400', async (_label, body) => {
    const a = await admin();
    const res = await request(app).post('/api/admin/users').set(as(a)).send(body);

    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(1); // only the admin
  });

  it('rejects a duplicate email (current behaviour: 400, register uses 409)', async () => {
    const a = await admin();
    await request(app).post('/api/admin/users').set(as(a)).send(valid);

    const res = await request(app).post('/api/admin/users').set(as(a)).send(valid);

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/users/:id/toggle', () => {
  const toggle = (caller, id) => request(app).patch(`/api/admin/users/${id}/toggle`).set(as(caller));

  it('deactivates then reactivates a user', async () => {
    const a = await admin();
    const { user } = await createUser('CANDIDAT');

    const off = await toggle(a, user.id);
    expect(off.status).toBe(200);
    expect(off.body.actif).toBe(false);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).actif).toBe(false);

    const on = await toggle(a, user.id);
    expect(on.body.actif).toBe(true);
  });

  it('refuses to toggle your own account (400)', async () => {
    const a = await admin();
    expect((await toggle(a, a.id)).status).toBe(400);
  });

  it('answers 404 for an unknown user', async () => {
    const a = await admin();
    expect((await toggle(a, 999999)).status).toBe(404);
  });

  it('refuses to toggle another admin (403)', async () => {
    const a = await admin();
    const other = await admin();

    expect((await toggle(a, other.id)).status).toBe(403);
    expect((await prisma.user.findUnique({ where: { id: other.id } })).actif).toBe(true);
  });

  it('protects the super admin account, whatever the email case (403)', async () => {
    const a = await admin();
    const { user: superAdmin } = await createUser('ADMIN', { email: 'Admin@Admin.com' });

    const res = await toggle(a, superAdmin.id);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('a deactivated user can no longer log in', async () => {
    const a = await admin();
    const { user, password } = await createUser('CANDIDAT');
    await toggle(a, user.id);

    const res = await request(app).post('/api/auth/login').send({ email: user.email, motDePasse: password });

    expect([401, 403]).toContain(res.status);
  });

  // Likely finding: a JWT issued before deactivation may keep working until it expires.
  it('a deactivated user’s existing session is rejected', async () => {
    const a = await admin();
    const { user } = await createUser('CANDIDAT');
    const cookie = authCookie(user);
    await toggle(a, user.id);

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect([401, 403]).toContain(res.status);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  const del = (caller, id) => request(app).delete(`/api/admin/users/${id}`).set(as(caller));

  it('refuses self-deletion (400), unknown users (404), other admins and the super admin (403)', async () => {
    const a = await admin();
    const other = await admin();
    const { user: superAdmin } = await createUser('ADMIN', { email: 'admin@admin.com' });

    expect((await del(a, a.id)).status).toBe(400);
    expect((await del(a, 999999)).status).toBe(404);
    expect((await del(a, other.id)).status).toBe(403);
    expect((await del(a, superAdmin.id)).status).toBe(403);
    expect(await prisma.user.count()).toBe(3);
  });

  it('deleting a recruiter removes their offers, the applications to them and their conversations', async () => {
    const a = await admin();
    const { user: recruteur } = await createUser('RECRUTEUR');
    const { user: candidat } = await createUser('CANDIDAT');
    const offre = await createOffre(recruteur.id);
    await createCv(candidat.id);
    await prisma.candidature.create({ data: { candidatId: candidat.id, offreId: offre.id, scoreMatching: 50 } });
    const conv = await prisma.conversation.create({ data: { candidatId: candidat.id, recruteurId: recruteur.id } });
    await prisma.message.create({ data: { conversationId: conv.id, senderId: candidat.id, contenu: 'Bonjour' } });
    await prisma.message.create({ data: { conversationId: conv.id, senderId: recruteur.id, contenu: 'Salut' } });

    const res = await del(a, recruteur.id);

    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: recruteur.id } })).toBeNull();
    expect(await prisma.offre.count()).toBe(0);
    expect(await prisma.candidature.count()).toBe(0);
    expect(await prisma.conversation.count()).toBe(0);
    expect(await prisma.message.count()).toBe(0);
    // The candidate account and CV are untouched.
    expect(await prisma.user.findUnique({ where: { id: candidat.id } })).not.toBeNull();
    expect(await prisma.cV.count()).toBe(1);
  });

  it('deleting a candidate removes their CV and applications but keeps the offer', async () => {
    const a = await admin();
    const { user: recruteur } = await createUser('RECRUTEUR');
    const { user: candidat } = await createUser('CANDIDAT');
    const offre = await createOffre(recruteur.id);
    await createCv(candidat.id);
    await prisma.candidature.create({ data: { candidatId: candidat.id, offreId: offre.id, scoreMatching: 50 } });

    const res = await del(a, candidat.id);

    expect(res.status).toBe(200);
    expect(await prisma.cV.count()).toBe(0);
    expect(await prisma.candidature.count()).toBe(0);
    expect(await prisma.offre.count()).toBe(1);
  });
});