import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { getPostgresPrisma } from "@/lib/prisma-postgres";

type CountRow = { count: number | bigint | string };

type MapProbe = {
  table: string;
  direct_host_email_count: number;
  direct_active_host_email_count: number;
  active_host_rows_for_email: number;
  shortid_match_count: number;
  total_count: number;
  included: boolean;
  error?: string;
};

function toCount(value: number | bigint | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

// GET /api/admin/debug/postgres-host-map-lookup?email=foo@bar.com
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

  const probes: Array<{
    table: string;
    hostTableSql: string;
  }> = [
    {
      table: "mission.host_prtcpnt_map_nonindia_nu",
      hostTableSql: "mission.webex_hosts_non_india",
    },
    {
      table: "mission.host_prtcpnt_map_nonindia_gp",
      hostTableSql: "mission.webex_hosts_non_india_gp",
    },
    {
      table: "mission.host_prtcpnt_map_nonindia_dattap",
      hostTableSql: "mission.webex_hosts_non_india_dattap",
    },
    {
      table: "mission.host_prtcpnt_map_nonindia_nu_overages",
      hostTableSql: "mission.webex_hosts_non_india",
    },
    {
      table: "mission.host_prtcpnt_map_nonindia_gp_overages",
      hostTableSql: "mission.webex_hosts_non_india_gp",
    },
    {
      table: "mission.host_prtcpnt_map_crossregion",
      hostTableSql: "mission.webex_hosts_non_india_gp", // short-id match checks GP/non-India families
    },
    {
      table: "vrindavan.host_prtcpnt_map_india",
      hostTableSql: "vrindavan.webex_hosts_india",
    },
    {
      table: "vrindavan.host_prtctpnt_map_india_overages",
      hostTableSql: "vrindavan.webex_hosts_india",
    },
  ];

  const results: MapProbe[] = [];
  for (const probe of probes) {
    try {
      const [directRows, shortRows] = await Promise.all([
        postgres.$queryRawUnsafe<CountRow[]>(
          `
          SELECT COUNT(*)::int AS count
          FROM ${probe.table} m
          WHERE lower(btrim(m.host_email_id::text)) = $1
          `,
          email,
        ),
        postgres.$queryRawUnsafe<CountRow[]>(
          `
          SELECT COUNT(*)::int AS count
          FROM ${probe.table} m
          WHERE lower(btrim(m.host_email_id::text)) = $1
            AND EXISTS (
              SELECT 1
              FROM ${probe.hostTableSql} h
              WHERE lower(btrim(h.host_email_id::text)) = lower(btrim(m.host_email_id::text))
                AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
            )
          `,
          email,
        ),
        postgres.$queryRawUnsafe<CountRow[]>(
          `
          SELECT COUNT(*)::int AS count
          FROM ${probe.hostTableSql} h
          WHERE lower(btrim(h.host_email_id::text)) = $1
            AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
          `,
          email,
        ),
        postgres.$queryRawUnsafe<CountRow[]>(
          `
          SELECT COUNT(*)::int AS count
          FROM ${probe.table} m
          WHERE EXISTS (
            SELECT 1
            FROM ${probe.hostTableSql} h
            WHERE lower(btrim(h.host_email_id::text)) = $1
              AND btrim(COALESCE(h.webex_active_ind::text, '')) = 'Y'
              AND lower(regexp_replace(btrim(h.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
                  = lower(regexp_replace(btrim(m.host_unq_shortid::text), '^(CMSG|CMSD|CMSI|CMSJ|CMS)_', '', 'i'))
          )
          `,
          email,
        ),
      ]);

      const direct = toCount(directRows[0]?.count);
      const directActive = toCount(directRows[1]?.count);
      const activeHostRows = toCount(directRows[2]?.count);
      const shortid = toCount(shortRows[0]?.count);
      const total = Math.max(directActive, shortid);
      results.push({
        table: probe.table,
        direct_host_email_count: direct,
        direct_active_host_email_count: directActive,
        active_host_rows_for_email: activeHostRows,
        shortid_match_count: shortid,
        total_count: total,
        included: total > 0,
      });
    } catch (error) {
      results.push({
        table: probe.table,
        direct_host_email_count: 0,
        direct_active_host_email_count: 0,
        active_host_rows_for_email: 0,
        shortid_match_count: 0,
        total_count: 0,
        included: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const includedTables = results.filter((r) => r.included).map((r) => r.table);

  return NextResponse.json({
    email,
    included_in_any_map_table: includedTables.length > 0,
    included_tables: includedTables,
    map_tables: results,
  });
}
