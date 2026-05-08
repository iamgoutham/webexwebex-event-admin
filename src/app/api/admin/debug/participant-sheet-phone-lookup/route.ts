import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiAuth } from "@/lib/api-guards";
import { getPostgresPrisma } from "@/lib/prisma-postgres";
import { lookupJoinCandidatesByPhoneFromParticipantSheetSet } from "@/lib/public-join";

type CountRow = { count: number };
type SampleRow = {
  participant_name: string | null;
  participant_email: string | null;
  host_name: string | null;
  host_email: string | null;
  meeting_link: string | null;
  prtcpnt_phone_no: string | null;
  host_phone_no: string | null;
};

const normalizeDigits = (value: string) => value.replace(/[^0-9]/g, "");

// GET /api/admin/debug/participant-sheet-phone-lookup?phone=9086255967
export async function GET(request: NextRequest) {
  const { response } = await requireApiAuth([Role.ADMIN, Role.SUPERADMIN]);
  if (response) return response;

  const phoneRaw = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const digits = normalizeDigits(phoneRaw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : "";
  if (!digits || digits.length < 10) {
    return NextResponse.json(
      { error: "Query param 'phone' must contain at least 10 digits." },
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
    const [counts, samples, candidates] = await Promise.all([
      postgres.$queryRaw<CountRow[]>`
        WITH rows AS (
          SELECT to_jsonb(s) AS j
          FROM mission.participant_data_sheet_set s
        )
        SELECT
          COUNT(*) FILTER (
            WHERE regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
               OR right(regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
               OR regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
               OR right(regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
          )::int AS count
        FROM rows
      `,
      postgres.$queryRaw<SampleRow[]>`
        SELECT
          NULLIF(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_name', to_jsonb(s)->>'participant_name')), '') AS participant_name,
          NULLIF(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_email_id', to_jsonb(s)->>'participant_email')), '') AS participant_email,
          NULLIF(btrim(to_jsonb(s)->>'host_name'), '') AS host_name,
          NULLIF(btrim(to_jsonb(s)->>'host_email_id'), '') AS host_email,
          NULLIF(btrim(COALESCE(
            to_jsonb(s)->>'webex_mtng_link',
            to_jsonb(s)->>'webex_meeting_link'
          )), '') AS meeting_link,
          NULLIF(btrim(to_jsonb(s)->>'prtcpnt_phone_no'), '') AS prtcpnt_phone_no,
          NULLIF(btrim(to_jsonb(s)->>'host_phone_no'), '') AS host_phone_no
        FROM mission.participant_data_sheet_set s
        WHERE (
          regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(to_jsonb(s)->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
          OR regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
          OR right(regexp_replace(btrim(COALESCE(to_jsonb(s)->>'host_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}
        )
        LIMIT 25
      `,
      lookupJoinCandidatesByPhoneFromParticipantSheetSet(postgres, digits),
    ]);

    const countByKeyRows = await postgres.$queryRaw<
      Array<{ key: string; count: number }>
    >`
      WITH rows AS (
        SELECT to_jsonb(s) AS j
        FROM mission.participant_data_sheet_set s
      ),
      matches AS (
        SELECT
          (regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
            OR right(regexp_replace(btrim(COALESCE(j->>'prtcpnt_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}) AS m_prtcpnt_phone_no,
          (regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g') = ${digits}
            OR right(regexp_replace(btrim(COALESCE(j->>'host_phone_no', '')), '[^0-9]', '', 'g'), 10) = ${last10}) AS m_host_phone_no
        FROM rows
      )
      SELECT 'prtcpnt_phone_no'::text AS key, COUNT(*)::int AS count FROM matches WHERE m_prtcpnt_phone_no
      UNION ALL
      SELECT 'host_phone_no'::text AS key, COUNT(*)::int AS count FROM matches WHERE m_host_phone_no
    `;

    return NextResponse.json({
      phone: phoneRaw,
      normalized: { digits, last10 },
      matched_row_count: counts[0]?.count ?? samples.length,
      matched_by_key: countByKeyRows,
      sample_rows: samples,
      candidate_count: candidates.length,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to query mission.participant_data_sheet_set.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
