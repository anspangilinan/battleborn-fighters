import { NextResponse } from "next/server";

import { createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();
  const playerName = String(body.playerName ?? "Guest").trim().slice(0, 20) || "Guest";
  const fighterId = String(body.fighterId ?? "digv");
  const roomCode = String(body.roomCode ?? "").trim().toUpperCase();

  if (!roomCode) {
    return NextResponse.json({ error: "Room code is required." }, { status: 400 });
  }

  const token = await createSessionToken({ roomCode, role: "guest", playerName, fighterId });

  return NextResponse.json({
    roomCode,
    token,
    role: "guest",
    fighterId,
    playerName,
  });
}
