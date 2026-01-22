import { headers } from "next/headers";

export type WebexTenantConfig = {
  host?: string;
  hosts?: string[];
  providerId: string;
  siteUrl?: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
  tenantSlug?: string;
  displayName?: string;
};

const normalizeHost = (value?: string | null) => {
  if (!value) {
    return "";
  }
  return value.split(",")[0].trim().split(":")[0].toLowerCase();
};

const parseTenantsFromEnv = (): WebexTenantConfig[] => {
  const raw = process.env.WEBEX_TENANTS;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(Boolean) as WebexTenantConfig[];
  } catch {
    return [];
  }
};

const fallbackTenant = (): WebexTenantConfig[] => {
  if (!process.env.WEBEX_CLIENT_ID || !process.env.WEBEX_CLIENT_SECRET) {
    return [];
  }
  return [
    {
      providerId: "webex",
      siteUrl: process.env.WEBEX_SITE_URL,
      clientId: process.env.WEBEX_CLIENT_ID,
      clientSecret: process.env.WEBEX_CLIENT_SECRET,
      scopes: process.env.WEBEX_SCOPES,
      tenantSlug: process.env.DEFAULT_TENANT_SLUG,
      displayName: "Webex",
    },
  ];
};

let cachedTenants: WebexTenantConfig[] | null = null;

export const getWebexTenants = () => {
  if (cachedTenants) {
    return cachedTenants;
  }
  const tenants = parseTenantsFromEnv();
  cachedTenants = tenants.length ? tenants : fallbackTenant();
  return cachedTenants;
};

export const getTenantConfigByHost = (host?: string | null) => {
  const tenants = getWebexTenants();
  if (!tenants.length) {
    return null;
  }

  const normalized = normalizeHost(host);
  if (!normalized) {
    return tenants.find((tenant) => !tenant.host && !tenant.hosts) ?? tenants[0];
  }

  const match = tenants.find((tenant) => {
    const hosts = tenant.hosts ?? (tenant.host ? [tenant.host] : []);
    return hosts.map((item) => normalizeHost(item)).includes(normalized);
  });

  return match ?? tenants.find((tenant) => !tenant.host && !tenant.hosts) ?? null;
};

export const getTenantConfigFromHeaders = async () => {
  const requestHeaders = await headers();
  const hostHeader =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return getTenantConfigByHost(hostHeader);
};

export const getTenantConfigByProvider = (providerId: string) => {
  const tenants = getWebexTenants();
  return tenants.find((tenant) => tenant.providerId === providerId) ?? null;
};
