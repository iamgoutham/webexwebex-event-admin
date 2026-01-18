import Link from "next/link";
import AuthButtons from "@/components/auth-buttons";
import { getServerAuthSession } from "@/lib/session";

export default async function SignInPage() {
  const session = await getServerAuthSession();

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-10 text-white">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-white/70">
        Authenticate with Webex to access the tenant dashboards.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <AuthButtons isAuthenticated={!!session?.user} />
        <Link href="/" className="text-sm text-white/70 hover:text-white">
          Back to home
        </Link>
      </div>
    </div>
  );
}
