import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-lg sm:p-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-[#6b4e3d]">
        Authenticate with Webex to access the tenant dashboards.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <AuthButtons
          isAuthenticated={!!session?.user}
          variant="brand"
          providerId={providerId}
        />
        <Link href="/" className="text-sm text-[#6b4e3d] hover:text-[#3b1a1f]">
          Back to home
        </Link>
      </div>
    </div>
  );
}
