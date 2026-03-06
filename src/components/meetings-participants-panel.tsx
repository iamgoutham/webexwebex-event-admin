"use client";

import { useState } from "react";
import MeetingExceptionRequest from "@/components/meeting-exception-request";
import ParticipantsListButton from "@/components/participants-list-button";

interface Props {
  isAdmin: boolean;
  currentUserId: string;
}

export default function MeetingsParticipantsPanel({
  isAdmin,
  currentUserId,
}: Props) {
  const [emails, setEmails] = useState("");

  const handleAddEmails = (newEmails: string[]) => {
    if (!newEmails.length) return;
    const existing = emails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter(Boolean);
    const lower = new Set(existing.map((e) => e.toLowerCase()));

    const merged = [...existing];
    for (const e of newEmails) {
      const val = e.trim();
      if (!val) continue;
      const key = val.toLowerCase();
      if (!lower.has(key)) {
        lower.add(key);
        merged.push(val);
      }
    }

    setEmails(merged.join("\n"));
  };

  return (
    <div className="mt-4 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <MeetingExceptionRequest
          standalone
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          emailsValue={emails}
          onEmailsChange={setEmails}
        />
      </div>
      <ParticipantsListButton onAddEmails={handleAddEmails} />
    </div>
  );
}

