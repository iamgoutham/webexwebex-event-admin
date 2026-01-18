import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import WebexProvider from "@/lib/webex-provider";
import { ensureUserShortId } from "@/lib/user-short-id";
import { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    WebexProvider({
      clientId: process.env.WEBEX_CLIENT_ID ?? "",
      clientSecret: process.env.WEBEX_CLIENT_SECRET ?? "",
    }),
  ],
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
      const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG;

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
          data: { tenantId: resolvedTenantId },
        });
      }

      await ensureUserShortId(user.id, user.shortId);
    },
  },
};
