import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getServerAuthSession } from "@/lib/session";
import { isRoleAllowed } from "@/lib/rbac";

export const requireAuth = async () => {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return session;
};

export const requireRole = async (roles: Role[]) => {
  const session = await requireAuth();
  if (!isRoleAllowed(session.user.role, roles)) {
    redirect("/unauthorized");
  }
  return session;
};
