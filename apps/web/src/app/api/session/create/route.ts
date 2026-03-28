import { NextResponse } from "next/server";

import { createRoomCode, createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();
  const playerName = String(body.playerName ?? "Host").trim().slice(0, 20) || "Host";
  const fighterId = String(body.fighterId ?? "morana");
  const roomCode = createRoomCode();
  const token = await createSessionToken({ roomCode, role: "host", playerName, fighterId });

  return NextResponse.json({
    roomCode,
    token,
    role: "host",
    fighterId,
    playerName,
  });
}
