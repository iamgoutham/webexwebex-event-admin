import { Role } from "@prisma/client";

export const ADMIN_ROLES = [Role.ADMIN, Role.SUPERADMIN];
export const SUPERADMIN_ONLY = [Role.SUPERADMIN];

export const isRoleAllowed = (
  role: Role | undefined,
  allowed: Role[],
): boolean => {
  if (!role) {
    return false;
  }
  return allowed.includes(role);
};

export const hasTenantAccess = (
  role: Role | undefined,
  userTenantId: string | null | undefined,
  tenantId: string | null,
): boolean => {
  if (role === Role.SUPERADMIN) {
    return true;
  }
  if (!tenantId) {
    return false;
  }
  return userTenantId === tenantId;
};
