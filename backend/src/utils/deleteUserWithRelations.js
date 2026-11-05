async function deleteUserWithRelations(prisma, userId) {
  await prisma.$transaction(async (tx) => {
    const [offers, conversations] = await Promise.all([
      tx.offre.findMany({ where: { recruteurId: userId }, select: { id: true } }),
      tx.conversation.findMany({
        where: { OR: [{ candidatId: userId }, { recruteurId: userId }] },
        select: { id: true },
      }),
    ]);

    const offerIds = offers.map((offer) => offer.id);
    const conversationIds = conversations.map((conversation) => conversation.id);

    await tx.message.deleteMany({
      where: {
        OR: [
          { senderId: userId },
          { conversationId: { in: conversationIds } },
        ],
      },
    });
    await tx.conversation.deleteMany({
      where: { OR: [{ candidatId: userId }, { recruteurId: userId }] },
    });
    await tx.candidature.deleteMany({
      where: {
        OR: [
          { candidatId: userId },
          { offreId: { in: offerIds } },
        ],
      },
    });
    await tx.cV.deleteMany({ where: { candidatId: userId } });
    await tx.offre.deleteMany({ where: { recruteurId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

module.exports = deleteUserWithRelations;