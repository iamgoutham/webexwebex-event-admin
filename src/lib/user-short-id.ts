import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateShortIdFromEmail } from "@/lib/short-id";

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const ensureUserShortId = async (
  userId: string,
  email?: string | null,
  current?: string | null,
): Promise<string> => {
  if (current) {
    return current;
  }

  if (!email) {
    throw new Error("Email is required to derive shortId.");
  }

  const shortId = generateShortIdFromEmail(email);

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
      throw new Error(`ShortId collision for email: ${email}`);
    }
    throw error;
  }
};
