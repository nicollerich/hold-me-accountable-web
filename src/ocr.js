// ocr.js — read a prescription-bottle label client-side (no backend/key).
// Uses Tesseract.js (lazy-loaded) to OCR the photo, then parses out the most
// likely medication name, dose, and schedule. Best-effort — fields stay editable.

// Common medications (generic + brand) to anchor the name against OCR noise.
const DRUGS = [
  "Acetaminophen", "Tylenol", "Ibuprofen", "Advil", "Motrin", "Naproxen", "Aleve",
  "Aspirin", "Amoxicillin", "Augmentin", "Azithromycin", "Zithromax", "Cephalexin", "Keflex",
  "Ciprofloxacin", "Doxycycline", "Penicillin", "Metronidazole", "Clindamycin",
  "Lisinopril", "Losartan", "Amlodipine", "Metoprolol", "Atenolol", "Hydrochlorothiazide",
  "Atorvastatin", "Lipitor", "Simvastatin", "Rosuvastatin", "Crestor", "Pravastatin",
  "Metformin", "Glipizide", "Januvia", "Sitagliptin", "Insulin", "Ozempic", "Semaglutide",
  "Levothyroxine", "Synthroid", "Omeprazole", "Prilosec", "Pantoprazole", "Esomeprazole", "Nexium",
  "Ranitidine", "Famotidine", "Pepcid", "Albuterol", "Ventolin", "Montelukast", "Singulair",
  "Sertraline", "Zoloft", "Fluoxetine", "Prozac", "Escitalopram", "Lexapro", "Citalopram",
  "Bupropion", "Wellbutrin", "Venlafaxine", "Duloxetine", "Cymbalta", "Trazodone", "Mirtazapine",
  "Alprazolam", "Xanax", "Lorazepam", "Ativan", "Clonazepam", "Klonopin", "Diazepam",
  "Gabapentin", "Pregabalin", "Lyrica", "Tramadol", "Hydrocodone", "Oxycodone", "Morphine",
  "Prednisone", "Prednisolone", "Methylprednisolone", "Hydrocortisone",
  "Dexmethylphenidate", "Methylphenidate", "Ritalin", "Concerta", "Adderall", "Amphetamine",
  "Lisdexamfetamine", "Vyvanse", "Atomoxetine", "Strattera", "Guanfacine",
  "Melatonin", "Diphenhydramine", "Benadryl", "Loratadine", "Claritin", "Cetirizine", "Zyrtec",
  "Fexofenadine", "Allegra", "Warfarin", "Clopidogrel", "Plavix", "Apixaban", "Eliquis",
  "Furosemide", "Lasix", "Spironolactone", "Tamsulosin", "Finasteride", "Sildenafil", "Tadalafil",
  "Vitamin D3", "Cholecalciferol", "Vitamin B12", "Folic Acid", "Ferrous Sulfate", "Magnesium",
  "Calcium", "Fish Oil", "Probiotic", "Cyclobenzaprine", "Meloxicam", "Celecoxib", "Celebrex",
];

const STOP = new Set([
  "TABLET", "TABLETS", "CAPSULE", "CAPSULES", "TAKE", "DAILY", "ONCE", "TWICE", "MOUTH",
  "REFILL", "REFILLS", "PHARMACY", "QTY", "QUANTITY", "EXP", "RX", "DR", "MD", "DEA", "NDC",
  "MFG", "MFR", "EVERY", "HOURS", "DAY", "WITH", "FOOD", "WATER", "DISCARD", "AFTER", "DOCTOR",
  "PRESCRIBED", "GENERIC", "FOR", "USE", "AS", "DIRECTED", "ORAL", "BY", "THE", "AND", "WARNING",
]);

// version-matched CDN paths so the worker/core/lang load reliably in a bundler
const TESS = {
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
  langPath: "https://tessdata.projectnaptha.com/4.0.0",
};

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// crop to the framed label region, upscale, grayscale + contrast → cleaner OCR
async function preprocess(dataUrl, preCropped) {
  const img = await loadImg(dataUrl);
  // when the user has already cropped to the name, use the whole image as-is;
  // otherwise gently crop toward the reticle (trims keyboard/hand/background)
  const [cx0, cx1, cy0, cy1] = preCropped ? [0, 1, 0, 1] : [0.05, 0.95, 0.10, 0.86];
  const sx = Math.round(img.width * cx0), sy = Math.round(img.height * cy0);
  const sw = Math.max(1, Math.round(img.width * (cx1 - cx0)));
  const sh = Math.max(1, Math.round(img.height * (cy1 - cy0)));
  const targetW = 1300;
  const scale = sw ? targetW / sw : 1;
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  try {
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      g = (g - 128) * 1.55 + 132;                // stronger contrast + slight brighten
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(id, 0, 0);
  } catch (e) { /* tainted canvas — pass the plain draw through */ }
  return cv;
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 4) return 9;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}

function findDrug(text) {
  const U = text.toUpperCase();
  // 1) exact substring (multi-word drugs like "Vitamin D3" too)
  for (const d of DRUGS) if (U.includes(d.toUpperCase())) return d;
  // 2) fuzzy token match for OCR slips — tolerate ~25% of the word's length and
  //    pick the closest drug overall (so "ESCITALQOPRAN" → "Escitalopram").
  const tokens = U.replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(t => t.length >= 5);
  let best = "", bestDist = Infinity;
  for (const d of DRUGS) {
    const du = d.toUpperCase();
    if (du.includes(" ")) continue;
    const tol = Math.max(1, Math.round(du.length / 4));
    for (const t of tokens) {
      const dist = lev(t, du);
      if (dist <= tol && dist < bestDist) { best = d; bestDist = dist; }
    }
  }
  return best;
}

function parseLabel(text) {
  let name = findDrug(text);
  const confident = !!name; // matched a known drug → safe to auto-capture on
  if (!name) {
    // fallback: first prominent alphabetic line that isn't boilerplate
    const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
    for (const l of lines) {
      const word = l.replace(/[^A-Za-z]/g, "");
      if (word.length >= 5 && word.length <= 22 && !STOP.has(word.toUpperCase())) {
        name = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        break;
      }
    }
  }
  const dm = text.match(/(\d+(?:\.\d+)?)\s?(mg|mcg|g|ml|iu)\b/i);
  const dose = dm ? `${dm[1]}${/iu/i.test(dm[2]) ? " IU" : dm[2].toLowerCase()}` : "";

  let schedule = null;
  if (/three\s*times|3\s*times|every\s*8\s*hours|\btid\b/i.test(text)) schedule = "Three times daily";
  else if (/twice|2\s*times|every\s*12\s*hours|\bbid\b|two\s*times/i.test(text)) schedule = "Twice Daily";
  else if (/bedtime|nightly|before\s*bed|at\s*night|\bqhs\b/i.test(text)) schedule = "Nightly";
  else if (/once\s*daily|once\s*a\s*day|every\s*morning|every\s*day|\bdaily\b|\bqd\b/i.test(text)) schedule = "Once Daily";

  return { name, dose, schedule, confident };
}

export async function readLabel(dataUrl, opts = {}) {
  let worker;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, TESS);
    const canvas = await preprocess(dataUrl, opts.preCropped);
    const { data } = await worker.recognize(canvas);
    return parseLabel(data.text || "");
  } catch (e) {
    return { name: "", dose: "", schedule: null, confident: false };
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) {} }
  }
}

// Reusable live scanner — ONE persistent worker recognizes many video frames.
// scan() takes a prepared <canvas>; returns the parsed label (with `confident`).
export async function createScanner() {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, TESS);
  return {
    async scan(source) {
      try { const { data } = await worker.recognize(source); return parseLabel(data.text || ""); }
      catch (e) { return { name: "", dose: "", schedule: null, confident: false }; }
    },
    async stop() { try { await worker.terminate(); } catch (e) {} },
  };
}
