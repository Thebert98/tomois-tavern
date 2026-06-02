/**
 * Per-race naming conventions + sample-name pools.
 *
 * Used by FireplaceWizard to append a "Naming convention: …" line to
 * `user_notes` whenever it knows the character's race (either the player
 * typed it or the cascade picked it). The LLM is good at producing
 * heritage-coherent names once it's told the tradition; the sample names
 * give it patterns to match without prescribing the final answer.
 *
 * Sources: D&D 5e Player's Handbook race chapter + Forgotten Realms
 * culture entries. Sample names are exemplars only — the LLM produces
 * new names that follow the pattern.
 */

interface HeritageEntry {
  /** One-paragraph naming-tradition description for the LLM prompt. */
  blurb: string;
  /** 4-6 example first names (or virtue names where the race uses them). */
  sampleFirst: string[];
  /** 3-5 example family / clan names. Empty array if the race doesn't
   * traditionally carry one. */
  sampleFamily: string[];
}

const HERITAGE: Record<string, HeritageEntry> = {
  Dwarf: {
    blurb:
      "Dwarves carry Norse-rooted personal names paired with a descriptive clan name. Personal names are short and consonantal; clan names are martial or craft-themed (Battlehammer, Ironfist, Fireforge).",
    sampleFirst: ["Adrik", "Baern", "Fargrim", "Harbek", "Orsik", "Thoradin"],
    sampleFamily: ["Battlehammer", "Brawnanvil", "Fireforge", "Frostbeard", "Ironfist", "Loderr"],
  },
  "Hill Dwarf": {
    blurb:
      "Hill Dwarves carry Norse-rooted personal names paired with a clan name (often crafting or hearth-themed: Brewbeard, Stonemoot).",
    sampleFirst: ["Vondal", "Eberk", "Gardain", "Travok", "Veit", "Rurik"],
    sampleFamily: ["Brewbeard", "Stoneheart", "Hammerstone", "Goldhand", "Sturmgrund"],
  },
  "Mountain Dwarf": {
    blurb:
      "Mountain Dwarves carry Norse-rooted personal names paired with a stoic clan name often referencing peaks or stone (Stonefist, Ironpeak).",
    sampleFirst: ["Morgran", "Taklinn", "Tordek", "Ulfgar", "Einkil", "Kildrak"],
    sampleFamily: ["Stonefist", "Ironpeak", "Battlehammer", "Frostbeard", "Foehammer"],
  },
  Elf: {
    blurb:
      "Elven names are lyrical, multi-syllable, and often have a poetic family name (commonly a translated nature reference: Moonwhisper, Starflower, Gemflower).",
    sampleFirst: ["Aelar", "Aramil", "Carric", "Mindartis", "Theren", "Varis"],
    sampleFamily: ["Amakiir", "Galanodel", "Holimion", "Liadon", "Meliamne", "Siannodel"],
  },
  "High Elf": {
    blurb:
      "High Elves carry lyrical, ancient-sounding names often paired with poetic family names (Moonwhisper, Starflower). They tend toward names with hard 'c' and 'th' sounds.",
    sampleFirst: ["Adran", "Aelar", "Caelynn", "Enialis", "Ivellios", "Soveliss"],
    sampleFamily: ["Amakiir", "Galanodel", "Holimion", "Meliamne", "Siannodel"],
  },
  "Wood Elf": {
    blurb:
      "Wood Elves carry softer, breathier lyrical names paired with poetic family names that reference forest or river (Greenleaf, Riverwhisper).",
    sampleFirst: ["Berrian", "Hadarai", "Heian", "Paelias", "Quarion", "Riardon"],
    sampleFamily: ["Greenleaf", "Riverwhisper", "Amakiir", "Liadon", "Xiloscient"],
  },
  Halfling: {
    blurb:
      "Halfling names are warm and everyday, drawn from nature or shire-life. Personal names are friendly and short; family names evoke earth and growing things (Greenbottle, Goodbarrel, Underbough).",
    sampleFirst: ["Alton", "Cade", "Corrin", "Eldon", "Garret", "Merric"],
    sampleFamily: ["Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Hilltopple", "Tealeaf"],
  },
  "Lightfoot Halfling": {
    blurb:
      "Lightfoot Halfling names are nimble and quick on the tongue, paired with family names that evoke travel or trickery (Goodbarrel, Tealeaf, Underbough).",
    sampleFirst: ["Lyle", "Milo", "Osborn", "Perrin", "Reed", "Roscoe", "Wellby"],
    sampleFamily: ["Goodbarrel", "Tealeaf", "Underbough", "Thorngage", "Tosscobble"],
  },
  Human: {
    // Human gets sub-strands picked at call-time via humanCulturePick().
    // The blurb here is a fallback if humanCulturePick isn't used.
    blurb:
      "Human names come from one of the Forgotten Realms cultural strands — pick a tradition and stay within it.",
    sampleFirst: ["Bran", "Cyriaque", "Helder", "Lar", "Rowan", "Sasha"],
    sampleFamily: ["Adair", "Brent", "Cordell", "Greatorex", "Holderhek", "Marsh"],
  },
  Dragonborn: {
    blurb:
      "Dragonborn names lead with a clan name (long, draconic, multi-syllable) followed by a personal name (sharp, short, draconic-rooted). They use a childhood nickname among close kin.",
    sampleFirst: ["Bharash", "Donaar", "Ghesh", "Heskan", "Kriv", "Medrash", "Pandjed", "Rhogar"],
    sampleFamily: ["Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Kerrhylon", "Yarjerit"],
  },
  Gnome: {
    blurb:
      "Gnome names are long, playful, multi-syllable, almost always with a casual nickname for daily use. Family names are equally elaborate and often diminutive-ended (Beren, Folkor, Garrick).",
    sampleFirst: ["Alston", "Boddynock", "Burgell", "Dimble", "Fonkin", "Gerbo", "Jebeddo", "Roondar"],
    sampleFamily: ["Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Murnig", "Scheppen"],
  },
  "Half-Elf": {
    blurb:
      "Half-Elves draw from either parent's tradition or blend them — a lyrical elven personal name with a human family name, or a human first name with an elven house name behind it.",
    sampleFirst: ["Aramil", "Berris", "Carric", "Erevan", "Galinndan", "Riardon"],
    sampleFamily: ["Amakiir", "Galanodel", "Adair", "Cordell", "Holimion"],
  },
  "Half-Orc": {
    blurb:
      "Half-Orc names are short, hard-edged, single- or two-syllable. They favor consonant clusters and rarely carry a family name; some take a human surname when raised in human communities.",
    sampleFirst: ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Krusk", "Mhurren", "Ront", "Thokk"],
    sampleFamily: [],
  },
  Tiefling: {
    blurb:
      "Tieflings carry one of two name styles. Either an infernal-derived personal name handed down from their lineage (sharp consonants, often ending in -os, -on, or -is), OR a virtue name they chose for themselves as adults: a single concept like Hope, Glory, Sorrow, Quest, Carrion, Random. Pick the style that fits the character.",
    sampleFirst: ["Akmenos", "Damakos", "Iados", "Kairon", "Mordai", "Skamos", "Therai"],
    sampleFamily: ["Hope", "Glory", "Sorrow", "Quest", "Random", "Carrion"],
  },
};

/**
 * Forgotten Realms cultural strands for Human characters. Picked at random
 * by `humanCulturePick()` when the race resolves to Human, then woven into
 * the naming convention prompt for variety.
 */
const HUMAN_CULTURES: { name: string; blurb: string; sampleFirst: string[]; sampleFamily: string[] }[] = [
  {
    name: "Calishite",
    blurb: "Calishite (Arabic-rooted) — flowing, vowel-rich names.",
    sampleFirst: ["Aseir", "Bardeid", "Haseid", "Khemed", "Mehmen", "Sudeiman", "Zasheir"],
    sampleFamily: ["Basha", "Dumein", "Jassan", "Khalid", "Nasser", "Pashar"],
  },
  {
    name: "Chondathan",
    blurb: "Chondathan (English/French-rooted) — courtly, classic fantasy.",
    sampleFirst: ["Darvin", "Dorn", "Evendur", "Gorstag", "Helm", "Malark", "Morn", "Randal"],
    sampleFamily: ["Amblecrown", "Buckman", "Dundragon", "Evenwood", "Greycastle", "Tallstag"],
  },
  {
    name: "Damaran",
    blurb: "Damaran (Russian-rooted) — strong consonants, -ov / -ev endings.",
    sampleFirst: ["Bor", "Fodel", "Glar", "Grigor", "Igan", "Ivor", "Pavel", "Sergor"],
    sampleFamily: ["Bersk", "Chernin", "Dotsk", "Kulenov", "Marsk", "Nemetsk", "Stayanoga"],
  },
  {
    name: "Illuskan",
    blurb: "Illuskan (Norse-rooted) — hard, short names with -dr or -rr endings.",
    sampleFirst: ["Ander", "Blath", "Bran", "Frath", "Geth", "Lander", "Stor", "Taman"],
    sampleFamily: ["Brightwood", "Helder", "Hornraven", "Lackman", "Stormwind", "Windrivver"],
  },
  {
    name: "Mulan",
    blurb: "Mulan (Egyptian-rooted) — flowing, regal names with -et / -en endings.",
    sampleFirst: ["Aoth", "Bareris", "Ehput-Ki", "Kethoth", "Mumed", "Ramas", "So-Kehur", "Thazar-De"],
    sampleFamily: ["Ankhalab", "Anskuld", "Fezim", "Hahpet", "Nathandem", "Sepret", "Uuthrakt"],
  },
  {
    name: "Rashemi",
    blurb: "Rashemi (Slavic-rooted) — earthy, often ending in -ik or -ev.",
    sampleFirst: ["Borivik", "Faurgar", "Fyevarra", "Hulmarra", "Iggor", "Olegev", "Volok", "Yarov"],
    sampleFamily: ["Chergoba", "Dyernina", "Iltazyara", "Murnyethara", "Stayanoga", "Ulmokina"],
  },
  {
    name: "Shou",
    blurb: "Shou (East Asian-rooted) — family name first, single-syllable personal name.",
    sampleFirst: ["Chao", "Chen", "Chi", "Hsiao", "Liang", "Mei", "Tan", "Wei", "Yin"],
    sampleFamily: ["Chien", "Huang", "Kao", "Kung", "Lao", "Ling", "Liu", "Mei", "Sum"],
  },
  {
    name: "Tethyrian",
    blurb: "Tethyrian (Mediterranean-rooted) — soft consonants, romance-flavored.",
    sampleFirst: ["Anton", "Cyriaque", "Diero", "Ondrea", "Margaux", "Sefris", "Vala"],
    sampleFamily: ["Buckman", "Cordell", "Dundragon", "Evenwood", "Greycastle", "Tallstag"],
  },
  {
    name: "Turami",
    blurb: "Turami (Italian-rooted) — vowel-rich, melodic, -o / -a endings.",
    sampleFirst: ["Anton", "Donato", "Giovanni", "Lerissa", "Perdita", "Vinzenzo"],
    sampleFamily: ["Albonese", "Caratacus", "Felini", "Marivaldi", "Ruzzo", "Vinzini"],
  },
];

function pickHumanCulture(): (typeof HUMAN_CULTURES)[number] {
  return HUMAN_CULTURES[Math.floor(Math.random() * HUMAN_CULTURES.length)];
}

function joinSamples(names: string[]): string {
  return names.slice(0, 6).join(", ");
}

/**
 * Build the "Naming convention: …" paragraph that goes into `user_notes`
 * for the LLM. Returns empty string for unknown / blank races.
 *
 * For Human, picks one of the 9 cultural strands at random — this is the
 * single biggest variety lever because Human is the most-picked race.
 */
export function namingConventionFor(race: string | null | undefined): string {
  if (!race) return "";
  const key = race.trim();
  if (!key) return "";

  // Human cascades through a random Forgotten Realms strand.
  if (key === "Human") {
    const culture = pickHumanCulture();
    return [
      `Naming convention: this human comes from a ${culture.name} cultural background. ${culture.blurb}`,
      `Names in this tradition: ${joinSamples(culture.sampleFirst)}.`,
      culture.sampleFamily.length
        ? `Family names include: ${joinSamples(culture.sampleFamily)}.`
        : "",
      "Produce a single name that fits this tradition. Do not restate this guidance in your output.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const entry = HERITAGE[key];
  if (!entry) return "";

  const parts: string[] = [`Naming convention: ${entry.blurb}`];
  if (entry.sampleFirst.length) {
    parts.push(`Names in this tradition: ${joinSamples(entry.sampleFirst)}.`);
  }
  if (entry.sampleFamily.length) {
    parts.push(`Family or virtue names include: ${joinSamples(entry.sampleFamily)}.`);
  }
  parts.push(
    "Produce a single name that fits this tradition. Do not restate this guidance in your output.",
  );
  return parts.join(" ");
}

/** For QA / `/design` previews. Returns all known race keys. */
export function heritageRaces(): string[] {
  return Object.keys(HERITAGE);
}
