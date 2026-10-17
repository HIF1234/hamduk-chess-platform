// Nigerian bot personas — 13 Stockfish-driven opponents with depth caps,
// blunder injection, and eval-noise randomness. Legacy fields (skill,
// blunderChance, trait, tagline, avatar) preserved for existing callers.

import portraitArmyLegend from "@/assets/bots/army_legend.jpg";
import portraitAgbero from "@/assets/bots/agbero.jpg";
import portraitIyaamala from "@/assets/bots/iyaamala.jpg";
import portraitBabaIjebu from "@/assets/bots/baba_ijebu.jpg";
import portraitMamaCass from "@/assets/bots/mama_cass.jpg";
import portraitAreaFather from "@/assets/bots/area_father.jpg";
import portraitZoboMaster from "@/assets/bots/zobo_master.jpg";
import portraitThirdMainland from "@/assets/bots/third_mainland.jpg";
import portraitEkoAtlantic from "@/assets/bots/eko_atlantic.jpg";
import portraitQueenAmina from "@/assets/bots/queen_amina.jpg";
import portraitObafemi from "@/assets/bots/obafemi.jpg";
import portraitOduduwa from "@/assets/bots/oduduwa.jpg";
import portraitNaijaLegend from "@/assets/bots/naija_legend.jpg";

export type BotTier = "free" | "plus";

export type BotPersona = {
  id: string;
  name: string;
  hometown: string;
  rating: number;
  /** Stockfish depth range — engine searches between these */
  depthMin: number;
  depthMax: number;
  /** 0..1 — chance of picking 2nd/3rd best move instead of best */
  blunderRate: number;
  /** Centipawn-scale eval noise added to MultiPV scoring */
  randomness: number;
  /** ms hard cap per move */
  movetimeMs: number;
  /** Catchphrase / personality blurb, shown when the game starts */
  catchphrase: string;
  /** Pidgin version of catchphrase */
  catchphrasePidgin: string;
  /** Said after the player blunders mid-game */
  blunderLine: string;
  blunderLinePidgin: string;
  /** Said when the bot delivers checkmate */
  checkmateLine: string;
  checkmateLinePidgin: string;
  bio: string;
  /** Opening UCI lines weighted toward Nigerian club favorites (head only) */
  openingRepertoire: string[];
  tier: BotTier;
  avatar: string;
  /** Imported portrait illustration URL */
  portrait: string;

  // ---- Legacy compatibility for existing ChessApp ----
  /** Mapped from depth range → 0..20 Stockfish skill */
  skill: number;
  /** Alias of blunderRate */
  blunderChance: number;
  tagline: string;
  trait: string;
};

function mkSkill(depthMax: number): number {
  // Rough map: depth 2→2, 4→6, 6→10, 8→13, 10→16, 12→18, 14→19, 20→20
  return Math.max(0, Math.min(20, Math.round((depthMax - 1) * 1.45)));
}

type Spec = Omit<BotPersona, "skill" | "blunderChance" | "tagline" | "trait">;

const SPECS: Spec[] = [
  {
    id: "army_legend",
    name: "Army Legend",
    hometown: "Abeokuta",
    rating: 500,
    depthMin: 1,
    depthMax: 2,
    blunderRate: 0.15,
    randomness: 0.3,
    movetimeMs: 300,
    catchphrase: "Still learning the pieces",
    catchphrasePidgin: "I still dey learn the pieces",
    blunderLine: "Even I saw that one coming!",
    blunderLinePidgin: "Even me I see dat one come!",
    checkmateLine: "I won? The sergeant will be proud.",
    checkmateLinePidgin: "I win? Oga go happy well well!",
    bio: "Just discovered chess at the barracks. Loves the horsey.",
    openingRepertoire: ["e2e4", "d2d4"],
    tier: "free",
    avatar: "🪖",
    portrait: portraitArmyLegend,
  },
  {
    id: "agbero",
    name: "Agbero",
    hometown: "Lagos Island",
    rating: 800,
    depthMin: 2,
    depthMax: 4,
    blunderRate: 0.12,
    randomness: 0.25,
    movetimeMs: 350,
    catchphrase: "Street smart, chess dumb",
    catchphrasePidgin: "Street smart, chess dumb — na so I dey",
    blunderLine: "Ah ah, you dropped that one easy.",
    blunderLinePidgin: "Ah ah, you comot dat one just like that.",
    checkmateLine: "Got you!",
    checkmateLinePidgin: "I don catch you!",
    bio: "Runs the motor park by day, hustles bullet by night.",
    openingRepertoire: ["e2e4", "b1c3"],
    tier: "free",
    avatar: "🧢",
    portrait: portraitAgbero,
  },
  {
    id: "iyaamala",
    name: "Iyaamala",
    hometown: "Ibadan",
    rating: 1000,
    depthMin: 3,
    depthMax: 5,
    blunderRate: 0.1,
    randomness: 0.2,
    movetimeMs: 400,
    catchphrase: "Plays by feeling",
    catchphrasePidgin: "I dey play as I dey feel am",
    blunderLine: "That one go cost you, my friend.",
    blunderLinePidgin: "Dat one go cost you o, my friend.",
    checkmateLine: "Just like selling amala — sweet and quick.",
    checkmateLinePidgin: "Just like I dey sell amala — sweet, quick, finish!",
    bio: "Sells amala by day, swindles club regulars by night.",
    openingRepertoire: ["e2e4", "g1f3"],
    tier: "free",
    avatar: "🍲",
    portrait: portraitIyaamala,
  },
  {
    id: "baba_ijebu",
    name: "Baba Ijebu",
    hometown: "Ijebu-Ode",
    rating: 1200,
    depthMin: 4,
    depthMax: 6,
    blunderRate: 0.08,
    randomness: 0.17,
    movetimeMs: 450,
    catchphrase: "Lucky but tricky",
    catchphrasePidgin: "I dey lucky but I dey tricky",
    blunderLine: "Wrong number, my friend. Try again.",
    blunderLinePidgin: "Wrong number dat one o. Try again.",
    checkmateLine: "Jackpot! Baba Ijebu wins again.",
    checkmateLinePidgin: "Jackpot! Baba Ijebu don hammer again.",
    bio: "Lottery kingpin. Believes every opening is a numbers game.",
    openingRepertoire: ["e2e4", "c2c4", "d2d4"],
    tier: "free",
    avatar: "🎲",
    portrait: portraitBabaIjebu,
  },
  {
    id: "mama_cass",
    name: "Mama Cass",
    hometown: "Port Harcourt",
    rating: 1400,
    depthMin: 5,
    depthMax: 7,
    blunderRate: 0.07,
    randomness: 0.14,
    movetimeMs: 500,
    catchphrase: "Patient and dangerous",
    catchphrasePidgin: "I dey patient but I dey dangerous",
    blunderLine: "I've taught better students than this.",
    blunderLinePidgin: "I don teach pupil wey sabi pass dis one.",
    checkmateLine: "Class dismissed.",
    checkmateLinePidgin: "Class don end o.",
    bio: "Chess teacher at the Garden City club. Has notebooks of traps.",
    openingRepertoire: ["d2d4", "c2c4", "e2e4"],
    tier: "free",
    avatar: "👵",
    portrait: portraitMamaCass,
  },
  {
    id: "area_father",
    name: "Area Father",
    hometown: "Mushin, Lagos",
    rating: 1600,
    depthMin: 6,
    depthMax: 8,
    blunderRate: 0.05,
    randomness: 0.12,
    movetimeMs: 550,
    catchphrase: "Controls the street",
    catchphrasePidgin: "Na me control dis street",
    blunderLine: "Nothing moves here without my say. Not even that move.",
    blunderLinePidgin: "Nothing dey move for here without my say. Not even dat move.",
    checkmateLine: "This board belongs to me now.",
    checkmateLinePidgin: "Dis board na mine now o.",
    bio: "Nothing moves in Mushin without his say. Same on the board.",
    openingRepertoire: ["e2e4", "d2d4", "c2c4"],
    tier: "plus",
    avatar: "🕶️",
    portrait: portraitAreaFather,
  },
  {
    id: "zobo_master",
    name: "Zobo Master",
    hometown: "Kano",
    rating: 1800,
    depthMin: 7,
    depthMax: 9,
    blunderRate: 0.04,
    randomness: 0.1,
    movetimeMs: 600,
    catchphrase: "Calculated cool",
    catchphrasePidgin: "I dey cool, I dey calculate",
    blunderLine: "Relax. I saw that three moves ago.",
    blunderLinePidgin: "Relax, I don see dat one since three moves ago.",
    checkmateLine: "Cool as zobo. Checkmate.",
    checkmateLinePidgin: "Cool like zobo. Checkmate be dat.",
    bio: "Sips zobo between moves. Has never been seen flustered.",
    openingRepertoire: ["d2d4", "g1f3", "c2c4"],
    tier: "plus",
    avatar: "🥤",
    portrait: portraitZoboMaster,
  },
  {
    id: "third_mainland",
    name: "Third Mainland",
    hometown: "Lagos Mainland",
    rating: 2000,
    depthMin: 8,
    depthMax: 10,
    blunderRate: 0.03,
    randomness: 0.08,
    movetimeMs: 700,
    catchphrase: "Long game thinker",
    catchphrasePidgin: "I dey think long before I move",
    blunderLine: "I saw it coming from the other side of the bridge.",
    blunderLinePidgin: "I see dat one come from di other side of di bridge.",
    checkmateLine: "Long game. Long win.",
    checkmateLinePidgin: "Long game, na long win be dat.",
    bio: "Plans like a bridge — long, deliberate, and unavoidable.",
    openingRepertoire: ["d2d4", "c2c4", "g1f3"],
    tier: "plus",
    avatar: "🌉",
    portrait: portraitThirdMainland,
  },
  {
    id: "eko_atlantic",
    name: "Eko Atlantic",
    hometown: "Eko Atlantic",
    rating: 2200,
    depthMin: 9,
    depthMax: 11,
    blunderRate: 0.025,
    randomness: 0.06,
    movetimeMs: 800,
    catchphrase: "Built different",
    catchphrasePidgin: "I dey built different",
    blunderLine: "That move was not built to last.",
    blunderLinePidgin: "Dat move no built to last at all.",
    checkmateLine: "New money. Old-fashioned checkmate.",
    checkmateLinePidgin: "New money, but di checkmate na correct old school.",
    bio: "New money, sharp lines. Plays Catalan in a Tom Ford suit.",
    openingRepertoire: ["d2d4", "g1f3", "c2c4"],
    tier: "plus",
    avatar: "🏙️",
    portrait: portraitEkoAtlantic,
  },
  {
    id: "queen_amina",
    name: "Queen Amina",
    hometown: "Zaria",
    rating: 2400,
    depthMin: 10,
    depthMax: 12,
    blunderRate: 0.02,
    randomness: 0.05,
    movetimeMs: 850,
    catchphrase: "Warrior queen",
    catchphrasePidgin: "Na warrior queen dey here",
    blunderLine: "A warrior never leaves an opening like that.",
    blunderLinePidgin: "Warrior no go leave una opening like dat.",
    checkmateLine: "The cavalry has arrived.",
    checkmateLinePidgin: "Di cavalry don land o.",
    bio: "Descendant of the warrior queen. Attacks with cavalry.",
    openingRepertoire: ["e2e4", "d2d4", "c2c4"],
    tier: "plus",
    avatar: "👑",
    portrait: portraitQueenAmina,
  },
  {
    id: "obafemi",
    name: "Obafemi",
    hometown: "Ile-Ife",
    rating: 2600,
    depthMin: 11,
    depthMax: 13,
    blunderRate: 0.015,
    randomness: 0.04,
    movetimeMs: 900,
    catchphrase: "The professor",
    catchphrasePidgin: "Na professor dey play dis one",
    blunderLine: "That's a classic error. I'll add it to my lecture notes.",
    blunderLinePidgin: "Dat na classic mistake. I go add am to my lecture notes.",
    checkmateLine: "Quod erat demonstrandum.",
    checkmateLinePidgin: "Na so I prove my point o.",
    bio: "OAU chess professor. Has published on the Najdorf.",
    openingRepertoire: ["e2e4", "d2d4", "c2c4"],
    tier: "plus",
    avatar: "🎓",
    portrait: portraitObafemi,
  },
  {
    id: "oduduwa",
    name: "Oduduwa",
    hometown: "Ile-Ife",
    rating: 2800,
    depthMin: 12,
    depthMax: 14,
    blunderRate: 0.01,
    randomness: 0.03,
    movetimeMs: 1000,
    catchphrase: "Ancient and wise",
    catchphrasePidgin: "Ancient and wise, na me be dat",
    blunderLine: "Even the first Ife king knew better than that.",
    blunderLinePidgin: "Even di first Ife king sabi pass dat one.",
    checkmateLine: "As it was in the beginning, so it is now.",
    checkmateLinePidgin: "As e dey from beginning, na so e be now.",
    bio: "They say he taught the first Ife king to play. They might be right.",
    openingRepertoire: ["d2d4", "c2c4", "g1f3"],
    tier: "plus",
    avatar: "🗿",
    portrait: portraitOduduwa,
  },
  {
    id: "naija_legend",
    name: "Naija Legend",
    hometown: "Abuja",
    rating: 3000,
    depthMin: 14,
    depthMax: 20,
    blunderRate: 0.005,
    randomness: 0.02,
    movetimeMs: 1200,
    catchphrase: "Unbeatable",
    catchphrasePidgin: "Nobody fit beat me",
    blunderLine: "No one has scored a point. You won't be the first.",
    blunderLinePidgin: "Nobody don score point. You no go be di first.",
    checkmateLine: "Unbeatable. As always.",
    checkmateLinePidgin: "Unbeatable, as e dey be.",
    bio: "Nigeria's strongest engine-tuned super-GM. No one has scored a point.",
    openingRepertoire: ["e2e4", "d2d4", "c2c4", "g1f3"],
    tier: "plus",
    avatar: "🦅",
    portrait: portraitNaijaLegend,
  },
];

export const BOT_PERSONAS: BotPersona[] = SPECS.map((s) => ({
  ...s,
  skill: mkSkill(s.depthMax),
  blunderChance: s.blunderRate,
  tagline: s.catchphrase,
  trait: s.bio,
}));

export const DEFAULT_PERSONA_ID = "baba_ijebu";

export function getPersona(id: string): BotPersona {
  return BOT_PERSONAS.find((p) => p.id === id) ?? BOT_PERSONAS[3];
}

/** Pick the bot whose rating is closest to the player's */
export function nearestBot(rating: number, tier: BotTier = "free"): BotPersona {
  const pool = BOT_PERSONAS.filter((b) => tier === "plus" || b.tier === "free");
  return pool.reduce(
    (best, b) => (Math.abs(b.rating - rating) < Math.abs(best.rating - rating) ? b : best),
    pool[0],
  );
}
