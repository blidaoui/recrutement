import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { cleanDb, createUser, createOffre, createCv } from './helpers.js';

const nodeRequire = createRequire(import.meta.url);
const prisma = nodeRequire('../src/config/db');
const deleteUserWithRelations = nodeRequire('../src/utils/deleteUserWithRelations');

beforeEach(cleanDb);
afterAll(() => prisma.$disconnect());

describe('deleteUserWithRelations', () => {
  it('rolls everything back when a step fails', async () => {
    const { user: recruteur } = await createUser('RECRUTEUR');
    const { user: candidat } = await createUser('CANDIDAT');
    const offre = await createOffre(recruteur.id);
    await createCv(recruteur.id);
    await prisma.candidature.create({ data: { candidatId: candidat.id, offreId: offre.id, scoreMatching: 50 } });
    const conv = await prisma.conversation.create({ data: { candidatId: candidat.id, recruteurId: recruteur.id } });
    await prisma.message.create({ data: { conversationId: conv.id, senderId: candidat.id, contenu: 'Bonjour' } });

    // Same real transaction, but the final user.delete throws, after all the other deletes ran.
    const failingPrisma = {
      $transaction: (fn) =>
        prisma.$transaction((tx) =>
          fn(
            new Proxy(tx, {
              get: (target, prop) =>
                prop === 'user'
                  ? { delete: async () => { throw new Error('boom'); } }
                  : target[prop],
            })
          )
        ),
    };

    await expect(deleteUserWithRelations(failingPrisma, recruteur.id)).rejects.toThrow('boom');

    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.offre.count()).toBe(1);
    expect(await prisma.cV.count()).toBe(1);
    expect(await prisma.candidature.count()).toBe(1);
    expect(await prisma.conversation.count()).toBe(1);
    expect(await prisma.message.count()).toBe(1);
  });
});