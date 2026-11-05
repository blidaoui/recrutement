import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const jwt = nodeRequire('jsonwebtoken');
const { app } = nodeRequire('../src/server.js');
const { requireRole } = nodeRequire('../src/middleware/auth.js');
const prisma = nodeRequire('../src/config/db');

const secret = process.env.JWT_SECRET;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('test environment', () => {
  it('has a JWT secret configured', () => {
    expect(secret).toBeTruthy();
  });
});

describe('requireAuth (through GET /api/auth/me)', () => {
  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentification requise');
  });

  it('rejects a cookie that is not a JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'token=not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalide ou expiré');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ id: 1 }, 'some-other-secret');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalide ou expiré');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, secret);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalide ou expiré');
  });

  it('rejects a valid token that belongs to no user', async () => {
    const orphan = jwt.sign({ id: 987654321 }, secret);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `token=${orphan}`);

    expect(res.status).toBe(401);
  });

  it('also reads the token from an Authorization Bearer header', async () => {
    // If the header were ignored, the message would be "Authentification requise".
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token invalide ou expiré');
  });
});

describe('protected auth routes without a token', () => {
  it.each([
    ['get', '/api/auth/me'],
    ['put', '/api/auth/profile'],
    ['delete', '/api/auth/profile'],
  ])('%s %s answers 401', async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  function run(guard, user) {
    const req = { user };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    guard(req, res, next);

    return { res, next };
  }

  it('lets through a user whose role is in the list', () => {
    const { res, next } = run(requireRole('RECRUTEUR', 'ADMIN'), { role: 'ADMIN' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks a user whose role is not in the list', () => {
    const { res, next } = run(requireRole('RECRUTEUR'), { role: 'CANDIDAT' });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Accès interdit pour ce rôle' });
  });

  it('blocks a request that has no user attached', () => {
    const { res, next } = run(requireRole('ADMIN'), undefined);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
