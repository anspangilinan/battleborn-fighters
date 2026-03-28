import { SignJWT, type JWTPayload } from "jose";

const encoder = new TextEncoder();

export interface SessionTokenPayload extends JWTPayload {
  roomCode: string;
  role: "host" | "guest";
  playerName: string;
  fighterId: string;
}

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function createSessionToken(payload: SessionTokenPayload) {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret) {
    throw new Error("SESSION_TOKEN_SECRET is required to sign room tokens.");
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(encoder.encode(secret));
}
