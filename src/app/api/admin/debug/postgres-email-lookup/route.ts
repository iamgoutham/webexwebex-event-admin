import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

type EmailRow = { email: string | null };

// GET /api/admin/debug/postgres-email-lookup?email=foo@bar.com
export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth([Role.ADMIN, Role.SUPERADMIN]);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Query param 'email' is required." },
      { status: 400 },
    );
  }

  const postgres = getPostgresPrisma();
  if (!postgres) {
    return NextResponse.json(
      { error: "Downstream Postgres is not configured." },
      { status: 503 },
    );
  }

  try {
    const [nonIndia, nonIndiaGp, nonIndiaDattap, india] = await Promise.all([
      postgres.$queryRaw<EmailRow[]>`
        SELECT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
      `,
      postgres.$queryRaw<EmailRow[]>`
        SELECT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india_gp
        WHERE lower(btrim(host_email_id::text)) = ${email}
      `,
      postgres.$queryRaw<EmailRow[]>`
        SELECT lower(btrim(host_email_id::text)) AS email
        FROM mission.webex_hosts_non_india_dattap
        WHERE lower(btrim(host_email_id::text)) = ${email}
      `,
      postgres.$queryRaw<EmailRow[]>`
        SELECT lower(btrim(host_email_id::text)) AS email
        FROM vrindavan.webex_hosts_india
        WHERE lower(btrim(host_email_id::text)) = ${email}
      `,
    ]);

    const unionRows = await postgres.$queryRaw<EmailRow[]>`
      SELECT lower(btrim(host_email_id::text)) AS email
      FROM mission.webex_hosts_non_india
      WHERE lower(btrim(host_email_id::text)) = ${email}
      UNION
      SELECT lower(btrim(host_email_id::text)) AS email
      FROM mission.webex_hosts_non_india_gp
      WHERE lower(btrim(host_email_id::text)) = ${email}
      UNION
      SELECT lower(btrim(host_email_id::text)) AS email
      FROM mission.webex_hosts_non_india_dattap
      WHERE lower(btrim(host_email_id::text)) = ${email}
      UNION
      SELECT lower(btrim(host_email_id::text)) AS email
      FROM vrindavan.webex_hosts_india
      WHERE lower(btrim(host_email_id::text)) = ${email}
    `;

    return NextResponse.json({
      email,
      tables: {
        mission_webex_hosts_non_india: nonIndia.length > 0,
        mission_webex_hosts_non_india_gp: nonIndiaGp.length > 0,
        mission_webex_hosts_non_india_dattap: nonIndiaDattap.length > 0,
        vrindavan_webex_hosts_india: india.length > 0,
      },
      counts: {
        mission_webex_hosts_non_india: nonIndia.length,
        mission_webex_hosts_non_india_gp: nonIndiaGp.length,
        mission_webex_hosts_non_india_dattap: nonIndiaDattap.length,
        vrindavan_webex_hosts_india: india.length,
        union: unionRows.length,
      },
      included_in_union: unionRows.length > 0,
      union_rows: unionRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to query downstream Postgres host tables.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
