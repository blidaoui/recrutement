import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
const jwt = nodeRequire('jsonwebtoken');
const bcrypt = nodeRequire('bcryptjs'); // use 'bcrypt' if that's what your project has
const prisma = nodeRequire('../src/config/db');

export async function cleanDb() {
  // Children first, because of foreign keys.
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.candidature.deleteMany();
  await prisma.cV.deleteMany();
  await prisma.offre.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;

export async function createUser(role = 'CANDIDAT', overrides = {}) {
  const password = 'Password123!';
  const user = await prisma.user.create({
    data: {
      nom: `Test ${role}`,
      email: `${role.toLowerCase()}-${Date.now()}-${counter++}@test.com`,
      motDePasse: await bcrypt.hash(password, 10),
      role,
      actif: true,
      ...overrides,
    },
  });
  return { user, password };
}

export function authCookie(user) {
  // Mocks Google OAuth / Login by generating a JWT directly.
  // This bypasses the need to automate the Google Login page in tests.
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `token=${token}`;
}

export async function createOffre(recruteurId, overrides = {}) {
  return prisma.offre.create({
    data: {
      recruteurId,
      titre: 'Dev React',
      description: 'Offre de test',
      skillsRequises: ['react', 'node', 'sql', 'docker'],
      ...overrides,
    },
  });
}

export async function createCv(candidatId, skills = ['react', 'node']) {
  return prisma.cV.create({
    data: { candidatId, urlFichier: '/uploads/test.pdf', nomFichier: 'test.pdf', skillsExtraites: skills },
  });
}