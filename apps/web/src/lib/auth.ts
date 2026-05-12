import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ensureAuthSchema, findAccountByDiscordUserId, upsertAccount, upsertAlias } from "@/lib/db";

const SESSION_COOKIE_NAME = "bbf_session";
const OAUTH_STATE_COOKIE_NAME = "bbf_oauth_state";
const encoder = new TextEncoder();

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
}

interface AuthSessionPayload extends JWTPayload {
  accountId: string;
  discordUserId: string;
  displayName: string;
}

export interface AuthSession {
  accountId: string;
  discordUserId: string;
  displayName: string;
}

function getAppUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is required.");
  }
  return appUrl;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is required.");
  }
  return encoder.encode(secret);
}

function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Discord OAuth env vars are not configured.");
  }
  return { clientId, clientSecret };
}

function normalizeDisplayName(user: DiscordUserResponse) {
  const preferred = user.global_name?.trim() || user.username.trim();
  return preferred.slice(0, 20) || "Player";
}

export async function createDiscordLoginUrl(nextPath: string) {
  const { clientId } = getDiscordConfig();
  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE_NAME, JSON.stringify({ state, nextPath }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const redirectUri = `${getAppUrl()}/api/auth/discord/callback`;
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${query.toString()}`;
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret } = getDiscordConfig();
  const redirectUri = `${getAppUrl()}/api/auth/discord/callback`;
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`Discord token exchange failed (${response.status}).`);
  }
  return response.json() as Promise<DiscordTokenResponse>;
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Discord user fetch failed (${response.status}).`);
  }
  return response.json() as Promise<DiscordUserResponse>;
}

export async function validateOauthState(providedState: string | null) {
  const store = await cookies();
  const raw = store.get(OAUTH_STATE_COOKIE_NAME)?.value;
  store.delete(OAUTH_STATE_COOKIE_NAME);
  if (!raw || !providedState) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { state: string; nextPath: string };
    if (parsed.state !== providedState) {
      return null;
    }
    return parsed.nextPath || "/online";
  } catch {
    return null;
  }
}

export async function createSessionForDiscordUser(user: DiscordUserResponse) {
  await ensureAuthSchema();
  const displayName = normalizeDisplayName(user);
  const existing = await findAccountByDiscordUserId(user.id);
  const account = existing
    ? existing
    : await upsertAccount({
      discordUserId: user.id,
      displayName,
    });

  if (existing && existing.displayName !== displayName) {
    await upsertAccount({ discordUserId: user.id, displayName });
  }
  await upsertAlias(account.id, displayName);
  const token = await new SignJWT({
    accountId: account.id,
    discordUserId: user.id,
    displayName,
  } satisfies AuthSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { accountId: account.id, discordUserId: user.id, displayName };
}

export async function clearAuthSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    const session = payload as AuthSessionPayload;
    if (!session.accountId || !session.discordUserId || !session.displayName) {
      return null;
    }
    return {
      accountId: session.accountId,
      discordUserId: session.discordUserId,
      displayName: session.displayName,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(nextPath = "/online"): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    redirect(`/api/auth/discord/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}
