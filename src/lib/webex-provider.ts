import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";

export interface WebexProfile {
  id: string;
  emails?: string[];
  displayName?: string;
  avatar?: string;
}

type WebexProviderOptions<P> = OAuthUserConfig<P> & {
  providerId?: string;
  scopes?: string;
};

export default function WebexProvider<P extends WebexProfile>(
  options: WebexProviderOptions<P>,
): OAuthConfig<P> {
  const scope =
    options.scopes ??
    options.authorization?.params?.scope ??
    process.env.WEBEX_SCOPES ??
    "spark:people_read";
  const { providerId, scopes, authorization, ...rest } = options;
  const authParams = authorization?.params ?? {};
  return {
    id: providerId ?? "webex",
    name: options.name ?? "Webex",
    type: "oauth",
    authorization: {
      url: "https://webexapis.com/v1/authorize",
      params: {
        ...authParams,
        scope,
      },
    },
    token: "https://webexapis.com/v1/access_token",
    userinfo: "https://webexapis.com/v1/people/me",
    profile(profile, _tokens) {
      return {
        id: profile.id,
        name: profile.displayName ?? null,
        email: profile.emails?.[0] ?? null,
        image: profile.avatar ?? null,
      };
    },
    ...rest,
  };
}
