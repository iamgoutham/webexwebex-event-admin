import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import WebexProvider from "@/lib/webex-provider";
import {
  getTenantConfigByProvider,
  getWebexTenants,
} from "@/lib/webex-tenants";
import { ensureUserShortId } from "@/lib/user-short-id";
import { Role } from "@prisma/client";

const webexTenants = getWebexTenants();
const webexProviders =
  webexTenants.length > 0
    ? webexTenants.map((tenant) =>
        WebexProvider({
          providerId: tenant.providerId,
          name: tenant.displayName ?? "Webex",
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret,
          scopes: tenant.scopes,
          allowDangerousEmailAccountLinking: true,
        }),
      )
    : [
        WebexProvider({
          clientId: process.env.WEBEX_CLIENT_ID ?? "",
          clientSecret: process.env.WEBEX_CLIENT_SECRET ?? "",
          allowDangerousEmailAccountLinking: true,
        }),
      ];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  debug: true,
  logger: {
    debug(code, metadata) {
      console.debug("[next-auth][debug]", code, metadata);
    },
    warn(code) {
      console.warn("[next-auth][warn]", code);
    },
    error(code, metadata) {
      console.error("[next-auth][error]", code, metadata);
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: webexProviders,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const shortId = await ensureUserShortId(user.id, user.shortId);
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.shortId = shortId;
      }

      if (!user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, tenantId: true, shortId: true },
        });
        if (dbUser) {
          const shortId = await ensureUserShortId(dbUser.id, dbUser.shortId);
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.shortId = shortId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? Role.HOST;
        session.user.tenantId = token.tenantId ?? null;
        session.user.shortId = token.shortId ?? null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const defaultTenantId = process.env.DEFAULT_TENANT_ID ?? null;
      const defaultTenantSlug =
        process.env.DEFAULT_TENANT_SLUG ??
        (webexTenants.length === 1 ? webexTenants[0].tenantSlug : undefined);

      let resolvedTenantId = defaultTenantId;
      if (!resolvedTenantId && defaultTenantSlug) {
        const tenant = await prisma.tenant.findUnique({
          where: { slug: defaultTenantSlug },
          select: { id: true },
        });
        resolvedTenantId = tenant?.id ?? null;
      }

      if (resolvedTenantId && !user.tenantId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tenant: {
              connect: { id: resolvedTenantId },
            },
          },
        });
      }

      await ensureUserShortId(user.id, user.shortId);
    },
    async linkAccount({ user, account }) {
      const tenantConfig = getTenantConfigByProvider(account.provider);
      if (tenantConfig?.tenantSlug && !user.tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantConfig.tenantSlug },
          select: { id: true },
        });
        if (tenant) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenant: {
                connect: { id: tenant.id },
              },
            },
          });
        }
      }

      await ensureUserShortId(user.id, user.shortId);
    },
  },
};
