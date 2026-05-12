import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { createRoomCode, createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const alias = String(body.playerName ?? session.displayName).trim().slice(0, 20) || session.displayName;
  const fighterId = String(body.fighterId ?? "morana");
  const roomCode = createRoomCode();
  const token = await createSessionToken({
    roomCode,
    role: "host",
    playerName: alias,
    fighterId,
    accountId: session.accountId,
    discordUserId: session.discordUserId,
    alias,
  });

  return NextResponse.json({
    roomCode,
    token,
    role: "host",
    fighterId,
    playerName: alias,
  });
}
