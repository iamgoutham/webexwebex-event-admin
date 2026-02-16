import Image from "next/image";
import Link from "next/link";
import { Role } from "@prisma/client";
import AuthButtons from "@/components/auth-buttons";
import NotificationBell from "@/components/notifications/notification-bell";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function SiteHeader() {
  const session = await getServerAuthSession();
  const user = session?.user;
  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <header className="border-b border-[#5c2a2d]/60 bg-[#3b1a1f] text-[#fbe9c6]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-lg font-semibold"
          >
            <Image
              src="/CMW-lamp-logo-1.png"
              alt="Chinmaya Mission West"
              width={58}
              height={58}
              className="h-12 w-auto sm:h-14"
              priority
            />
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-[#fbe9c6]/70">
            <Link href="/dashboard" className="hover:text-[#fbe9c6]">
              Dashboard
            </Link>
            {user ? (
              <Link href="/dashboard/uploads" className="hover:text-[#fbe9c6]">
                Uploads
              </Link>
            ) : null}
            {user ? (
              <Link href="/dashboard/meetings" className="hover:text-[#fbe9c6]">
                Meetings
              </Link>
            ) : null}
            {user?.role === Role.ADMIN || user?.role === Role.SUPERADMIN ? (
              <Link href="/dashboard/admin" className="hover:text-[#fbe9c6]">
                Admin
              </Link>
            ) : null}
            {user?.role === Role.ADMIN || user?.role === Role.SUPERADMIN ? (
              <Link href="/dashboard/admin/broadcast" className="hover:text-[#fbe9c6]">
                Broadcast
              </Link>
            ) : null}
            {user ? (
              <Link href="/dashboard/relay" className="hover:text-[#fbe9c6]">
                Relay
              </Link>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {user ? <NotificationBell /> : null}
          {user ? (
            <div className="text-left text-xs text-[#fbe9c6]/60 sm:text-right">
              <div className="font-medium text-[#fbe9c6]">
                {user.email}
              </div>
            </div>
          ) : (
            <span className="text-xs text-[#fbe9c6]/60">
              Sign in to manage your meetings
            </span>
          )}
          <AuthButtons
            isAuthenticated={!!user}
            variant="dark"
            providerId={providerId}
          />
        </div>
      </div>
    </header>
  );
}
