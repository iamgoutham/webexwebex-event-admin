import { prisma } from "@/lib/prisma";
import type {
  ParticipantSyncResult,
  WebexMeeting,
  WebexInvitee,
} from "./types";

// ---------------------------------------------------------------------------
// Participant Sync — Pulls meeting invitees from FastAPI backend
// ---------------------------------------------------------------------------
//
// The FastAPI backend at ADMINSITE_URL has endpoints:
//   GET /clients                        → { clients: string[] }
//   GET /meetings/users?client_name=X   → { users: [...] }
//   GET /meetings/user/{email}/full?client_name=X → { meetings: [...invitees] }
//
// Sync flow:
//   1. Fetch all clients from FastAPI
//   2. For each client, fetch all department users (hosts)
//   3. For each host, fetch their meetings with full invitee details
//   4. Upsert each invitee as a Participant in our DB
//
// This is triggered by the "Sync Participants" button on the admin dashboard.
// ---------------------------------------------------------------------------

const ADMIN_API_URL = process.env.ADMINSITE_URL ?? "http://localhost:4000";

interface FastAPIUserResponse {
  client: string;
  department: string;
  user_count: number;
  users: Array<{ email: string; invitePending: boolean }>;
}

interface FastAPIMeetingFullResponse {
  client: string;
  email: string;
  meeting_count: number;
  meetings: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    invitees: Array<{
      name: string;
      email: string;
      role: string;
      phone: string;
    }>;
  }>;
}

interface FastAPIClientsResponse {
  clients: string[];
}

// ---------------------------------------------------------------------------
// Sync all participants across all clients
// ---------------------------------------------------------------------------

/**
 * Sync participants from the Webex FastAPI backend for all clients.
 * Optionally filter to a specific tenantId (maps to a client name).
 */
export async function syncParticipants(
  tenantId?: string | null,
): Promise<ParticipantSyncResult> {
  const result: ParticipantSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Fetch available clients
    const clientsRes = await fetch(`${ADMIN_API_URL}/clients`, {
      cache: "no-store",
    });
    if (!clientsRes.ok) {
      result.errors.push(
        `Failed to fetch clients: ${clientsRes.status} ${clientsRes.statusText}`,
      );
      return result;
    }
    const clientsData = (await clientsRes.json()) as FastAPIClientsResponse;
    const clientNames = clientsData.clients;

    // If tenantId is given, map it to a client name
    let targetClients = clientNames;
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });
      if (tenant) {
        // Try to match tenant name/slug to a FastAPI client name
        const match = clientNames.find(
          (c) =>
            c.toLowerCase() === tenant.name.toLowerCase() ||
            c.toLowerCase() === tenant.slug.toLowerCase(),
        );
        if (match) {
          targetClients = [match];
        } else {
          result.errors.push(
            `Tenant "${tenant.name}" does not match any FastAPI client`,
          );
          return result;
        }
      }
    }

    // 2. Process each client
    for (const clientName of targetClients) {
      try {
        await syncClientParticipants(clientName, result);
      } catch (err) {
        result.errors.push(
          `Error syncing client ${clientName}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync participants for a single client
// ---------------------------------------------------------------------------

async function syncClientParticipants(
  clientName: string,
  result: ParticipantSyncResult,
): Promise<void> {
  // Fetch all department users (hosts) for this client
  const usersRes = await fetch(
    `${ADMIN_API_URL}/meetings/users?client_name=${encodeURIComponent(clientName)}`,
    { cache: "no-store" },
  );

  if (!usersRes.ok) {
    result.errors.push(
      `Failed to fetch users for ${clientName}: ${usersRes.status}`,
    );
    return;
  }

  const usersData = (await usersRes.json()) as FastAPIUserResponse;
  const hostEmails = usersData.users.map((u) => u.email);

  // Find the tenant in our DB that matches this client
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { name: { equals: clientName } },
        { slug: { equals: clientName.toLowerCase() } },
      ],
    },
    select: { id: true },
  });

  const tenantId = tenant?.id ?? null;

  // Collect all unique participant emails from all meetings
  const seen = new Set<string>();

  // Process hosts in batches to avoid overwhelming the FastAPI
  const BATCH_SIZE = 5;
  for (let i = 0; i < hostEmails.length; i += BATCH_SIZE) {
    const batch = hostEmails.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (hostEmail) => {
        const meetingsRes = await fetch(
          `${ADMIN_API_URL}/meetings/user/${encodeURIComponent(hostEmail)}/full?client_name=${encodeURIComponent(clientName)}`,
          { cache: "no-store" },
        );

        if (!meetingsRes.ok) {
          result.errors.push(
            `Failed to fetch meetings for ${hostEmail}: ${meetingsRes.status}`,
          );
          return;
        }

        const meetingsData =
          (await meetingsRes.json()) as FastAPIMeetingFullResponse;

        for (const meeting of meetingsData.meetings) {
          for (const invitee of meeting.invitees) {
            const email = invitee.email?.trim().toLowerCase();
            if (!email || email === "n/a" || seen.has(email)) continue;

            // Skip if invitee is a host (they're already in the User table)
            if (hostEmails.includes(email)) {
              result.skipped++;
              seen.add(email);
              continue;
            }

            seen.add(email);

            try {
              // Upsert: create or update participant
              const existing = await prisma.participant.findFirst({
                where: { email, tenantId },
              });

              if (existing) {
                await prisma.participant.update({
                  where: { id: existing.id },
                  data: {
                    name: invitee.name || existing.name,
                    phone: invitee.phone || existing.phone,
                  },
                });
                result.updated++;
              } else {
                await prisma.participant.create({
                  data: {
                    email,
                    name: invitee.name || null,
                    phone: invitee.phone || null,
                    tenantId,
                    optedOut: false,
                  },
                });
                result.created++;
              }
            } catch (err) {
              // Unique constraint race condition — just count as skipped
              result.skipped++;
            }
          }
        }
      }),
    );

    // Log any unhandled rejections
    for (const r of batchResults) {
      if (r.status === "rejected") {
        result.errors.push(`Batch error: ${String(r.reason)}`);
      }
    }
  }
}
