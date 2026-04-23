import { Prisma, type PrismaClient as PostgresPrismaClient } from "@/generated/postgres-client";

/**
 * Keeps `mission.host_grid_map` in sync when grid rows/cols are set in the admin app
 * (profile or sheet import). Table is @@ignore in Prisma — use raw SQL.
 */
export async function syncMissionHostGridMap(
  postgres: PostgresPrismaClient,
  hostEmailRaw: string,
  gridRows: number,
  gridCols: number,
): Promise<boolean> {
  const hostEmail = hostEmailRaw.trim().toLowerCase();
  if (!hostEmail) return false;

  const gridMaxLayoutVal = gridRows * gridCols;

  try {
    const updated = await postgres.$executeRaw(Prisma.sql`
      UPDATE mission.host_grid_map
      SET
        grid_rows = ${gridRows},
        grid_cols = ${gridCols},
        grid_max_layout_val = ${gridMaxLayoutVal}
      WHERE lower(btrim(host_email_id::text)) = ${hostEmail}
    `);

    if (updated === 0) {
      await postgres.$executeRaw(Prisma.sql`
        INSERT INTO mission.host_grid_map (
          host_email_id,
          grid_rows,
          grid_cols,
          grid_max_layout_val
        )
        VALUES (${hostEmail}, ${gridRows}, ${gridCols}, ${gridMaxLayoutVal})
      `);
    }
    return true;
  } catch (err) {
    console.warn("[host-grid-map-sync] mission.host_grid_map sync failed:", err);
    return false;
  }
}
