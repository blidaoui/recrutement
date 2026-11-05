import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

// server.js is a CommonJS file; loading it through Node's own require keeps it
// consistent with how the rest of the backend loads its modules.
const nodeRequire = createRequire(import.meta.url);
const { app } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/health', () => {
  it('answers 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it('returns 404 for a route that does not exist', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');

    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('allows the frontend origin and credentials', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow an unknown origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('test database', () => {
  it('is connected to recrutement_ia_test and not to the development database', async () => {
    const rows = await prisma.$queryRaw`SELECT current_database() AS name`;

    expect(rows[0].name).toBe('recrutement_ia_test');
  });
});
