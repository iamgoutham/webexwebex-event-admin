"use client";

type Participant = { email?: string; phone?: string; name?: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openEmailsPopup(participants: Participant[]) {
  const emails = participants
    .map((p) => (p.email ?? "").trim())
    .filter(Boolean);
  const content = escapeHtml(emails.join(", "));
  const win = window.open("", "_blank", "width=600,height=400,scrollbars=yes");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Participant emails</title></head><body style="font-family:sans-serif;padding:1rem;white-space:pre-wrap;word-break:break-all;">${content}</body></html>`
  );
  win.document.close();
}

function openTablePopup(participants: Participant[]) {
  const rows = participants.map((p) => ({
    email: (p.email ?? "").trim(),
    phone: (p.phone ?? "").trim(),
  }));
  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.phone)}</td></tr>`
    )
    .join("");
  const win = window.open("", "_blank", "width=600,height=400,scrollbars=yes");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Participants (email, phone)</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f5f5}</style></head><body style="font-family:sans-serif;padding:1rem;"><table><thead><tr><th>Email</th><th>Phone</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`
  );
  win.document.close();
}

export default function ParticipantLinks({
  participants,
}: {
  participants: Participant[];
}) {
  if (!Array.isArray(participants) || participants.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[#6b4e3d]">
        {participants.length} participant
        {participants.length !== 1 ? "s" : ""}
      </span>
      <button
        type="button"
        onClick={() => openEmailsPopup(participants)}
        className="rounded border border-[#7a3b2a]/50 px-2 py-1 font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a] hover:underline"
      >
        Emails (comma-separated)
      </button>
      <button
        type="button"
        onClick={() => openTablePopup(participants)}
        className="rounded border border-[#7a3b2a]/50 px-2 py-1 font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a] hover:underline"
      >
        Table (email, phone)
      </button>
    </div>
  );
}
