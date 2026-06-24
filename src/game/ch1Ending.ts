// CH1 ending beat — the chapter close (docs/ch1-ending-design.md). Pure text
// builders (no scene/DOM) so the canonical lines + token substitution are unit-
// tested. Two moments: the KAMON gate exchange (branch-aware opener → converged
// deflection + Concord stinger) and the Route 32 quiet-resolve + chapter card.
//
// Tokens: [player] → the player's name (CH1 has no name system → pass null and
// the address drops cleanly); [starter] → the player's mon by nickname-aware
// display name (the caller resolves prefer-starter → lead → "your partner").
// Italics in the design doc (*know*, *Stronger*, *wanted*) render as plain text.

export const CHAPTER_CARD = {
  chapter: 'CHAPTER ONE',
  title: 'Kindled',
  footer: 'To be continued.',
} as const;

// The once-marker flag for the chapter close. Set the first time the beat fires
// so re-entering Route 32 is silent (the dramatic close isn't cheapened by replay).
export const CH1_CLOSED_FLAG = 'ch1_closed';

// Whether to fire the chapter-end beat on this map entry: Route 32, not yet closed.
// The caller records CH1_CLOSED_FLAG when this returns true, so it fires exactly
// once (first entry); every later entry — and every other map — is silent.
export function shouldFireChapterEnd(map: string, alreadyClosed: boolean): boolean {
  return map === 'ROUTE32' && !alreadyClosed;
}

// KAMON's gate exchange, fired after the gate fight resolves. `playerWon` picks
// the opener (he felt the bond gap either way); both branches converge on the
// same deflection + Concord stinger. `playerName` is null in CH1 (no name
// system) → the sign-off drops the address.
export function kamonGateLines(playerWon: boolean, playerName: string | null): string[] {
  const opener = playerWon
    ? [
        'KAMON: ...How? I trained harder.',
        'I know I did.',
        '(He looks at his mon.)',
        'KAMON: It pulled back. Right at the',
        'end — held its strike. Like it',
        "wasn't sure it wanted to win.",
        '(He stops himself.)',
      ]
    : [
        'KAMON: Ha. Stronger. Told you.',
        "(But he's not smiling. He looks at",
        'his mon — then at yours, still',
        'standing close to you.)',
        "KAMON: ...Yours didn't fight like",
        'mine. Yours fought like it wanted',
        'to be there.',
      ];
  const sendoff = playerName
    ? `See you out there, ${playerName}.`
    : 'See you out there.';
  const converged = [
    '(He shakes it off.)',
    "KAMON: Whatever. Doesn't matter.",
    "There's people up north — the",
    'Concord. They give you a partner',
    "that doesn't hesitate. Doesn't",
    'hold back. Just wins.',
    "(He's already moving to the road.)",
    "KAMON: I'm done waiting around.",
    sendoff,
    "(And he's gone — north, up the",
    "road you're about to take.)",
  ];
  return [...opener, ...converged];
}

// The quiet-resolve beat on entering Route 32 — branch-agnostic. `starter` is the
// nickname-aware display name the caller resolved.
export function quietResolveLines(starter: string): string[] {
  return [
    `(${starter} steps up beside you.`,
    "It doesn't hesitate. It never has.)",
    '(The road runs north — the same',
    "way he went. You're ready for it.)",
  ];
}
