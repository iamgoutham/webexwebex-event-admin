"use client";

import { displayParticipantListRow } from "@/lib/participant-display";

type Invitee = { email?: string; phone?: string; name?: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openEmailsPopup(invitees: Invitee[]) {
  const emails = invitees.map((p) => (p.email ?? "").trim()).filter(Boolean);
  const content = escapeHtml(emails.join(", "));
  const win = window.open("", "_blank", "width=600,height=400,scrollbars=yes");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invitee emails</title></head><body style="margin:0;background:#fff4df;color:#3b1a1f;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><div style="padding:1rem 1.25rem;"><h1 style="margin:0 0 .75rem 0;font-size:1rem;color:#8a2f2a;">Invitee emails</h1><div style="border:1px solid #e5c18e;background:#fff9ef;border-radius:12px;padding:.875rem;white-space:pre-wrap;word-break:break-all;line-height:1.5;">${content}</div></div></body></html>`
  );
  win.document.close();
}

function openTablePopup(invitees: Invitee[]) {
  const rows = invitees.map((p) => displayParticipantListRow(p));
  const tableRows = rows
    .map((r) => {
      return `<tr><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.phone)}</td><td>${escapeHtml(r.name)}</td></tr>`;
    })
    .join("");
  const win = window.open("", "_blank", "width=720,height=400,scrollbars=yes");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Participant Details</title><style>body{margin:0;background:#fff4df;color:#3b1a1f;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif} .wrap{padding:1rem 1.25rem} h1{margin:0 0 .75rem 0;font-size:1.05rem;font-weight:700;color:#8a2f2a} .table-wrap{border:1px solid #e5c18e;background:#fff9ef;border-radius:12px;overflow:hidden} table{border-collapse:collapse;width:100%} th,td{border-bottom:1px solid #e5c18e;padding:8px 10px;text-align:left;font-size:12px} th{background:#f3d6a3;color:#8a5b44;text-transform:uppercase;letter-spacing:.02em} td{color:#6b4e3d} tbody tr:last-child td{border-bottom:none}</style></head><body><div class="wrap"><h1>Participant Details</h1><div class="table-wrap"><table><thead><tr><th>Email</th><th>Phone</th><th>Name</th></tr></thead><tbody>${tableRows}</tbody></table></div></div></body></html>`
  );
  win.document.close();
}

export default function ParticipantLinks({
  invitees,
}: {
  invitees: Invitee[];
}) {
  if (!Array.isArray(invitees) || invitees.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[#6b4e3d]">
        {invitees.length} invitee
        {invitees.length !== 1 ? "s" : ""}
      </span>
      <button
        type="button"
        onClick={() => openEmailsPopup(invitees)}
        className="rounded border border-[#7a3b2a]/50 px-2 py-1 font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a] hover:underline"
      >
        Emails (comma-separated)
      </button>
      <button
        type="button"
        onClick={() => openTablePopup(invitees)}
        className="rounded border border-[#7a3b2a]/50 px-2 py-1 font-bold text-[#3b1a1f] transition hover:border-[#7a3b2a] hover:underline"
      >
        Participant Details
      </button>
    </div>
  );
}
