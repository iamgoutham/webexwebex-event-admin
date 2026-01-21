import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateShortId } from "@/lib/short-id";

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const ensureUserShortId = async (
  userId: string,
  current?: string | null,
): Promise<string> => {
  if (current) {
    return current;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortId = generateShortId();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { shortId },
        select: { shortId: true },
      });
      if (!updated.shortId) {
        throw new Error("ShortId generation returned empty value");
      }
      return updated.shortId;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to generate a unique shortId");
};
