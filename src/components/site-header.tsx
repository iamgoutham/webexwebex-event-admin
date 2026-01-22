import Link from "next/link";
import { Role } from "@prisma/client";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";

export default async function SiteHeader() {
  const session = await getServerAuthSession();
  const user = session?.user;

  return (
    <header className="border-b border-[#5c2a2d]/60 bg-[#3b1a1f] text-[#fbe9c6]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            Webex Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[#fbe9c6]/70">
            <Link href="/dashboard" className="hover:text-[#fbe9c6]">
              Dashboard
            </Link>
            {user?.role === Role.ADMIN || user?.role === Role.SUPERADMIN ? (
              <>
                <Link href="/dashboard/admin" className="hover:text-[#fbe9c6]">
                  Admin
                </Link>
                <Link href="/dashboard/uploads" className="hover:text-[#fbe9c6]">
                  Uploads
                </Link>
              </>
            ) : null}
            {user?.role === Role.SUPERADMIN ? (
              <Link
                href="/dashboard/superadmin"
                className="hover:text-[#fbe9c6]"
              >
                SuperAdmin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="text-right text-xs text-[#fbe9c6]/60">
              <div className="font-medium text-[#fbe9c6]">{user.email}</div>
              <div>
                {user.role}
                {user.tenantId ? ` • ${user.tenantId.slice(0, 8)}` : ""}
              </div>
            </div>
          ) : (
            <span className="text-xs text-[#fbe9c6]/60">
              Sign in to manage tenants
            </span>
          )}
          <AuthButtons isAuthenticated={!!user} variant="dark" />
        </div>
      </div>
    </header>
  );
}
