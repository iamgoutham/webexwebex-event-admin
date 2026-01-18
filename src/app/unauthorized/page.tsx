import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-10 text-white">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="mt-2 text-sm text-white/70">
        Your account does not have access to this area. Contact a SuperAdmin if
        you need elevated permissions.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
      >
        Return home
      </Link>
    </div>
  );
}
