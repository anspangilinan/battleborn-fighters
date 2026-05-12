import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const alias = String(body.playerName ?? session.displayName).trim().slice(0, 20) || session.displayName;
  const fighterId = String(body.fighterId ?? "digv");
  const roomCode = String(body.roomCode ?? "").trim().toUpperCase();

  if (!roomCode) {
    return NextResponse.json({ error: "Room code is required." }, { status: 400 });
  }

  const token = await createSessionToken({
    roomCode,
    role: "guest",
    playerName: alias,
    fighterId,
    accountId: session.accountId,
    discordUserId: session.discordUserId,
    alias,
  });

  return NextResponse.json({
    roomCode,
    token,
    role: "guest",
    fighterId,
    playerName: alias,
  });
}
