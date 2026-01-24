import { Prisma, PrismaClient } from "@prisma/client";
import { createPrismaAdapter } from "../src/lib/prisma-adapter";
import { generateShortIdFromEmail } from "../src/lib/short-id";

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(),
});

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const main = async () => {
  const dryRun = process.env.DRY_RUN === "true";
  const onlyMissing = process.env.ONLY_MISSING === "true";

  const users = await prisma.user.findMany({
    select: { id: true, email: true, shortId: true },
  });

  const candidates = users.filter((user) => user.email);
  const planned = candidates
    .map((user) => {
      const shortId = generateShortIdFromEmail(user.email!);
      return {
        id: user.id,
        email: user.email!,
        currentShortId: user.shortId,
        nextShortId: shortId,
      };
    })
    .filter((plan) => !onlyMissing || !plan.currentShortId);

  const collisions = new Map<string, string[]>();
  for (const plan of planned) {
    const list = collisions.get(plan.nextShortId) ?? [];
    list.push(plan.email);
    collisions.set(plan.nextShortId, list);
  }

  const duplicates = [...collisions.entries()].filter(
    ([, emails]) => emails.length > 1,
  );

  if (duplicates.length > 0) {
    console.error("ShortId collision detected. Aborting.");
    for (const [shortId, emails] of duplicates) {
      console.error(`shortId=${shortId} emails=${emails.join(", ")}`);
    }
    process.exit(1);
  }

  const updates = planned.filter(
    (plan) => plan.currentShortId !== plan.nextShortId,
  );

  console.log(
    `Users found: ${users.length}. Planned updates: ${updates.length}.`,
  );

  if (dryRun) {
    console.log("Dry run enabled. No updates were applied.");
    return;
  }

  for (const plan of updates) {
    try {
      await prisma.user.update({
        where: { id: plan.id },
        data: { shortId: plan.nextShortId },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        console.error(
          `Unique constraint error for ${plan.email} -> ${plan.nextShortId}`,
        );
      }
      throw error;
    }
  }

  console.log("ShortId backfill complete.");
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
