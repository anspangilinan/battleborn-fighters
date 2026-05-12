import { neon } from "@neondatabase/serverless";

export interface MatchReportInput {
  roomCode: string;
  winnerSlot: 1 | 2 | null;
  players: Array<{
    slot: 1 | 2;
    alias: string;
    accountId: string | null;
    fighterId: string;
  }>;
  summary: {
    rounds: number;
    events: string[];
  };
}

export interface AuthAccountRecord {
  id: string;
  discordUserId: string;
  displayName: string;
}

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }
  return neon(databaseUrl);
}

async function ensureSchema(sql: ReturnType<typeof neon>) {
  await sql`
    create table if not exists auth_accounts (
      id text primary key,
      discord_user_id text unique not null,
      display_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;
  await sql`
    create table if not exists auth_alias_history (
      id bigserial primary key,
      account_id text not null references auth_accounts(id) on delete cascade,
      alias text not null,
      created_at timestamptz not null default now()
    );
  `;
  await sql`
    create table if not exists player_profiles (
      id bigserial primary key,
      account_id text unique references auth_accounts(id) on delete set null,
      display_name text unique not null,
      rating integer not null default 1200,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;
  await sql`
    create table if not exists match_history (
      id bigserial primary key,
      room_code text not null,
      winner_slot integer,
      winner_alias text,
      loser_alias text,
      winner_account_id text references auth_accounts(id) on delete set null,
      loser_account_id text references auth_accounts(id) on delete set null,
      summary jsonb not null,
      played_at timestamptz not null default now()
    );
  `;

  await sql`
    alter table player_profiles add column if not exists account_id text references auth_accounts(id) on delete set null
  `;
  await sql`
    alter table match_history add column if not exists winner_alias text
  `;
  await sql`
    alter table match_history add column if not exists loser_alias text
  `;
  await sql`
    alter table match_history add column if not exists winner_account_id text references auth_accounts(id) on delete set null
  `;
  await sql`
    alter table match_history add column if not exists loser_account_id text references auth_accounts(id) on delete set null
  `;
}

export async function ensureAuthSchema() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  await ensureSchema(sql as ReturnType<typeof neon>);
}

export async function findAccountByDiscordUserId(discordUserId: string): Promise<AuthAccountRecord | null> {
  const sql = getSql();
  if (!sql) {
    return null;
  }
  await ensureSchema(sql as ReturnType<typeof neon>);
  const rows = await sql`
    select id::text as id, discord_user_id as "discordUserId", display_name as "displayName"
    from auth_accounts
    where discord_user_id = ${discordUserId}
    limit 1
  ` as unknown as AuthAccountRecord[];
  return rows[0] ?? null;
}

export async function upsertAccount(input: { discordUserId: string; displayName: string }): Promise<AuthAccountRecord> {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  await ensureSchema(sql as ReturnType<typeof neon>);
  const rows = await sql`
    insert into auth_accounts (id, discord_user_id, display_name)
    values (${`discord:${input.discordUserId}`}, ${input.discordUserId}, ${input.displayName})
    on conflict (discord_user_id) do update
      set display_name = excluded.display_name,
          updated_at = now()
    returning id::text as id, discord_user_id as "discordUserId", display_name as "displayName"
  ` as unknown as AuthAccountRecord[];
  return rows[0]!;
}

export async function upsertAlias(accountId: string, alias: string) {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  await ensureSchema(sql as ReturnType<typeof neon>);
  await sql`
    insert into auth_alias_history (account_id, alias)
    values (${accountId}, ${alias})
  `;
}

export async function persistMatchReport(input: MatchReportInput) {
  const sql = getSql();
  if (!sql) {
    return { persisted: false, reason: "DATABASE_URL is not configured." };
  }

  await ensureSchema(sql as ReturnType<typeof neon>);

  const [playerOne, playerTwo] = input.players;
  for (const player of [playerOne, playerTwo]) {
    const alias = player.alias.trim().slice(0, 20) || "Player";
    if (player.accountId) {
      await sql`
        insert into player_profiles (account_id, display_name)
        values (${player.accountId}, ${alias})
        on conflict (account_id) do update
          set display_name = excluded.display_name,
              updated_at = now()
      `;
    } else {
      await sql`
        insert into player_profiles (display_name)
        values (${alias})
        on conflict (display_name) do update
          set updated_at = now()
      `;
    }
  }

  let winnerAlias: string | null = null;
  let loserAlias: string | null = null;
  let winnerAccountId: string | null = null;
  let loserAccountId: string | null = null;

  if (input.winnerSlot) {
    const winner = input.players.find((player) => player.slot === input.winnerSlot) ?? null;
    const loser = input.players.find((player) => player.slot !== input.winnerSlot) ?? null;
    winnerAlias = winner?.alias ?? null;
    loserAlias = loser?.alias ?? null;
    winnerAccountId = winner?.accountId ?? null;
    loserAccountId = loser?.accountId ?? null;
  }

  if (winnerAlias && loserAlias) {
    if (winnerAccountId && loserAccountId) {
      await sql`update player_profiles set rating = rating + 16, updated_at = now() where account_id = ${winnerAccountId}`;
      await sql`update player_profiles set rating = greatest(100, rating - 12), updated_at = now() where account_id = ${loserAccountId}`;
    } else {
      await sql`update player_profiles set rating = rating + 16, updated_at = now() where display_name = ${winnerAlias}`;
      await sql`update player_profiles set rating = greatest(100, rating - 12), updated_at = now() where display_name = ${loserAlias}`;
    }
  }

  await sql`
    insert into match_history (room_code, winner_slot, winner_alias, loser_alias, winner_account_id, loser_account_id, summary)
    values (
      ${input.roomCode},
      ${input.winnerSlot},
      ${winnerAlias},
      ${loserAlias},
      ${winnerAccountId},
      ${loserAccountId},
      ${JSON.stringify(input.summary)}::jsonb
    )
  `;

  return { persisted: true };
}
