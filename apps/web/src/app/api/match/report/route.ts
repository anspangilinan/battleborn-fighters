import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { persistMatchReport } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const hasReporterInPayload = Array.isArray(body.players)
    && body.players.some((player: { accountId?: string | null }) => player.accountId === session.accountId);
  if (!hasReporterInPayload) {
    return NextResponse.json({ error: "Invalid match payload." }, { status: 400 });
  }
  const result = await persistMatchReport(body);
  return NextResponse.json(result);
}
