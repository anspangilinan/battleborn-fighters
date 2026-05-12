import { NextResponse } from "next/server";

import { createSessionForDiscordUser, exchangeDiscordCode, fetchDiscordUser, validateOauthState } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const nextPath = await validateOauthState(state);

  if (!code || !nextPath) {
    return NextResponse.redirect(new URL("/online?auth=failed", url));
  }

  try {
    const tokenResponse = await exchangeDiscordCode(code);
    const user = await fetchDiscordUser(tokenResponse.access_token);
    await createSessionForDiscordUser(user);
    return NextResponse.redirect(new URL(nextPath, url));
  } catch {
    return NextResponse.redirect(new URL("/online?auth=failed", url));
  }
}
