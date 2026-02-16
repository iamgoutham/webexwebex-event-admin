"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Quick-send buttons for common event-day broadcasts
// ---------------------------------------------------------------------------

type QuickState =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "success"; key: string; message: string }
  | { status: "error"; key: string; message: string };

interface QuickAction {
  key: string;
  label: string;
  emoji: string;
  title: string;
  body: string;
  target: "ALL" | "HOSTS_ONLY" | "PARTICIPANTS_ONLY";
  channels: string[];
  confirmMessage: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "event-live",
    label: "Event is LIVE",
    emoji: "🔴",
    title: "Event is LIVE — Join Now!",
    body: "The Gita Chanting event has started! Please join your assigned Webex meeting immediately. Your host is waiting for you.",
    target: "ALL",
    channels: ["EMAIL", "IN_APP"],
    confirmMessage: "Send 'Event is LIVE' to ALL hosts and participants?",
  },
  {
    key: "reminder-30min",
    label: "30-Min Reminder",
    emoji: "⏰",
    title: "Event starts in 30 minutes",
    body: "The Gita Chanting event begins in 30 minutes. Please prepare your setup and join your Webex meeting on time.",
    target: "ALL",
    channels: ["EMAIL", "IN_APP"],
    confirmMessage: "Send 30-minute reminder to everyone?",
  },
  {
    key: "host-checkin",
    label: "Host Check-in",
    emoji: "📋",
    title: "Host Check-in Required",
    body: "Please confirm you are ready to host your meeting. Log into the portal and check your meeting details. Report any issues immediately.",
    target: "HOSTS_ONLY",
    channels: ["EMAIL", "IN_APP"],
    confirmMessage: "Send check-in request to all hosts?",
  },
  {
    key: "event-complete",
    label: "Event Complete",
    emoji: "✅",
    title: "Event Complete — Thank You!",
    body: "The Gita Chanting event has concluded. Thank you for your participation and dedication. Hari Om!",
    target: "ALL",
    channels: ["EMAIL", "IN_APP"],
    confirmMessage: "Send 'Event Complete' to everyone?",
  },
  {
    key: "emergency",
    label: "Emergency Alert",
    emoji: "🚨",
    title: "Important Update — Please Read",
    body: "An important update regarding the event. Please check the portal for the latest information and follow any new instructions.",
    target: "ALL",
    channels: ["EMAIL", "IN_APP"],
    confirmMessage: "Send emergency alert to ALL hosts and participants?",
  },
];

export default function QuickSendButtons() {
  const [state, setState] = useState<QuickState>({ status: "idle" });

  const handleQuickSend = async (action: QuickAction) => {
    if (!window.confirm(action.confirmMessage)) return;

    setState({ status: "loading", key: action.key });

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          body: action.body,
          target: action.target,
          channels: action.channels,
          tenantId: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        setState({
          status: "error",
          key: action.key,
          message: data.error ?? "Send failed",
        });
        return;
      }

      const data = await res.json();
      setState({
        status: "success",
        key: action.key,
        message: data.message ?? "Sent!",
      });
    } catch (err) {
      setState({
        status: "error",
        key: action.key,
        message: err instanceof Error ? err.message : "Send failed",
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {QUICK_ACTIONS.map((action) => {
        const isLoading =
          state.status === "loading" && state.key === action.key;
        const isSuccess =
          state.status === "success" && state.key === action.key;
        const isError =
          state.status === "error" && state.key === action.key;

        return (
          <div key={action.key} className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => handleQuickSend(action)}
              disabled={state.status === "loading"}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                action.key === "emergency"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-[#3b1a1f] text-[#fbe9c6] hover:bg-[#5c2a2d]"
              }`}
            >
              {isLoading
                ? "Sending..."
                : `${action.emoji} ${action.label}`}
            </button>
            {isSuccess ? (
              <span className="text-xs text-green-700">
                {state.message}
              </span>
            ) : null}
            {isError ? (
              <span className="text-xs text-red-700">{state.message}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
