import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";

export interface WebexProfile {
  id: string;
  emails?: string[];
  displayName?: string;
  avatar?: string;
}

export default function WebexProvider<P extends WebexProfile>(
  options: OAuthUserConfig<P>,
): OAuthConfig<P> {
  return {
    id: "webex",
    name: "Webex",
    type: "oauth",
    authorization: {
      url: "https://webexapis.com/v1/authorize",
      params: {
        scope: process.env.WEBEX_SCOPES ?? "spark:people_read",
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
    ...options,
  };
}
