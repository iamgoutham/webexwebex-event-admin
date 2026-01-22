"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonsProps = {
  isAuthenticated: boolean;
  variant?: "dark" | "brand";
};

const styles = {
  dark: {
    signOut:
      "rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40",
    signIn:
      "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200",
  },
  brand: {
    signOut:
      "rounded-full border border-[#7a3b2a]/40 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]/70",
    signIn:
      "rounded-full bg-[#d8792d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b86425]",
  },
};

export default function AuthButtons({
  isAuthenticated,
  variant = "dark",
}: AuthButtonsProps) {
  const classes = styles[variant];
  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className={classes.signOut}
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("webex", { callbackUrl: "/dashboard" })}
      className={classes.signIn}
    >
      Sign in with Webex
    </button>
  );
}
