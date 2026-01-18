import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/session";
import { isRoleAllowed } from "@/lib/rbac";

export const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export const requireApiAuth = async (roles?: Role[]) => {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return { session: null, response: jsonError("Unauthorized", 401) };
  }

  if (roles && !isRoleAllowed(session.user.role, roles)) {
    return { session: null, response: jsonError("Forbidden", 403) };
  }

  return { session, response: null };
};
