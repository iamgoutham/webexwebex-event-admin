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

const fetchWebexSiteUrl = async (accessToken: string) => {
  try {
    const response = await fetch("https://webexapis.com/v1/people/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json;charset=UTF-8",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      if (process.env.WEBEX_DEBUG_PROFILE === "true") {
        const errorBody = await response.text().catch(() => "");
        console.debug("[webex][people/me] error", response.status, errorBody);
      }
      return null;
    }
    const data = (await response.json()) as { siteUrl?: string };
    if (process.env.WEBEX_DEBUG_PROFILE === "true") {
      console.debug("[webex][people/me] response", data);
    }
    return data.siteUrl ?? null;
  } catch {
    return null;
  }
};

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
    async jwt({ token, user, account }) {
      if (user) {
        const loginSiteUrl =
          (account?.provider
            ? getTenantConfigByProvider(account.provider)?.siteUrl
            : null) ??
          (account?.access_token
            ? await fetchWebexSiteUrl(account.access_token)
            : null);
        const shortId = await ensureUserShortId(
          user.id,
          user.email,
          user.shortId,
          loginSiteUrl,
        );
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.shortId = shortId;
      }

      if (account?.provider) {
        const tenantConfig = getTenantConfigByProvider(account.provider);
        token.siteUrl = tenantConfig?.siteUrl ?? token.siteUrl ?? null;
      }

      if (account?.access_token && !token.siteUrl) {
        const siteUrl = await fetchWebexSiteUrl(account.access_token);
        token.siteUrl = siteUrl ?? token.siteUrl ?? null;
      }

      if (!user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true,
            tenantId: true,
            shortId: true,
            email: true,
          },
        });
        if (dbUser) {
          const tokenSiteUrl =
            typeof token.siteUrl === "string" ? token.siteUrl : null;
          const shortId = await ensureUserShortId(
            dbUser.id,
            dbUser.email,
            dbUser.shortId,
            tokenSiteUrl,
          );
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
        session.user.siteUrl = token.siteUrl ?? null;
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

      await ensureUserShortId(user.id, user.email, user.shortId, null);
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

      await ensureUserShortId(
        user.id,
        user.email,
        user.shortId,
        tenantConfig?.siteUrl ?? null,
      );
    },
  },
};
