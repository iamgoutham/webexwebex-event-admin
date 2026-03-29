import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-guards";
import { SUPERADMIN_ONLY } from "@/lib/rbac";

const ADMINSITE_URL = (process.env.ADMINSITE_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  ""
);

export async function POST(request: Request) {
  const { session, response } = await requireApiAuth(SUPERADMIN_ONLY);
  if (response) return response;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let clientName: string;
  try {
    const body = await request.json().catch(() => ({}));
    clientName = (body as { client_name?: string }).client_name ?? "";
  } catch {
    clientName = "";
  }
  if (!clientName.trim()) {
    return NextResponse.json(
      { error: "client_name is required." },
      { status: 400 }
    );
  }

  const url = `${ADMINSITE_URL}/meetings/update-sheet?client_name=${encodeURIComponent(clientName.trim())}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = body as { detail?: string | { msg?: string }[] };
    const message =
      typeof raw.detail === "string"
        ? raw.detail
        : Array.isArray(raw.detail) && raw.detail[0]?.msg
        ? raw.detail[0].msg
        : raw.detail ?? (raw as { error?: string }).error ?? "Adminsite request failed.";
    return NextResponse.json(
      { error: message },
      { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
    );
  }

  return NextResponse.json(body);
}
