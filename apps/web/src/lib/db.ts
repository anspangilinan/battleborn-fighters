import { neon } from "@neondatabase/serverless";

export interface MatchReportInput {
  roomCode: string;
  winnerSlot: 1 | 2 | null;
  players: Array<{
    slot: 1 | 2;
    name: string;
    fighterId: string;
  }>;
  summary: {
    rounds: number;
    events: string[];
  };
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
    create table if not exists player_profiles (
      id bigserial primary key,
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
      winner_name text,
      loser_name text,
      summary jsonb not null,
      played_at timestamptz not null default now()
    );
  `;
}

export async function persistMatchReport(input: MatchReportInput) {
  const sql = getSql();
  if (!sql) {
    return { persisted: false, reason: "DATABASE_URL is not configured." };
  }

  await ensureSchema(sql as ReturnType<typeof neon>);

  const [playerOne, playerTwo] = input.players;
  await sql`
    insert into player_profiles (display_name)
    values (${playerOne.name}), (${playerTwo.name})
    on conflict (display_name) do update
      set updated_at = now()
  `;

  let winnerName: string | null = null;
  let loserName: string | null = null;

  if (input.winnerSlot) {
    winnerName = input.players.find((player) => player.slot === input.winnerSlot)?.name ?? null;
    loserName = input.players.find((player) => player.slot !== input.winnerSlot)?.name ?? null;
  }

  if (winnerName && loserName) {
    await sql`update player_profiles set rating = rating + 16, updated_at = now() where display_name = ${winnerName}`;
    await sql`update player_profiles set rating = greatest(100, rating - 12), updated_at = now() where display_name = ${loserName}`;
  }

  await sql`
    insert into match_history (room_code, winner_slot, winner_name, loser_name, summary)
    values (${input.roomCode}, ${input.winnerSlot}, ${winnerName}, ${loserName}, ${JSON.stringify(input.summary)}::jsonb)
  `;

  return { persisted: true };
}
