/**
 * Shared formatting for participant lists (confirmation email, meetings UI).
 * Missing phone/name use an em dash, matching the confirm-registration email body.
 */
export function displayParticipantListRow(p: {
  email?: string;
  phone?: string | null;
  name?: string | null;
}): { email: string; phone: string; name: string } {
  const email = (p.email ?? "").trim();
  const phoneRaw =
    p.phone == null || p.phone === undefined ? "" : String(p.phone).trim();
  const nameRaw =
    p.name == null || p.name === undefined ? "" : String(p.name).trim();
  return {
    email,
    phone: phoneRaw || "—",
    name: nameRaw || "—",
  };
}
