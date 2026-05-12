import { NextResponse } from "next/server";

import { createDiscordLoginUrl } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") ?? "/online";
  const loginUrl = await createDiscordLoginUrl(nextPath.startsWith("/") ? nextPath : "/online");
  return NextResponse.redirect(loginUrl);
}
