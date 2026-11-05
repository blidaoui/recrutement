import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

// Whatever .env contains, no real email or Gemini call can happen in these tests.
// (server.js also loads .env, but dotenv never overrides a variable that is already defined.)
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'GEMINI_API_KEY']) {
  process.env[key] = '';
}

const jwt = nodeRequire('jsonwebtoken');
const bcrypt = nodeRequire('bcryptjs');
const crypto = nodeRequire('crypto');
const { app } = nodeRequire('../src/server.js');
const prisma = nodeRequire('../src/config/db');

const secret = process.env.JWT_SECRET;
const TEST_DOMAIN = '@autotest.tn';
const NEW_PASSWORD = 'brand-new-456';
let counter = 0;

// ── Helpers ────────────────────────────────────────────────────────────────

function uniqueEmail() {
  counter += 1;
  return `user-${process.pid}-${Date.now()}-${counter}${TEST_DOMAIN}`;
}

function cleanUsers() {
  return prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function tokenFromResponse(res) {
  const cookies = res.headers['set-cookie'] || [];
  const raw = cookies.find((c) => c.startsWith('token='));
  return raw ? raw.split(';')[0].slice('token='.length) : null;
}

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret);
}

async function createUser({ password = 'secret123', role = 'CANDIDAT', actif = true, googleOnly = false } = {}) {
  const email = uniqueEmail();
  const user = await prisma.user.create({
    data: {
      nom: 'Test User',
      email,
      motDePasse: googleOnly ? null : await bcrypt.hash(password, 4),
      googleId: googleOnly ? `google-${email}` : undefined,
      role,
      actif,
    },
  });
  return { user, email, password };
}

function register(body) {
  return request(app).post('/api/auth/register').send(body);
}

function login(email, motDePasse) {
  return request(app).post('/api/auth/login').send({ email, motDePasse });
}

// Stores a reset token the same way the app does (SHA-256 hash only) and returns the raw one.
async function armResetToken(userId, { expiresInMs = 60 * 60 * 1000 } = {}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { resetPasswordToken: hashed, resetPasswordExpires: new Date(Date.now() + expiresInMs) },
  });
  return { rawToken, hashed };
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  expect(secret, 'JWT_SECRET must be set in .env.test').toBeTruthy();

  const rows = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (rows[0].name !== 'recrutement_ia_test') {
    throw new Error(`Refusing to run: connected to "${rows[0].name}", not to the test database`);
  }

  await cleanUsers();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanUsers();
});

afterAll(async () => {
  await cleanUsers();
  await prisma.$disconnect();
});

// ── Register ───────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a candidate account and returns it without the password', async () => {
    const email = uniqueEmail();

    const res = await register({ nom: 'Sarah Test', email, motDePasse: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Inscription réussie');
    expect(res.body.user).toMatchObject({ nom: 'Sarah Test', email, role: 'CANDIDAT', actif: true });
    expect(res.body.user).not.toHaveProperty('motDePasse');
  });

  it('stores the password hashed, never in clear text', async () => {
    const email = uniqueEmail();

    await register({ nom: 'Sarah Test', email, motDePasse: 'secret123' });

    const stored = await findByEmail(email);
    expect(stored.motDePasse).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', stored.motDePasse)).toBe(true);
  });

  it('sets an httpOnly session cookie that lasts 7 days', async () => {
    const res = await register({ nom: 'Sarah Test', email: uniqueEmail(), motDePasse: 'secret123' });

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=604800');
  });

  it('ignores a role sent by the client', async () => {
    const email = uniqueEmail();

    const res = await register({ nom: 'Sneaky', email, motDePasse: 'secret123', role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CANDIDAT');
    expect((await findByEmail(email)).role).toBe('CANDIDAT');
  });

  it('trims spaces around the email', async () => {
    const email = uniqueEmail();

    const res = await register({ nom: 'Sarah Test', email: `  ${email}  `, motDePasse: 'secret123' });

    expect(res.status).toBe(201);
    expect(await findByEmail(email)).not.toBeNull();
  });

  it.each(['nom', 'email', 'motDePasse'])('rejects a request without %s', async (missing) => {
    const body = { nom: 'Sarah Test', email: uniqueEmail(), motDePasse: 'secret123' };
    delete body[missing];

    const res = await register(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tous les champs obligatoires doivent être remplis');
  });

  it('rejects an invalid email', async () => {
    const res = await register({ nom: 'Sarah Test', email: 'not-an-email', motDePasse: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Adresse email invalide');
  });

  it('rejects a password shorter than 6 characters and creates nothing', async () => {
    const email = uniqueEmail();

    const res = await register({ nom: 'Sarah Test', email, motDePasse: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Le mot de passe doit contenir au moins 6 caractères');
    expect(await findByEmail(email)).toBeNull();
  });

  it('accepts a password of exactly 6 characters', async () => {
    const res = await register({ nom: 'Sarah Test', email: uniqueEmail(), motDePasse: '123456' });

    expect(res.status).toBe(201);
  });

  it('rejects an email that is already registered', async () => {
    const email = uniqueEmail();
    await register({ nom: 'First', email, motDePasse: 'secret123' });

    const res = await register({ nom: 'Second', email, motDePasse: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Un compte avec cet email existe déjà');
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });
});

// ── Login ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('logs in with the right credentials', async () => {
    const { user, email, password } = await createUser();

    const res = await login(email, password);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Connexion réussie');
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user).not.toHaveProperty('motDePasse');
    expect(tokenFromResponse(res)).toBeTruthy();
  });

  it('puts the user id, email and role in the token', async () => {
    const { user, email, password } = await createUser();

    const res = await login(email, password);

    const decoded = jwt.verify(tokenFromResponse(res), secret);
    expect(decoded).toMatchObject({ id: user.id, email, role: 'CANDIDAT' });
  });

  it('rejects a wrong password and sets no cookie', async () => {
    const { email } = await createUser();

    const res = await login(email, 'wrong-password');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email ou mot de passe incorrect');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('gives the same answer for an unknown email as for a wrong password', async () => {
    const res = await login(uniqueEmail(), 'whatever123');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email ou mot de passe incorrect');
  });

  it('rejects a request without a password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: uniqueEmail() });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email et mot de passe requis');
  });

  it('rejects an invalid email format', async () => {
    const res = await login('not-an-email', 'secret123');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Adresse email invalide');
  });

  it('refuses a disabled account with a 403 and no cookie', async () => {
    const { email, password } = await createUser({ actif: false });

    const res = await login(email, password);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('does not reveal that an account is disabled when the password is wrong', async () => {
    const { email } = await createUser({ actif: false });

    const res = await login(email, 'wrong-password');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email ou mot de passe incorrect');
  });

  it('refuses a password login on a Google-only account', async () => {
    const { email } = await createUser({ googleOnly: true });

    const res = await login(email, 'secret123');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email ou mot de passe incorrect');
  });

  it('trims spaces around the email', async () => {
    const { email, password } = await createUser();

    const res = await login(`  ${email}  `, password);

    expect(res.status).toBe(200);
  });
});

// ── Session: /me and logout ────────────────────────────────────────────────

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  it('returns the logged-in user from the cookie, without the password', async () => {
    const { email, password } = await createUser();
    const token = tokenFromResponse(await login(email, password));

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('motDePasse');
  });

  it('accepts the token in an Authorization Bearer header', async () => {
    const { user } = await createUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('blocks an account that was disabled after its token was issued', async () => {
    const { user } = await createUser({ actif: false });

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${tokenFor(user)}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Compte désactivé');
  });

  it('rejects the token of a user that no longer exists', async () => {
    const { user } = await createUser();
    const token = tokenFor(user);
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Utilisateur introuvable');
  });

  it('clears the cookie on logout', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Déconnexion réussie');
    const cleared = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cleared.startsWith('token=;')).toBe(true);
  });
});

// ── Forgot password ────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    // The app prints the reset link in the console when SMTP is not configured.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('answers with a generic 200 for an unknown email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail() });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Si un compte existe');
  });

  it('gives exactly the same answer for an existing and an unknown email', async () => {
    const { email } = await createUser();

    const known = await request(app).post('/api/auth/forgot-password').send({ email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail() });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });

  it('stores only a SHA-256 hash of the token, valid for about one hour', async () => {
    const { email } = await createUser();
    const before = Date.now();

    const res = await request(app).post('/api/auth/forgot-password').send({ email });

    expect(res.status).toBe(200);
    const stored = await findByEmail(email);
    expect(stored.resetPasswordToken).toMatch(/^[0-9a-f]{64}$/);
    const lifetime = stored.resetPasswordExpires.getTime() - before;
    expect(lifetime).toBeGreaterThan(55 * 60 * 1000);
    expect(lifetime).toBeLessThan(65 * 60 * 1000);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Adresse email invalide');
  });

  it('rejects a request without an email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Adresse email requise');
  });

  it('replaces the previous token when a new one is requested', async () => {
    const { email } = await createUser();

    await request(app).post('/api/auth/forgot-password').send({ email });
    const first = (await findByEmail(email)).resetPasswordToken;
    await request(app).post('/api/auth/forgot-password').send({ email });
    const second = (await findByEmail(email)).resetPasswordToken;

    expect(second).not.toBe(first);
  });
});

// ── Reset password ─────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password/:token', () => {
  it('resets the password, logs the user in and clears the token', async () => {
    const { user, email, password } = await createUser();
    const { rawToken } = await armResetToken(user.id);

    const res = await request(app)
      .post(`/api/auth/reset-password/${rawToken}`)
      .send({ motDePasse: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Mot de passe réinitialisé avec succès');
    expect(tokenFromResponse(res)).toBeTruthy();

    const stored = await findByEmail(email);
    expect(stored.resetPasswordToken).toBeNull();
    expect(stored.resetPasswordExpires).toBeNull();

    expect((await login(email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(email, password)).status).toBe(400);
  });

  it('works only once for a given token', async () => {
    const { user } = await createUser();
    const { rawToken } = await armResetToken(user.id);
    await request(app).post(`/api/auth/reset-password/${rawToken}`).send({ motDePasse: NEW_PASSWORD });

    const second = await request(app)
      .post(`/api/auth/reset-password/${rawToken}`)
      .send({ motDePasse: 'another-pass-789' });

    expect(second.status).toBe(400);
    expect(second.body.message).toBe('Lien de réinitialisation invalide ou expiré');
  });

  it('rejects an expired token and keeps the old password', async () => {
    const { user, email, password } = await createUser();
    const { rawToken } = await armResetToken(user.id, { expiresInMs: -60 * 1000 });

    const res = await request(app)
      .post(`/api/auth/reset-password/${rawToken}`)
      .send({ motDePasse: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Lien de réinitialisation invalide ou expiré');
    expect((await login(email, password)).status).toBe(200);
  });

  it('rejects a token that was never issued', async () => {
    const res = await request(app)
      .post(`/api/auth/reset-password/${'a'.repeat(64)}`)
      .send({ motDePasse: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Lien de réinitialisation invalide ou expiré');
  });

  it('rejects a new password shorter than 6 characters and keeps the token', async () => {
    const { user, email } = await createUser();
    const { rawToken } = await armResetToken(user.id);

    const res = await request(app)
      .post(`/api/auth/reset-password/${rawToken}`)
      .send({ motDePasse: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Le mot de passe doit contenir au moins 6 caractères');
    expect((await findByEmail(email)).resetPasswordToken).not.toBeNull();
  });

  it('rejects a request without a new password', async () => {
    const { user } = await createUser();
    const { rawToken } = await armResetToken(user.id);

    const res = await request(app).post(`/api/auth/reset-password/${rawToken}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token et nouveau mot de passe requis');
  });

  it('does not accept the stored hash as if it were the token', async () => {
    const { user } = await createUser();
    const { hashed } = await armResetToken(user.id);

    const res = await request(app)
      .post(`/api/auth/reset-password/${hashed}`)
      .send({ motDePasse: NEW_PASSWORD });

    expect(res.status).toBe(400);
  });
});

// ── Behaviours to decide on ────────────────────────────────────────────────

describe('behaviours to decide on', () => {
  it.todo('decide: emails are case-sensitive, so "Sarah@x.tn" and "sarah@x.tn" can become two different accounts');
  it.todo('decide: a password sent as a number probably ends in a 500 instead of a 400 (check it first)');
  it.todo('decide: user responses include internal fields such as googleId and the stored reset-token hash');
});
