// data.jsx — seed data, catalogs, random generation + persistence helpers
// Exports to window: PALETTE, MED_CATALOG, NAME_POOL, makeInitialState,
//   loadState, saveState, uid, todayLabel, PILL_IMG

const PILL_IMG = {
  capsule: "/assets/pill-capsule.png",
  oval: "/assets/pill-oval.png",
  tablet: "/assets/pill-tablet.png",
};

// Card colors — "Japan Fish" palette. `ink` says whether text/dots/icons on the
// card should be dark or light (the flame + navy are too dark for black text).
const PALETTE = [
  { key: "flame", bg: "#D53302", deep: "#A82702", ink: "light" },
  { key: "gold",  bg: "#FCC560", deep: "#E7AC3C", ink: "dark"  },
  { key: "sage",  bg: "#A0CBAD", deep: "#83B493", ink: "dark"  },
  { key: "steel", bg: "#8FB1BE", deep: "#7197A6", ink: "dark"  },
];

function inkFor(key) {
  const c = PALETTE.find(p => p.key === key) || PALETTE[0];
  return c.ink === "light"
    ? { mode: "light", text: "#F7F5EF", soft: "rgba(247,245,239,0.74)", line: "rgba(247,245,239,0.5)", border: "rgba(255,255,255,0.6)" }
    : { mode: "dark",  text: "#0A0A0A", soft: "rgba(10,10,10,0.72)",    line: "rgba(10,10,10,0.45)",    border: "#0A0A0A" };
}

// Believable OTC / common meds.
//   pill = 2D render key (capsule|oval|tablet) used for thumbnails
//   geo  = LiquidPill geometry (capsule|tablet)
//   c3d  = LiquidPill colors { primary, secondary }
const MED_CATALOG = [
  { name: "Dexmethylphenidate", schedule: "Once Daily",        dose: "10mg",    pill: "capsule", geo: "capsule", c3d: { primary: "#3a1236", secondary: "#efeae0" }, imprint: "683",    time: "8:00 AM", detail: "1 capsule by mouth every morning" },
  { name: "Children's Tylenol", schedule: "Twice Daily",       dose: "160mg",   pill: "tablet",  geo: "tablet",  c3d: { primary: "#9b86b2" },                         imprint: "TY\n160", time: "9:00 AM", detail: "1 tablet by mouth every 6 hours" },
  { name: "Superpower",         schedule: "Once Daily",        dose: "10mg",    pill: "oval",    geo: "tablet",  c3d: { primary: "#b6a6e2" },                         imprint: "HALF",   time: "8:00 AM", detail: "1 gummy by mouth every morning" },
  { name: "Lisinopril",         schedule: "Once Daily",        dose: "20mg",    pill: "tablet",  geo: "tablet",  c3d: { primary: "#e6c7d2" },                         imprint: "LP\n20", time: "7:00 AM", detail: "1 tablet by mouth every morning" },
  { name: "Metformin",          schedule: "Twice Daily",       dose: "500mg",   pill: "oval",    geo: "tablet",  c3d: { primary: "#dcd9e2" },                         imprint: "500",    time: "8:00 AM", detail: "1 tablet by mouth with meals" },
  { name: "Vitamin D3",         schedule: "Once Daily",        dose: "2000 IU", pill: "capsule", geo: "capsule", c3d: { primary: "#e2ad45", secondary: "#f4ead0" }, imprint: "D3",     time: "8:00 AM", detail: "1 softgel by mouth daily" },
  { name: "Amoxicillin",        schedule: "Three times daily", dose: "500mg",   pill: "capsule", geo: "capsule", c3d: { primary: "#d98aa0", secondary: "#ece6da" }, imprint: "AMOX",   time: "1:00 PM", detail: "1 capsule by mouth every 8 hours" },
  { name: "Melatonin",          schedule: "Nightly",           dose: "5mg",     pill: "tablet",  geo: "tablet",  c3d: { primary: "#cdd5e0" },                         imprint: "5",      time: "9:00 PM", detail: "1 tablet by mouth before bed" },
  { name: "Sertraline",         schedule: "Once Daily",        dose: "50mg",    pill: "tablet",  geo: "tablet",  c3d: { primary: "#cfe0d6" },                         imprint: "50",     time: "8:00 AM", detail: "1 tablet by mouth every morning" },
  { name: "Levothyroxine",      schedule: "Once Daily",        dose: "75mcg",   pill: "oval",    geo: "tablet",  c3d: { primary: "#cfe0ea" },                         imprint: "75",     time: "6:30 AM", detail: "1 tablet on empty stomach" },
];

const NAME_POOL = ["Nico", "Bobby", "Mila", "Theo", "Ava", "Leo", "Iris", "Juno",
  "Otis", "Wren", "Sage", "Remy", "Cleo", "Milo", "Nina", "Dax", "Lena", "Ezra"];

const AVATARS = ["/assets/avatar-1.png", "/assets/avatar-2.png"];

// ── Caretakers: the people who can access a card and check off doses ──
// ME is the active user on this device; doses you check are attributed to ME.
const ME = { id: "me", name: "You", hue: 212 };
const CARE_POOL = [
  { name: "Mom", hue: 8 }, { name: "Dad", hue: 145 }, { name: "Sam", hue: 268 },
  { name: "Alex", hue: 38 }, { name: "Jo", hue: 328 }, { name: "Kai", hue: 190 },
];
function makeCaretakers() {
  const others = shuffle(CARE_POOL).slice(0, 1 + Math.floor(Math.random() * 2)) // 1–2 others
    .map(c => ({ id: uid("ct"), name: c.name, hue: c.hue }));
  return [{ ...ME }, ...others];
}
function caretakerOf(person, id) {
  const list = (person && person.caretakers) || [ME];
  return list.find(c => c.id === id) || (id === "me" ? ME : null);
}

let _id = 1;
function uid(prefix = "id") { return `${prefix}-${Date.now().toString(36)}-${(_id++).toString(36)}`; }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// derive the daily dose times from the frequency text
function doseTimesFor(schedule, baseTime) {
  switch (schedule) {
    case "Twice Daily":        return ["8:00 AM", "8:00 PM"];
    case "Three times daily":  return ["8:00 AM", "1:00 PM", "9:00 PM"];
    case "Nightly":            return ["9:00 PM"];
    default:                   return [baseTime || "8:00 AM"]; // Once Daily
  }
}

function makeMed(template) {
  const t = template || pick(MED_CATALOG);
  const times = doseTimesFor(t.schedule, t.time);
  return {
    id: uid("med"),
    name: t.name, schedule: t.schedule, dose: t.dose,
    pill: t.pill, geo: t.geo, c3d: t.c3d, imprint: t.imprint, time: times[0], detail: t.detail,
    // one independently-checkable dose per scheduled time
    doses: times.map(time => ({ id: uid("dose"), time, taken: Math.random() < 0.3 })),
  };
}

// helpers used across the UI
function medDoses(med) { return med.doses || [{ id: med.id + "-d", time: med.time, taken: !!med.taken }]; }
function medTakenCount(med) { return medDoses(med).filter(d => d.taken).length; }
function medFill(med) { const d = medDoses(med); return d.length ? medTakenCount(med) / d.length : 0; }
function medAllTaken(med) { const d = medDoses(med); return d.length > 0 && d.every(x => x.taken); }

function makePerson(name, color) {
  const caretakers = makeCaretakers();
  const n = 1 + Math.floor(Math.random() * 3); // 1–3 meds
  const meds = shuffle(MED_CATALOG).slice(0, n).map(makeMed);
  // attribute the doses that start out taken to a random caretaker (demo history)
  meds.forEach(m => m.doses.forEach(d => { if (d.taken) d.takenBy = pick(caretakers).id; }));
  return { id: uid("p"), name, color, caretakers, meds };
}

// add a new tracked person, preferring an unused name + card color
function makeRandomPerson(existing = []) {
  const usedNames = new Set(existing.map(p => p.name));
  const usedColors = new Set(existing.map(p => p.color));
  const freeNames = NAME_POOL.filter(n => !usedNames.has(n));
  const freeColors = PALETTE.map(c => c.key).filter(k => !usedColors.has(k));
  const name = pick(freeNames.length ? freeNames : NAME_POOL);
  const color = pick(freeColors.length ? freeColors : PALETTE.map(c => c.key));
  return makePerson(name, color);
}

function makeInitialState() {
  const count = 3; // keep live WebGL pill count comfortably under the browser limit
  const names = shuffle(NAME_POOL).slice(0, count);
  const colors = shuffle(PALETTE).map(c => c.key);
  const people = names.map((nm, i) => makePerson(nm, colors[i % colors.length]));
  return { people, history: [] };
}

const STORE_KEY = "pilltracker.state.v6";
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const fresh = makeInitialState();
  saveState(fresh);
  return fresh;
}
function saveState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

function colorFor(key) { return PALETTE.find(p => p.key === key) || PALETTE[0]; }

// ── Session (onboarding + sign-in), persisted locally for the prototype ──
const SESSION_KEY = "pilltracker.session.v1";
function loadSession() {
  try { const r = localStorage.getItem(SESSION_KEY); if (r) return JSON.parse(r); } catch (e) {}
  return { onboarded: false, email: null };
}
function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }

function todayLabel() {
  const d = new Date(); // live current date & time
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  let h = d.getHours(); const ampm = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return {
    line1: `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    line2: `${h}:${m}${ampm}`,
  };
}

// ── Adherence reports ─────────────────────────────────────────────────
// There's no real year of logged history yet, so we synthesize a believable,
// STABLE adherence record (seeded PRNG → same numbers every render) for the
// selected look-back window. Same demo philosophy as the random people.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// each person keeps a stable baseline adherence (~74–98%)
function personBaseline(p) { return 0.74 + mulberry32(hashStr(p.id + "|base"))() * 0.24; }

const REPORT_RANGES = [
  { key: "week",  label: "This week",  short: "7-day",  days: 7 },
  { key: "month", label: "This month", short: "30-day", days: 30 },
  { key: "year",  label: "Past year",  short: "12-month", days: 365 },
];

// Build an adherence report over the last `days` days (today included).
function buildReport(people, days) {
  const perPerson = people.map(p => {
    const dosesPerDay = p.meds.reduce((n, m) => n + medDoses(m).length, 0);
    const base = personBaseline(p);
    let scheduled = 0, taken = 0, streak = 0, best = 0;
    for (let d = days - 1; d >= 0; d--) { // oldest → today, so the streak ends "today"
      let dayTaken = 0;
      p.meds.forEach(m => medDoses(m).forEach(dose => {
        scheduled++;
        if (mulberry32(hashStr(p.id + "|" + dose.id + "|" + d))() < base) { taken++; dayTaken++; }
      }));
      const complete = dosesPerDay > 0 && dayTaken === dosesPerDay;
      if (complete) { streak++; if (streak > best) best = streak; } else { streak = 0; }
    }
    return {
      id: p.id, name: p.name, color: p.color,
      scheduled, taken, missed: scheduled - taken,
      adherence: scheduled ? taken / scheduled : 0,
      currentStreak: streak, bestStreak: best,
    };
  });
  const totalScheduled = perPerson.reduce((n, x) => n + x.scheduled, 0);
  const totalTaken = perPerson.reduce((n, x) => n + x.taken, 0);
  return {
    days,
    totalScheduled, totalTaken, totalMissed: totalScheduled - totalTaken,
    adherence: totalScheduled ? totalTaken / totalScheduled : 0,
    perPerson: perPerson.sort((a, b) => b.adherence - a.adherence),
  };
}

// Current consecutive-day streak (all doses taken). Today uses the live taken-state;
// prior days use the same seeded record the reports draw from.
function personStreak(person) {
  const dosesPerDay = person.meds.reduce((n, m) => n + medDoses(m).length, 0);
  if (!dosesPerDay) return 0;
  const base = personBaseline(person);
  let streak = 0;
  if (person.meds.length > 0 && person.meds.every(m => medAllTaken(m))) streak++; // today, live
  for (let d = 1; d < 160; d++) {
    let taken = 0;
    person.meds.forEach(m => medDoses(m).forEach(dose => {
      if (mulberry32(hashStr(person.id + "|" + dose.id + "|" + d))() < base) taken++;
    }));
    if (taken === dosesPerDay) streak++; else break;
  }
  return streak;
}

export {
  PALETTE, MED_CATALOG, NAME_POOL, PILL_IMG, AVATARS,
  makeInitialState, loadState, saveState, uid, colorFor, inkFor, todayLabel,
  medDoses, medTakenCount, medFill, medAllTaken, doseTimesFor,
  makePerson, makeRandomPerson, buildReport, REPORT_RANGES, personStreak,
  ME, caretakerOf, loadSession, saveSession,
};
