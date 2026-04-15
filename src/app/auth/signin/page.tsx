import Link from "next/link";
import { redirect } from "next/navigation";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";
import { getTenantConfigFromHeaders } from "@/lib/webex-tenants";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  const tenantConfig = await getTenantConfigFromHeaders();
  const providerId = tenantConfig?.providerId ?? "webex";

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-[#e5c18e] bg-[#fff4df] p-6 text-[#3b1a1f] shadow-lg sm:p-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-[#6b4e3d]">
        Use the button below to sign in to this portal with your Webex account.
        A separate Webex login in another tab does not grant access here until
        you complete sign-in once on this site so we can set your session
        cookie.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <AuthButtons
          isAuthenticated={false}
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
