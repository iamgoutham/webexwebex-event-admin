import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHostIdMapForEmails } from "@/lib/license-site";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const getApiKey = (request: Request) =>
  request.headers.get("x-api-key") ?? request.headers.get("X-API-Key");

export async function GET(request: Request) {
  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!apiKey) {
    console.error("Missing EXTERNAL_API_KEY");
    process.exit(1);
  }

  const provided = getApiKey(request);
  if (!provided || provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const pageSize = Math.min(
    Math.max(Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * pageSize;

  const [totalCount, users] = await Promise.all([
    prisma.user.count({ where: { email: { not: null } } }),
    prisma.user.findMany({
      where: { email: { not: null } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        gridRows: true,
        gridCols: true,
        createdAt: true,
      },
    }),
  ]);

  const emails = users
    .map((user) => user.email)
    .filter((email): email is string => Boolean(email));
  const hostIdMap = await getHostIdMapForEmails(emails);

  const responseUsers = users.map((user) => {
    const email = user.email ?? "";
    const normalizedEmail = email.trim().toLowerCase();
    const gridRows = user.gridRows ?? 5;
    const gridCols = user.gridCols ?? 5;
    return {
      id: user.id,
      email,
      hostId: hostIdMap.get(normalizedEmail) ?? null,
      gridRows,
      gridCols,
      gridCount: gridRows * gridCols,
      createdAt: user.createdAt,
    };
  });

  return NextResponse.json({
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    users: responseUsers,
  });
}
