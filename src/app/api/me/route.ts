import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-guards";

export async function GET() {
  const { session, response } = await requireApiAuth();
  if (response) {
    return response;
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
