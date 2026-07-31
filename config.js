/* ============================================================
 * TYPE RACER - SPEED RUSH
 * config.js — global namespace + game constants
 * ============================================================ */
window.TR = window.TR || {};

TR.Config = {
  /* Race track */
  RACE_LENGTH: 1000,        // meters
  PX_PER_METER: 2.2,        // world → screen pixels

  /* Car physics */
  BASE_SPEED: 60,           // km/h at start
  MAX_SPEED: 220,           // km/h cap
  MIN_SPEED: 20,            // km/h floor
  SPEED_PER_CORRECT: 2,     // +2 km/h per correct char
  SPEED_PER_WRONG: 5,       // -5 km/h per wrong char
  SPEED_LERP: 3.0,          // smoothness of speed changes (higher = snappier)

  /* Nitro */
  NITRO_BONUS: 40,          // +40 km/h while active
  NITRO_DURATION: 5,        // seconds
  NITRO_COOLDOWN: 10,       // seconds
  NITRO_PER_CHAR: 2.5,      // meter % per correct char (40 chars = full)

  /* Combo milestones: 5 / 10 / 20 / 30 correct keys */
  COMBO_MILESTONES: [
    { at: 5,  label: "SMALL BOOST",    bonus: 6,  tier: 1 },
    { at: 10, label: "TURBO",          bonus: 10, tier: 2 },
    { at: 20, label: "NITRO READY",    bonus: 14, tier: 3 },
    { at: 30, label: "MAXIMUM BOOST",  bonus: 18, tier: 4 }
  ],

  /* Live WPM: rolling window in seconds */
  WPM_WINDOW: 5,

  /* AI opponents (rubber-banded around base speed) */
  AI_CARS: [
    { name: "VOLT-7", base: 96, color: "#ff3d81", accent: "#ffd166" },
    { name: "NOVA-X", base: 86, color: "#ff9f1c", accent: "#fff3b0" },
    { name: "HEX-01", base: 76, color: "#7bdff2", accent: "#ffffff" }
  ],

  /* Race track themes */
  THEMES: {
    neon:     { name: "Neon City",      skyTop: "#05061a", skyBot: "#1a0b3a", road: "#101126", line: "#ff2d78", night: true  },
    sunset:   { name: "Sunset Desert",  skyTop: "#2b1055", skyBot: "#ff6b35", road: "#241c33", line: "#ffd166", night: false },
    midnight: { name: "Midnight Express", skyTop: "#010409", skyBot: "#0d1b3a", road: "#0a0e1c", line: "#38f2ff", night: true  }
  },

  /* Player car paint jobs */
  SKINS: [
    { id: "cyan",    name: "Neon Cyan",     color: "#22e4ff", accent: "#8ffbff" },
    { id: "magenta", name: "Magenta Storm", color: "#ff2d78", accent: "#ff9ecb" },
    { id: "toxic",   name: "Toxic Green",   color: "#39ff14", accent: "#eaff00" },
    { id: "sunset",  name: "Sunset Orange", color: "#ff9f1c", accent: "#ffd166" },
    { id: "ice",     name: "Ice Blue",      color: "#7bdff2", accent: "#ffffff" }
  ],

  /* Online multiplayer (used only when opening the game via file://) */
  WS_URL: "ws://localhost:3000",

  /* Achievements (checked on race events / finish) */  ACHIEVEMENTS: [
    { id: "first_race", icon: "\u{1F3C1}", name: "First Race",     desc: "Finish your first race" },
    { id: "speed150",   icon: "\u{1F680}", name: "Speed Demon",    desc: "Reach 150 km/h" },
    { id: "speed220",   icon: "\u26A1",    name: "Velocity Max",   desc: "Reach 220 km/h" },
    { id: "combo30",    icon: "\u{1F525}", name: "Combo Master",   desc: "Chain a 30-key combo" },
    { id: "flawless",   icon: "\u{1F4AF}", name: "Flawless",       desc: "Finish with 100% accuracy" },
    { id: "nitro",      icon: "\u{1F4A8}", name: "Nitro Junkie",   desc: "Use your first nitro" },
    { id: "coder",      icon: "\u{1F4BB}", name: "Code Runner",    desc: "Finish a Hard (code) race" },
    { id: "five_races", icon: "\u{1F3C3}", name: "Marathon",       desc: "Complete 5 races" },
    { id: "daily",      icon: "\u{1F4C5}", name: "Daily Grind",    desc: "Complete the daily challenge" },
    { id: "winner",     icon: "\u{1F947}", name: "Champion",       desc: "Finish in 1st place" }
  ]
};

/* Deterministic PRNG (mulberry32) — used for daily challenge + scenery */
TR.rand = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* djb2 string hash — used for ghost replay keys */
TR.hashString = function (str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

TR.clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
TR.lerp = function (a, b, t) { return a + (b - a) * t; };
