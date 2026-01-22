import Link from "next/link";
import { Role } from "@prisma/client";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";

export default async function SiteHeader() {
  const session = await getServerAuthSession();
  const user = session?.user;

  return (
    <header className="border-b border-white/10 bg-black text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            Webex Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            {user?.role === Role.ADMIN || user?.role === Role.SUPERADMIN ? (
              <>
                <Link href="/dashboard/admin" className="hover:text-white">
                  Admin
                </Link>
                <Link href="/dashboard/uploads" className="hover:text-white">
                  Uploads
                </Link>
              </>
            ) : null}
            {user?.role === Role.SUPERADMIN ? (
              <Link href="/dashboard/superadmin" className="hover:text-white">
                SuperAdmin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="text-right text-xs text-white/60">
              <div className="font-medium text-white">{user.email}</div>
              <div>
                {user.role}
                {user.tenantId ? ` • ${user.tenantId.slice(0, 8)}` : ""}
              </div>
            </div>
          ) : (
            <span className="text-xs text-white/60">
              Sign in to manage tenants
            </span>
          )}
          <AuthButtons isAuthenticated={!!user} />
        </div>
      </div>
    </header>
  );
}
