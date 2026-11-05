import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
const jwt = nodeRequire('jsonwebtoken');
const bcrypt = nodeRequire('bcryptjs'); // or 'bcrypt', whichever your project uses
const prisma = nodeRequire('../src/config/db');

export async function cleanDb() {
  // Order matters because of foreign keys. Adjust to the models in schema.prisma.
  await prisma.message?.deleteMany();
  await prisma.candidature?.deleteMany();
  await prisma.offre?.deleteMany();
  await prisma.cv?.deleteMany();
  await prisma.user.deleteMany();
}

// TODO: adapt the field names (nom, motDePasse, actif...) to your schema.prisma
export async function createUser(role = 'CANDIDAT', overrides = {}) {
  const password = 'Password123!';
  const user = await prisma.user.create({
  data: {
    nom: `Test ${role}`,
    email: `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    password: await bcrypt.hash(password, 10),
    role,
    ...overrides,
  },
});
  return { user, password };
}

export function authCookie(user) {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return `token=${token}`;
}