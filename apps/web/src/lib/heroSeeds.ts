/**
 * Random "seed" phrases dropped into `user_notes` when the player hasn't
 * written a vibe. The Fireplace's randomize-all path used to send an empty
 * notes payload, which left the LLM with no theme to anchor to — and the
 * model kept defaulting to the same handful of generic archetypes.
 *
 * Each seed is short, evocative, and class/race-neutral. The LLM can riff
 * without being boxed in. We sample 1-2 per call and prepend a brief
 * "surprise me" instruction so the model knows it's free to choose
 * boldly.
 */

const SEEDS: string[] = [
  // ---- origin / past
  "A wanderer with a complicated past.",
  "An heir of forgotten royalty, raised far from the throne.",
  "A second-born noble free to choose their own fate.",
  "A survivor of a destroyed home, carrying what little they could save.",
  "A scholar turned adventurer when the books ran out of answers.",
  "A retired soldier dragged back into service against their will.",
  "A child of two worlds who belongs fully to neither.",
  "A planar refugee with habits no one in this world recognizes.",
  "A cult's only escapee, still half-believing the things they were taught.",
  "A foundling raised by an unlikely guardian.",
  "Someone with a face that gets them recognized in places they shouldn't be.",
  "Raised in the shadow of a war that ended before they were old enough to fight.",
  "A failed apprentice who left their teacher's house under bad terms.",
  "An accidental hero who saved the wrong person and earned the wrong enemy.",

  // ---- motivation
  "A reluctant hero pressed into duty by circumstance.",
  "A young dreamer chasing a prophecy no one else takes seriously.",
  "An outcast seeking redemption for something the world has forgotten.",
  "A criminal making amends one stranger at a time.",
  "Driven by a vow they cannot break, even when it costs them.",
  "Searching for someone they lost long ago.",
  "Hunting the person who hunted their family.",
  "Trying to finish a job their mentor died before completing.",

  // ---- burden / quirk
  "Carrying a cursed artifact they can't put down.",
  "Marked by a god they don't believe in.",
  "Hiding magic they don't fully understand.",
  "On the run from a debt of an unusual kind.",
  "Haunted by a familiar voice that no one else hears.",
  "Bound to keep a secret that isn't theirs.",
  "A second chance at a life they thought they'd ended.",
  "Born under a sign their village considered an ill omen.",
  "Owes their life to someone they may never see again.",

  // ---- vibe / temperament
  "Quiet, deliberate, and consistently underestimated.",
  "Loud, lucky, and luckier still — they've never quite been caught.",
  "Wry, weary, and unshakable in a crisis.",
  "Cheerful in ways their companions find a little unsettling.",
  "Slow to anger, terrifying when angered.",
  "Soft-spoken in conversation, an entirely different person in a fight.",
  "Generous to a fault — they will give away things they need.",
  "Curious enough to walk into rooms they've been warned away from.",

  // ---- world hooks
  "Has only ever known one place — until very recently.",
  "Has been everywhere except home.",
  "Made a deal with someone they probably shouldn't have.",
  "Was raised to fight an enemy they have never actually met.",
  "Owes a favor to a creature whose nature they can't quite remember.",
  "Their family name opens doors and closes others in equal measure.",
  "Knows a tavern song that, when sung in the right place, gets them free drinks for life.",
];

/**
 * Pick `count` seeds at random (without repeats) and join them with spaces.
 * Defaults to 2 — enough to give the LLM specifics without overcrowding the
 * prompt with directions.
 */
export function pickHeroSeed(count = 2): string {
  const pool = [...SEEDS];
  const picked: string[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.join(" ");
}

/**
 * Wrap a seed in a brief framing line so the LLM knows it's a creative
 * springboard, not a literal constraint. Empty input returns empty output.
 */
export function frameHeroSeed(seed: string): string {
  if (!seed.trim()) return "";
  return `Take inspiration from this — feel free to surprise me with the details: ${seed.trim()}`;
}
