import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-10 text-[#3b1a1f] shadow-lg">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="mt-2 text-sm text-[#6b4e3d]">
        Your account does not have access to this area. Contact a SuperAdmin if
        you need elevated permissions.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-[#7a3b2a]/50 px-4 py-2 text-sm font-medium text-[#3b1a1f] transition hover:border-[#7a3b2a]"
      >
        Return home
      </Link>
    </div>
  );
}
