export type ArcadeDialogueOutcome = "win" | "lose";

type ArcadeDialogueLines = {
  default: Record<ArcadeDialogueOutcome, string>;
  matchups?: Record<string, Partial<Record<ArcadeDialogueOutcome, string>>>;
};

const defaultArcadeDialogue: Record<ArcadeDialogueOutcome, string> = {
  win: "One more down. Keep them coming.",
  lose: "Not my finish. Run it back.",
};

const arcadeDialogueByFighter: Record<string, ArcadeDialogueLines> = {
  morana: {
    default: {
      win: "Stay cool. The next one won't thaw so easy.",
      lose: "I slipped. That's all this was.",
    },
  },
  mcbalut: {
    default: {
      win: "Crossbow's still warm. Queue the next idiot.",
      lose: "Tch. Reload me another round.",
    },
    matchups: {
      "mcbalut-anomaly": {
        win: "The cheap copy still breaks under pressure.",
        lose: "What are you supposed to be... me with no brakes?",
      },
    },
  },
  "mcbalut-anomaly": {
    default: {
      win: "I am the patch that deletes your ladder.",
      lose: "Impossible. The branch rejects this future.",
    },
    matchups: {
      mcbalut: {
        win: "Originality was a bug. I fixed it.",
        lose: "You kept the name. I kept the error.",
      },
    },
  },
  digv: {
    default: {
      win: "Contract settled. Send the next case.",
      lose: "Bad read. Won't happen twice.",
    },
    matchups: {
      mcbalut: {
        win: "Your bolts missed the brief.",
      },
    },
  },
  paraktaktak: {
    default: {
      win: "Tak tak tak. That's the rhythm of a clean finish.",
      lose: "Missed a beat. I hate that.",
    },
  },
  distorted: {
    default: {
      win: "You saw the ending. I saw it first.",
      lose: "Signal broke. I can still hear the static.",
    },
  },
  corgi: {
    default: {
      win: "Bork. Another crown for the tiny tyrant.",
      lose: "Rrrf. I demand a rematch and a snack.",
    },
  },
  leechingshjt: {
    default: {
      win: "Fresh blood, clean edge. Next.",
      lose: "Not dead. Just hungry.",
    },
  },
  mrsdoc: {
    default: {
      win: "Case closed. Send in the next patient.",
      lose: "I've stitched worse. Keep the bed warm.",
    },
    matchups: {
      corgi: {
        win: "Cute. Still charting that as a loss.",
      },
    },
  },
};

export function getArcadeDialogueLine(
  fighterId: string,
  opponentId: string,
  outcome: ArcadeDialogueOutcome,
) {
  const fighterDialogue = arcadeDialogueByFighter[fighterId];
  if (!fighterDialogue) {
    return defaultArcadeDialogue[outcome];
  }

  return (
    fighterDialogue.matchups?.[opponentId]?.[outcome] ??
    fighterDialogue.default[outcome]
  );
}
