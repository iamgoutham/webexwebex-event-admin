import type { NextRequest, NextResponse } from "next/server";

const METHODS = "GET, POST, OPTIONS";

/** Headers clients may send on protected public APIs (secrets + JSON). */
export const PUBLIC_API_CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-Findameeting-Secret, X-Join-Secret";

function applyPublicApiCorsInner(
  res: NextResponse,
  request: NextRequest,
  originsEnvKey: string,
): NextResponse {
  const raw = (process.env as Record<string, string | undefined>)[
    originsEnvKey
  ]?.trim();
  if (!raw) return res;

  const allowList = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowList.length === 0) return res;

  const origin = request.headers.get("origin");

  if (allowList.includes("*")) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", METHODS);
    res.headers.set("Access-Control-Allow-Headers", PUBLIC_API_CORS_ALLOW_HEADERS);
    return res;
  }

  if (origin && allowList.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", METHODS);
    res.headers.set(
      "Access-Control-Allow-Headers",
      PUBLIC_API_CORS_ALLOW_HEADERS,
    );
    res.headers.set("Vary", "Origin");
    return res;
  }

  return res;
}

/**
 * CORS when `PUBLIC_FINDAMEETING_CORS_ORIGINS` is set (comma-separated origins or `*`).
 */
export function applyPublicFindameetingCors(
  res: NextResponse,
  request: NextRequest,
): NextResponse {
  return applyPublicApiCorsInner(res, request, "PUBLIC_FINDAMEETING_CORS_ORIGINS");
}

/**
 * CORS when `PUBLIC_JOIN_CORS_ORIGINS` is set (comma-separated origins or `*`).
 */
export function applyPublicJoinCors(
  res: NextResponse,
  request: NextRequest,
): NextResponse {
  return applyPublicApiCorsInner(res, request, "PUBLIC_JOIN_CORS_ORIGINS");
}
