"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonsProps = {
  isAuthenticated: boolean;
};

export default function AuthButtons({ isAuthenticated }: AuthButtonsProps) {
  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium transition hover:border-white/40"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("webex", { callbackUrl: "/dashboard" })}
      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
    >
      Sign in with Webex
    </button>
  );
}
