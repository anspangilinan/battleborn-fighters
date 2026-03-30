"use client";

type FightDisplayNameProps = {
  className?: string;
  name: string;
};

function splitDisplayName(name: string) {
  const prefixMatch = name.match(/^((?:\[[^\]]+\]\s*)+)/);
  const prefix = prefixMatch?.[1] ?? "";
  let mainName = name.slice(prefix.length);
  const leadingWhitespace = mainName.match(/^\s+/)?.[0] ?? "";
  mainName = mainName.slice(leadingWhitespace.length);

  return {
    prefix: prefix + leadingWhitespace,
    firstCharacter: mainName.slice(0, 1),
    remainingCharacters: mainName.slice(1),
  };
}

export function FightDisplayName({ className, name }: FightDisplayNameProps) {
  const { prefix, firstCharacter, remainingCharacters } = splitDisplayName(name);

  return (
    <span className={className}>
      {prefix ? <span className="fight-display-name-prefix">{prefix}</span> : null}
      {firstCharacter ? (
        <span className="fight-display-name-highlight">{firstCharacter}</span>
      ) : null}
      {remainingCharacters}
    </span>
  );
}
