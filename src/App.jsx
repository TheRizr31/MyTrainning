import React, { useState, useEffect, useRef } from "react";

// ── Palette & type ───────────────────────────────────────────
// Athletic "chalk & iron" direction: deep slate ground, chalk-white
// numerals, a single electric-lime accent for the live pulse.
const C = {
  ground: "#12161C",
  panel: "#1A1F27",
  panelHi: "#222834",
  line: "#2C333F",
  chalk: "#F2F4F0",
  muted: "#7C8798",
  lime: "#C4F82A",
  limeDim: "#8FB01F",
  done: "#3DD68C",
  ring: "#FF6B4A",
  effort: "#38BDF8",
};

// Two axes: TYPE (charges vs poids du corps) × GROUPE MUSCULAIRE.
// Ces constantes ne servent plus qu'à AMORCER le catalogue au tout premier
// lancement (voir buildDefaultCatalog ci-dessous) — l'utilisateur peut
// ensuite créer/renommer/supprimer types, groupes et exercices depuis
// l'onglet Catalogue. Le catalogue effectif vit dans le state `catalog`
// (persisté sous la clé `catalog:data`), plus jamais dans ces constantes.
const DEFAULT_TYPES = [
  { key: "charges", label: "Avec charges" },
  { key: "poids", label: "Poids du corps" },
];

const DEFAULT_GROUPS = [
  "Pectoraux",
  "Dos (largeur)",
  "Dos (épaisseur)",
  "Épaules",
  "Trapèzes",
  "Biceps",
  "Triceps",
  "Avant-bras",
  "Abdominaux",
  "Obliques",
  "Lombaires",
  "Quadriceps",
  "Ischio-jambiers",
  "Fessiers",
  "Mollets",
  "Corps entier",
];

// DEFAULT_EXOS[type][groupe] = liste d'exercices (amorçage uniquement)
const DEFAULT_EXOS = {
  charges: {
    "Pectoraux": ["Développé couché", "Développé incliné", "Développé haltères", "Écartés", "Dips lestés"],
    "Dos (largeur)": ["Tractions lestées", "Tirage vertical", "Pull-over", "Rowing unilatéral"],
    "Dos (épaisseur)": ["Rowing barre", "Rowing haltères", "Rowing T-Bar", "Rowing poulie"],
    "Épaules": ["Développé militaire", "Développé haltères", "Élévations latérales", "Oiseau", "Face Pull"],
    "Trapèzes": ["Shrugs", "High Pull", "Farmer Walk"],
    "Biceps": ["Curl barre", "Curl haltères", "Curl marteau", "Curl pupitre", "Curl poulie"],
    "Triceps": ["Barre au front", "Extension poulie", "Dips lestés", "Extension haltère"],
    "Avant-bras": ["Wrist Curl", "Reverse Curl", "Farmer Walk", "Rouleau de poignet"],
    "Abdominaux": ["Crunch câble", "Cable Woodchopper", "Relevés de jambes lestés"],
    "Obliques": ["Rotation à la poulie", "Russian Twist lesté"],
    "Lombaires": ["Soulevé de terre", "Good Morning", "Extensions lombaires"],
    "Quadriceps": ["Squat", "Front Squat", "Presse à cuisses", "Fentes", "Hack Squat"],
    "Ischio-jambiers": ["Soulevé de terre roumain", "Leg Curl", "Good Morning"],
    "Fessiers": ["Hip Thrust", "Bulgarian Split Squat", "Soulevé de terre roumain"],
    "Mollets": ["Mollets debout", "Mollets assis", "Presse à mollets"],
    "Corps entier": ["Soulevé de terre", "Épaulé-jeté", "Arraché", "Thrusters"],
  },
  poids: {
    "Pectoraux": ["Pompes", "Pompes inclinées", "Pompes déclinées", "Dips"],
    "Dos (largeur)": ["Tractions pronation", "Tractions supination"],
    "Dos (épaisseur)": ["Rowing australien"],
    "Épaules": ["Pike push-up", "Handstand push-up"],
    "Trapèzes": ["Farmer Walk improvisé", "Handstand hold"],
    "Biceps": ["Chin-ups", "Curl aux anneaux"],
    "Triceps": ["Dips", "Pompes diamant"],
    "Avant-bras": ["Dead Hang", "Tractions à la serviette"],
    "Abdominaux": ["Crunch", "Gainage", "Hollow Hold", "Relevés de jambes", "Toes to Bar"],
    "Obliques": ["Side Plank", "Russian Twist", "Mountain Climbers"],
    "Lombaires": ["Superman", "Bird Dog"],
    "Quadriceps": ["Squat", "Fentes", "Pistol Squat", "Step-up"],
    "Ischio-jambiers": ["Nordic Curl", "Hip Hinge une jambe"],
    "Fessiers": ["Pont fessier", "Hip Thrust une jambe", "Fentes"],
    "Mollets": ["Élévations sur pointes", "Sauts à la corde"],
    "Corps entier": ["Burpees", "Muscle-up", "Tractions + Dips", "Bear Crawl"],
  },
};

const defaultItemsFor = (type, group) => (DEFAULT_EXOS[type] && DEFAULT_EXOS[type][group]) || [];

// Construit le catalogue de départ (une fois, au premier lancement) à partir
// des constantes DEFAULT_* ci-dessus. `exos` est une liste plate — plus de
// structure imbriquée par type/groupe — pour rester facile à éditer.
function buildDefaultCatalog() {
  const types = DEFAULT_TYPES.map((t) => ({ ...t, hasWeight: t.key === "charges" }));
  const groups = [...DEFAULT_GROUPS];
  const exos = [];
  let n = 0;
  DEFAULT_TYPES.forEach((t) => {
    DEFAULT_GROUPS.forEach((g) => {
      defaultItemsFor(t.key, g).forEach((name) => {
        exos.push({ id: "d" + n++, name, type: t.key, group: g });
      });
    });
  });
  return { types, groups, exos };
}

// Le type "poids" est le point de départ historique de l'app (onglet
// Aujourd'hui s'ouvre dessus) ; s'il a été supprimé/renommé, on retombe sur
// le premier type disponible.
const defaultTypeKey = (catalog) =>
  ((catalog.types.find((t) => t.key === "poids") || catalog.types[0] || {}).key) || null;

// ── Helpers opérant sur un catalogue dynamique (state `catalog`) ──
const catItemsFor = (catalog, type, group) =>
  catalog.exos.filter((e) => e.type === type && e.group === group).map((e) => e.name);
const catAllExos = (catalog) =>
  catalog.exos.map((e) => ({ name: e.name, type: e.type, group: e.group }));
const catTypeLabel = (catalog, key) => ((catalog.types.find((t) => t.key === key) || {}).label) || key;
const catTypeHasWeight = (catalog, key) => !!(catalog.types.find((t) => t.key === key) || {}).hasWeight;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (k) =>
  new Date(k + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
// Format a set value for display: reps as "12", time as "45s" or "1min30".
const fmtVal = (v, m) => {
  if (m !== "time") return `${v}`;
  if (v < 60) return `${v}s`;
  const mn = Math.floor(v / 60), s = v % 60;
  return s ? `${mn}min${String(s).padStart(2, "0")}` : `${mn}min`;
};

// One shared AudioContext, created/resumed from a user gesture so the
// browser allows sound to fire later when the timer ends.
let AC = null;
function ensureAudio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
  } catch {}
  return AC;
}

// Play one alarm burst (triple tone). Returns silently on failure.
function burst() {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const notes = [880, 1175, 880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.24;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.start(t0);
      o.stop(t0 + 0.24);
    });
  } catch {}
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
}

// Looping alarm — repeats the burst until stopAlarm() is called.
let alarmTimer = null;
function startAlarm() {
  stopAlarm();
  burst();
  alarmTimer = setInterval(burst, 1200);
}
function stopAlarm() {
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
}

export default function App() {
  const [history, setHistory] = useState({}); // { dateKey: session }
  const [workouts, setWorkouts] = useState({}); // { id: {name, blocks} }
  const [goals, setGoals] = useState({}); // { id: {id, exercise, metric, target, unit, deadline, createdAt} }
  const [catalog, setCatalog] = useState(buildDefaultCatalog); // { types, groups, exos } — persisté sous catalog:data
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null); // dernière erreur de sauvegarde/chargement, visible à l'écran
  const [tab, setTab] = useState("today"); // today | catchup | workout
  const [type, setType] = useState("poids");
  const [group, setGroup] = useState(DEFAULT_GROUPS[0]);
  const [exercise, setExercise] = useState(defaultItemsFor("poids", DEFAULT_GROUPS[0])[0]);
  const [search, setSearch] = useState("");
  const [restLen, setRestLen] = useState(60);
  const [reps, setReps] = useState(15);
  const [mode, setMode] = useState("reps"); // "reps" | "time"
  const [secs, setSecs] = useState(30);      // duration per set when mode === "time"
  const [weight, setWeight] = useState(20); // charge (kg), utilisée quand le type a hasWeight

  // Guided session runtime: the workout being executed, if any.
  const [run, setRun] = useState(null); // { name, steps:[...], idx }

  // Timer — one absolute-end-time engine used for both the rest phase
  // and the effort phase (timed sets like planks). phase tells which.
  const [rest, setRest] = useState(0);
  const [phase, setPhase] = useState("rest"); // "rest" | "effort"
  const [ringing, setRinging] = useState(false);
  const endRef = useRef(0);
  const tickRef = useRef(null);
  const beepedRef = useRef(false);
  const onEffortDone = useRef(null); // callback fired when an effort countdown ends
  const wakeLockRef = useRef(null);

  // Empêche l'écran de se verrouiller tout seul pendant qu'un chrono tourne
  // (repos ou effort) — sinon iOS suspend le JS avant que l'alarme sonne,
  // typiquement pendant un repos de 60-90s où on ne touche pas l'écran.
  const timerActive = rest > 0 || ringing;
  const timerActiveRef = useRef(timerActive);
  useEffect(() => { timerActiveRef.current = timerActive; }, [timerActive]);

  useEffect(() => {
    let cancelled = false;
    if (timerActive) {
      (async () => {
        try {
          if ("wakeLock" in navigator) {
            const sentinel = await navigator.wakeLock.request("screen");
            if (cancelled) sentinel.release().catch(() => {});
            else wakeLockRef.current = sentinel;
          }
        } catch {}
      })();
    } else {
      try { wakeLockRef.current?.release(); } catch {}
      wakeLockRef.current = null;
    }
    return () => { cancelled = true; };
  }, [timerActive]);

  // Le wake lock est automatiquement relâché par le navigateur quand l'onglet
  // passe en arrière-plan ; on le redemande au retour si un chrono tourne encore.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && timerActiveRef.current && "wakeLock" in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Toute erreur de sauvegarde/chargement doit rester VISIBLE — avant, tout
  // était avalé en silence (try/catch vides ou .catch(() => {})), donc une
  // panne du backend Cloudflare (mauvais token, Worker en erreur...) ne se
  // remarquait qu'au rechargement suivant, quand les données semblaient
  // avoir disparu, sans aucun message expliquant pourquoi.
  const reportError = (action, e) => {
    console.error(action, e);
    setSyncError(`${action} : ${e && e.message ? e.message : String(e)}`);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.list("day:");
        if (res?.keys?.length) {
          const entries = {};
          for (const k of res.keys) {
            const r = await window.storage.get(k);
            if (r) entries[k.replace("day:", "")] = JSON.parse(r.value);
          }
          setHistory(entries);
        }
      } catch (e) { reportError("Chargement de l'historique", e); }
      try {
        const wr = await window.storage.list("wk:");
        if (wr?.keys?.length) {
          const ws = {};
          for (const k of wr.keys) {
            const r = await window.storage.get(k);
            if (r) ws[k.replace("wk:", "")] = JSON.parse(r.value);
          }
          setWorkouts(ws);
        }
      } catch (e) { reportError("Chargement des entraînements", e); }
      try {
        const gr = await window.storage.list("goal:");
        if (gr?.keys?.length) {
          const gs = {};
          for (const k of gr.keys) {
            const r = await window.storage.get(k);
            if (r) gs[k.replace("goal:", "")] = JSON.parse(r.value);
          }
          setGoals(gs);
        }
      } catch (e) { reportError("Chargement des objectifs", e); }
      try {
        const cr = await window.storage.get("catalog:data");
        if (cr) {
          setCatalog(JSON.parse(cr.value));
        } else {
          // Premier lancement : on fige le catalogue par défaut en stockage
          // pour que les éditions suivantes partent d'une base stable.
          const def = buildDefaultCatalog();
          setCatalog(def);
          window.storage.set("catalog:data", JSON.stringify(def)).catch((e) => reportError("Initialisation du catalogue", e));
        }
      } catch (e) { reportError("Chargement du catalogue", e); }
      try {
        const rr = await window.storage.get("run:active");
        if (rr) {
          const parsed = JSON.parse(rr.value);
          if (parsed && parsed.steps && parsed.idx < parsed.steps.length) {
            setRun(parsed);
            setTab("workout");
          }
        }
      } catch (e) { reportError("Chargement de la séance en cours", e); }
      setLoading(false);
    })();
    return () => {
      clearInterval(tickRef.current);
      stopAlarm();
      try { wakeLockRef.current?.release(); } catch {}
    };
  }, []);

  const saveWorkout = async (wk) => {
    setWorkouts((w) => ({ ...w, [wk.id]: wk }));
    try { await window.storage.set("wk:" + wk.id, JSON.stringify(wk)); } catch (e) { reportError("Sauvegarde de l'entraînement", e); }
  };
  const deleteWorkout = async (id) => {
    setWorkouts((w) => { const n = { ...w }; delete n[id]; return n; });
    try { await window.storage.delete("wk:" + id); } catch (e) { reportError("Suppression de l'entraînement", e); }
  };

  const saveGoal = async (g) => {
    setGoals((gs) => ({ ...gs, [g.id]: g }));
    try { await window.storage.set("goal:" + g.id, JSON.stringify(g)); } catch (e) { reportError("Sauvegarde de l'objectif", e); }
  };
  const deleteGoal = async (id) => {
    setGoals((gs) => { const n = { ...gs }; delete n[id]; return n; });
    try { await window.storage.delete("goal:" + id); } catch (e) { reportError("Suppression de l'objectif", e); }
  };

  const saveCatalog = (next) => {
    setCatalog(next);
    // `next` capturé par la closure ; JSON.stringify avant l'await pour être
    // sûr d'envoyer exactement ce qui vient d'être affiché, pas un state
    // React qui aurait pu changer entre-temps.
    window.storage.set("catalog:data", JSON.stringify(next)).catch((e) => reportError("Sauvegarde du catalogue", e));
  };

  const saveDay = async (key, session) => {
    setHistory((h) => ({ ...h, [key]: session }));
    try {
      await window.storage.set("day:" + key, JSON.stringify(session));
    } catch (e) { reportError("Sauvegarde de la séance", e); }
  };

  const tk = todayKey();
  const today = history[tk] || { sets: [] };

  const runTimer = () => {
    clearInterval(tickRef.current);
    beepedRef.current = false;
    const tick = () => {
      const remain = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRest(remain);
      if (remain <= 0 && !beepedRef.current) {
        beepedRef.current = true;
        startAlarm();
        setRinging(true);
        clearInterval(tickRef.current);
        // If this was an effort countdown, notify (used by guided runs).
        if (phaseRef.current === "effort" && onEffortDone.current) {
          const cb = onEffortDone.current;
          onEffortDone.current = null;
          cb();
        }
      }
    };
    tickRef.current = setInterval(tick, 250);
    tick();
  };

  // Keep a ref of phase so the interval closure reads the latest value.
  const phaseRef = useRef("rest");
  const startPhase = (kind, len) => {
    ensureAudio(); // unlock sound during the click that starts the timer
    phaseRef.current = kind;
    setPhase(kind);
    endRef.current = Date.now() + len * 1000;
    runTimer();
  };
  const startRest = (len = restLen) => startPhase("rest", len);
  const startEffort = (len, done) => { onEffortDone.current = done || null; startPhase("effort", len); };

  // Log a set with explicit values to a given day.
  // val = reps count OR seconds, depending on m ("reps" | "time").
  const logSet = (key, ex, val, rst, m = "reps", ty, wt) => {
    setHistory((h) => {
      const cur = h[key] || { sets: [] };
      const set = {
        exercise: ex, reps: val, mode: m, rest: rst, at: new Date().toISOString(),
        ...(ty ? { type: ty } : {}), ...(wt > 0 ? { weight: wt } : {}),
      };
      const next = { sets: [...cur.sets, set] };
      window.storage.set("day:" + key, JSON.stringify(next)).catch((e) => reportError("Sauvegarde de la série", e));
      return { ...h, [key]: next };
    });
  };

  const addSetTo = (key, existing) => {
    const val = mode === "time" ? secs : reps;
    const set = {
      exercise, reps: val, mode, rest: restLen, at: new Date().toISOString(), type,
      ...(catTypeHasWeight(catalog, type) && weight > 0 ? { weight } : {}),
    };
    saveDay(key, { sets: [...existing.sets, set] });
    return set;
  };

  const validateToday = () => {
    stopAlarm();
    setRinging(false);
    addSetTo(tk, today);
    startRest();
  };

  // ── Guided session ──────────────────────────────────────────
  const persistRun = (r) => {
    const p = r ? window.storage.set("run:active", JSON.stringify(r)) : window.storage.delete("run:active");
    p.catch((e) => reportError("Sauvegarde de la séance en cours", e));
  };
  const setRunP = (r) => { setRun(r); persistRun(r); };

  const launchWorkout = (wk) => {
    // Expand blocks into individual sets (steps). A block can hold several
    // exercises (superset): each round runs them in order, with an optional
    // small rest between exercises and a rest after each round.
    const steps = [];
    wk.blocks.forEach((b, bi) => {
      // Normalise: support both old (single exercise) and new (exercises[]) blocks.
      const exos = b.exercises || [{ exercise: b.exercise, reps: b.reps, mode: b.mode || "reps" }];
      const rounds = b.rounds || b.series || 1;
      const restBetween = b.restBetween != null ? b.restBetween : 0; // between exos of a round
      const restAfter = b.restAfter != null ? b.restAfter : (b.rest != null ? b.rest : 0); // after a round
      const isSuper = exos.length > 1;
      for (let r = 0; r < rounds; r++) {
        exos.forEach((ex, ei) => {
          const lastExo = ei === exos.length - 1;
          const lastRound = r === rounds - 1;
          // Rest that follows THIS set:
          let restAfterThis;
          if (!lastExo) restAfterThis = restBetween;       // still inside the round
          else restAfterThis = lastRound ? 0 : restAfter;  // end of round (0 on final round)
          steps.push({
            exercise: ex.exercise,
            reps: ex.reps,
            mode: ex.mode || "reps",
            type: ex.type,
            weight: ex.weight,
            rest: restAfterThis,
            round: r + 1,
            rounds,
            exoNo: ei + 1,
            exoCount: exos.length,
            isSuper,
            block: bi,
          });
        });
      }
    });
    if (!steps.length) return;
    setRunP({ name: wk.name, steps, idx: 0, blockCount: wk.blocks.length });
    setTab("workout");
    setRinging(false);
    stopAlarm();
    setRest(0);
    setPhase("rest");
  };

  // Start the effort countdown for the current timed step (guided run).
  const startRunEffort = () => {
    const step = run.steps[run.idx];
    stopAlarm();
    setRinging(false);
    startEffort(step.reps); // step.reps holds seconds for timed sets
  };

  const validateRunStep = () => {
    if (!run) return;
    stopAlarm();
    setRinging(false);
    const step = run.steps[run.idx];
    logSet(tk, step.exercise, step.reps, step.rest, step.mode || "reps", step.type, step.weight);
    const last = run.idx >= run.steps.length - 1;
    if (last) {
      setRunP(null);
      setTab("today");
    } else {
      setRunP({ ...run, idx: run.idx + 1 });
      if (step.rest > 0) startRest(step.rest); // rest defined per block
      else { setRest(0); setRinging(false); setPhase("rest"); }
    }
  };

  // Skip the current set WITHOUT logging it, go straight to the next set.
  const skipRunStep = () => {
    if (!run) return;
    stopAlarm();
    setRinging(false);
    clearInterval(tickRef.current);
    setRest(0);
    setPhase("rest");
    const last = run.idx >= run.steps.length - 1;
    if (last) { setRunP(null); setTab("today"); }
    else setRunP({ ...run, idx: run.idx + 1 });
  };

  // Jump to the first set of the next block (skip the rest of the current one).
  const skipToNextBlock = () => {
    if (!run) return;
    stopAlarm();
    setRinging(false);
    clearInterval(tickRef.current);
    setRest(0);
    setPhase("rest");
    const curBlock = run.steps[run.idx].block;
    const nextIdx = run.steps.findIndex((s, i) => i > run.idx && s.block > curBlock);
    if (nextIdx === -1) { setRunP(null); setTab("today"); }
    else setRunP({ ...run, idx: nextIdx });
  };

  const quitRun = () => {
    stopAlarm();
    setRinging(false);
    setRest(0);
    clearInterval(tickRef.current);
    setRunP(null);
    setTab("today");
  };

  const removeLastToday = () => {
    if (!today.sets.length) return;
    saveDay(tk, { sets: today.sets.slice(0, -1) });
  };

  const pastKeys = Object.keys(history)
    .filter((k) => history[k].sets.length)
    .sort()
    .reverse();

  const stepper = (val, set, min, max, step, suffix) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => set(Math.max(min, val - step))} style={S.step}>–</button>
      <div style={{ minWidth: 92, textAlign: "center" }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: C.chalk, letterSpacing: "-.02em" }}>{val}</span>
        <span style={{ fontSize: 14, color: C.muted, marginLeft: 4 }}>{suffix}</span>
      </div>
      <button onClick={() => set(Math.min(max, val + step))} style={S.step}>+</button>
    </div>
  );

  const groupItems = catItemsFor(catalog, type, group);
  const q = search.trim().toLowerCase();
  const searchHits = q ? catAllExos(catalog).filter((x) => x.name.toLowerCase().includes(q)) : null;
  const typeLabel = (t) => catTypeLabel(catalog, t);

  const exerciseChips = (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍  Rechercher un exercice…"
        style={S.searchInput}
      />

      {searchHits ? (
        <div style={{ margin: "16px 0 6px" }}>
          <div style={S.label}>{searchHits.length} résultat{searchHits.length > 1 ? "s" : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {searchHits.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 14 }}>Aucun exercice trouvé.</div>
            ) : (
              searchHits.map((x, i) => (
                <button
                  key={x.name + i}
                  onClick={() => {
                    setType(x.type);
                    setGroup(x.group);
                    setExercise(x.name);
                    setSearch("");
                  }}
                  style={{ ...S.searchHit, ...(exercise === x.name ? S.chipOn : {}) }}
                >
                  <span>{x.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{typeLabel(x.type)} · {x.group}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Step 1 — Type */}
          <div style={S.pickSection}>
            <div style={S.stepHead}><span style={S.stepDot}>1</span> Type d'exercice</div>
            <div style={{ display: "flex", gap: 8 }}>
              {catalog.types.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setType(t.key);
                    const items = catItemsFor(catalog, t.key, group);
                    if (items.length && !items.includes(exercise)) setExercise(items[0]);
                  }}
                  style={{ ...S.typeChip, ...(type === t.key ? S.typeChipOn : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Group */}
          <div style={S.pickSection}>
            <div style={S.stepHead}><span style={S.stepDot}>2</span> Groupe musculaire</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {catalog.groups.map((g) => {
                const empty = catItemsFor(catalog, type, g).length === 0;
                return (
                  <button
                    key={g}
                    disabled={empty}
                    onClick={() => {
                      setGroup(g);
                      const items = catItemsFor(catalog, type, g);
                      if (items.length && !items.includes(exercise)) setExercise(items[0]);
                    }}
                    style={{ ...S.catChip, ...(group === g ? S.catChipOn : {}), ...(empty ? S.catChipOff : {}) }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3 — Exercise */}
          <div style={S.pickSection}>
            <div style={S.stepHead}><span style={S.stepDot}>3</span> Exercice <span style={{ color: C.muted, fontWeight: 600 }}>· {group}</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {groupItems.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 14 }}>Aucun exercice pour ce groupe en {typeLabel(type)?.toLowerCase()}.</div>
              ) : (
              groupItems.map((e) => (
                <button key={e} onClick={() => setExercise(e)} style={{ ...S.chip, ...(exercise === e ? S.chipOn : {}) }}>
                  {e}
                </button>
              ))
            )}
            </div>
          </div>

          {/* Charge — uniquement pour les types qui l'impliquent */}
          {catTypeHasWeight(catalog, type) && (
            <div style={S.pickSection}>
              <div style={S.stepHead}><span style={S.stepDot}>+</span> Charge</div>
              {stepper(weight, setWeight, 0, 300, 2.5, "kg")}
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {syncError && (
          <div style={S.errorBanner}>
            <span>⚠️ {syncError}</span>
            <button onClick={() => setSyncError(null)} style={S.errorBannerClose}>×</button>
          </div>
        )}

        <header style={{ marginBottom: 22 }}>
          <div style={S.eyebrow}>Séance du soir</div>
          <h1 style={S.h1}>Suivi pompes</h1>
          <div style={{ color: C.muted, fontSize: 14, marginTop: 2, textTransform: "capitalize" }}>{fmtDate(tk)}</div>
        </header>

        {!run && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setTab("today")} style={{ ...S.tab, ...(tab === "today" ? S.tabOn : {}) }}>
            Aujourd'hui
          </button>
          <button onClick={() => setTab("catchup")} style={{ ...S.tab, ...(tab === "catchup" ? S.tabOn : {}) }}>
            Rattrapage
          </button>
          <button onClick={() => setTab("workout")} style={{ ...S.tab, ...(tab === "workout" ? S.tabOn : {}) }}>
            Entraînements
          </button>
          <button onClick={() => setTab("progress")} style={{ ...S.tab, ...(tab === "progress" ? S.tabOn : {}) }}>
            Progrès
          </button>
          <button onClick={() => setTab("catalog")} style={{ ...S.tab, ...(tab === "catalog" ? S.tabOn : {}) }}>
            Catalogue
          </button>
        </div>
        )}

        {!run && tab === "today" && (
          <>
            {/* Timer — rest between sets, or effort countdown for timed sets */}
            <div style={{ ...S.card, ...(rest > 0 || ringing ? S.cardLive : {}), ...(ringing ? S.cardRing : {}), ...(phase === "effort" && rest > 0 ? S.cardEffort : {}), textAlign: "center", padding: "26px 20px" }}>
              <div style={{ ...S.label, color: ringing ? C.ring : rest > 0 ? (phase === "effort" ? C.effort : C.lime) : C.muted }}>
                {ringing
                  ? (phase === "effort" ? "Temps écoulé !" : "Repos terminé !")
                  : rest > 0
                  ? (phase === "effort" ? "Effort en cours" : "Repos en cours")
                  : "Chrono repos"}
              </div>
              <div
                style={{
                  fontSize: 64, fontWeight: 800, lineHeight: 1, margin: "6px 0",
                  fontVariantNumeric: "tabular-nums",
                  color: ringing ? C.ring : rest > 0 ? (phase === "effort" ? C.effort : C.lime) : C.chalk,
                  textShadow: ringing ? `0 0 40px ${C.ring}88` : rest > 0 ? `0 0 32px ${(phase === "effort" ? C.effort : C.lime)}55` : "none",
                  transition: "color .3s",
                }}
              >
                {ringing ? "00:00" : mmss(rest > 0 ? rest : restLen)}
              </div>
              {ringing ? (
                <button
                  onClick={() => {
                    stopAlarm(); setRinging(false); setRest(0);
                    if (phase === "effort") { setPhase("rest"); startRest(); }
                  }}
                  style={S.stop}
                >
                  {phase === "effort" ? "Stop · lancer le repos" : "Stop"}
                </button>
              ) : rest > 0 ? (
                <button onClick={() => { clearInterval(tickRef.current); setRest(0); setPhase("rest"); }} style={S.ghost}>
                  {phase === "effort" ? "Arrêter l'effort" : "Passer le repos"}
                </button>
              ) : (
                <>
                  <div style={{ marginTop: 6 }}>{stepper(restLen, setRestLen, 10, 300, 10, "s de repos")}</div>
                  <button onClick={() => { ensureAudio(); burst(); }} style={{ ...S.ghost, marginTop: 14 }}>
                    Tester le son
                  </button>
                </>
              )}
            </div>

            <div style={S.card}>
              {exerciseChips}

              <div style={S.stepHead}><span style={S.stepDot}>4</span> Mesure de la série</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button onClick={() => setMode("reps")} style={{ ...S.typeChip, ...(mode === "reps" ? S.typeChipOn : {}) }}>
                  Répétitions
                </button>
                <button onClick={() => setMode("time")} style={{ ...S.typeChip, ...(mode === "time" ? S.typeChipOn : {}) }}>
                  Temps
                </button>
              </div>

              {mode === "reps" ? (
                <>
                  <div style={S.label}>Répétitions dans la série</div>
                  <div style={{ marginBottom: 22 }}>{stepper(reps, setReps, 1, 200, 1, "reps")}</div>
                  <button onClick={validateToday} style={S.validate}>
                    Valider la série · {reps} reps
                  </button>
                </>
              ) : (
                <>
                  <div style={S.label}>Durée de la série</div>
                  <div style={{ marginBottom: 14 }}>{stepper(secs, setSecs, 5, 600, 5, "s")}</div>
                  <div style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>
                    = {fmtVal(secs, "time")} d'effort
                  </div>
                  <button
                    onClick={() => {
                      // Run the effort countdown; when it ends, log the set then start rest.
                      startEffort(secs, () => {
                        logSet(tk, exercise, secs, restLen, "time", type, catTypeHasWeight(catalog, type) ? weight : undefined);
                      });
                    }}
                    style={{ ...S.validate, background: C.effort }}
                  >
                    Démarrer · {fmtVal(secs, "time")}
                  </button>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 10, textAlign: "center" }}>
                    Le décompte sonne à la fin, puis le repos démarre.
                  </div>
                </>
              )}
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <div style={S.label}>Séries d'aujourd'hui</div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  {today.sets.length} séries
                </div>
              </div>
              {today.sets.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 14, padding: "8px 0" }}>
                  Aucune série encore. Valide ta première pour lancer le chrono.
                </div>
              ) : (
                <div>
                  {today.sets.map((s, i) => (
                    <div key={i} style={S.row}>
                      <div style={S.rowNum}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.chalk, fontSize: 14, fontWeight: 600 }}>{s.exercise}</div>
                        <div style={{ color: C.muted, fontSize: 12 }}>
                          {new Date(s.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · repos {s.rest}s
                        </div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.mode === "time" ? C.effort : C.done, textAlign: "right" }}>
                        {fmtVal(s.reps, s.mode)}
                        {s.weight ? <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>@{s.weight}kg</div> : null}
                      </div>
                    </div>
                  ))}
                  <button onClick={removeLastToday} style={{ ...S.ghost, marginTop: 12 }}>
                    Annuler la dernière
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {!run && tab === "catchup" && (
          <CatchUp
            exerciseChips={exerciseChips}
            exercise={exercise}
            type={type}
            catalog={catalog}
            weight={weight}
            reps={reps}
            setReps={setReps}
            secs={secs}
            setSecs={setSecs}
            mode={mode}
            setMode={setMode}
            stepper={stepper}
            history={history}
            saveDay={saveDay}
            todayKey={tk}
          />
        )}

        {!run && tab === "workout" && (
          <WorkoutTab
            workouts={workouts}
            saveWorkout={saveWorkout}
            deleteWorkout={deleteWorkout}
            launchWorkout={launchWorkout}
            stepper={stepper}
            catalog={catalog}
          />
        )}

        {!run && tab === "progress" && (
          <ProgressTab history={history} goals={goals} saveGoal={saveGoal} deleteGoal={deleteGoal} stepper={stepper} catalog={catalog} />
        )}

        {!run && tab === "catalog" && (
          <CatalogTab catalog={catalog} saveCatalog={saveCatalog} />
        )}

        {run && (
          <div>
            {(() => {
              const step = run.steps[run.idx];
              const total = run.steps.length;
              return (
                <>
                  <div style={{ ...S.card, ...(rest > 0 || ringing ? S.cardLive : {}), ...(ringing ? S.cardRing : {}), ...(phase === "effort" && rest > 0 ? S.cardEffort : {}), textAlign: "center", padding: "24px 20px" }}>
                    <div style={{ ...S.label, color: ringing ? C.ring : (phase === "effort" && rest > 0 ? C.effort : C.lime) }}>
                      {run.name} · série {run.idx + 1}/{total}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: C.chalk, margin: "6px 0 2px" }}>
                      {step.exercise}
                    </div>
                    <div style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>
                      {step.rounds > 1 && `Tour ${step.round}/${step.rounds}`}
                      {step.isSuper && `${step.rounds > 1 ? " · " : ""}exo ${step.exoNo}/${step.exoCount}`}
                      {(step.rounds > 1 || step.isSuper) && " · "}
                      objectif {fmtVal(step.reps, step.mode)}{step.mode === "time" ? "" : " reps"}{step.weight ? ` @${step.weight}kg` : ""}
                      {step.rest > 0 ? ` · repos ${step.rest}s` : (step.isSuper && step.exoNo < step.exoCount ? " · enchaîner" : "")}
                    </div>

                    <div
                      style={{
                        fontSize: 56, fontWeight: 800, lineHeight: 1, margin: "4px 0 14px",
                        fontVariantNumeric: "tabular-nums",
                        color: ringing ? C.ring : rest > 0 ? (phase === "effort" ? C.effort : C.lime) : C.chalk,
                        textShadow: ringing ? `0 0 40px ${C.ring}88` : rest > 0 ? `0 0 32px ${(phase === "effort" ? C.effort : C.lime)}55` : "none",
                      }}
                    >
                      {ringing ? "00:00" : rest > 0 ? mmss(rest) : fmtVal(step.reps, step.mode)}
                      {rest === 0 && !ringing && step.mode !== "time" && <span style={{ fontSize: 18, color: C.muted, marginLeft: 6 }}>reps</span>}
                    </div>

                    {ringing ? (
                      <button
                        onClick={() => {
                          stopAlarm(); setRinging(false); setRest(0);
                          // If the effort just ended, log the set and advance now.
                          if (phase === "effort") { setPhase("rest"); validateRunStep(); }
                        }}
                        style={S.stop}
                      >
                        {phase === "effort" ? "Stop · série terminée" : "Stop · prêt pour la suite"}
                      </button>
                    ) : rest > 0 && phase === "effort" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { clearInterval(tickRef.current); setRest(0); setPhase("rest"); validateRunStep(); }} style={{ ...S.validate, flex: 1, background: C.effort }}>
                          Arrêter · valider
                        </button>
                        <button onClick={skipRunStep} style={S.ghost}>
                          Passer
                        </button>
                      </div>
                    ) : rest > 0 ? (
                      <button onClick={() => { clearInterval(tickRef.current); setRest(0); setPhase("rest"); }} style={S.ghost}>
                        Passer le repos
                      </button>
                    ) : step.mode === "time" ? (
                      <button onClick={startRunEffort} style={{ ...S.validate, background: C.effort }}>
                        Démarrer l'effort · {fmtVal(step.reps, "time")}
                      </button>
                    ) : (
                      <button onClick={validateRunStep} style={S.validate}>
                        {run.idx >= total - 1 ? "Valider · terminer la séance" : "Valider la série"}
                      </button>
                    )}

                    {/* Secondary actions — skip set / skip whole block */}
                    {!ringing && !(rest > 0) && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
                        <button onClick={skipRunStep} style={S.ghostSmall}>Passer la série</button>
                        {(run.blockCount || 1) > 1 && (
                          <button onClick={skipToNextBlock} style={S.ghostSmall}>Bloc suivant ⏭</button>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={S.card}>
                    <div style={{ ...S.label, marginBottom: 14 }}>Déroulé</div>
                    {run.steps.map((s, i) => (
                      <div key={i} style={{ ...S.row, opacity: i < run.idx ? 0.45 : 1, borderColor: i === run.idx ? C.lime : C.line }}>
                        <div style={{ ...S.rowNum, background: i < run.idx ? C.done : i === run.idx ? C.lime : C.panelHi, color: i <= run.idx ? C.ground : C.muted }}>
                          {i < run.idx ? "✓" : i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: C.chalk, fontSize: 14, fontWeight: 600 }}>
                            {s.exercise}
                            {s.rounds > 1 && <span style={{ color: C.muted, fontWeight: 500 }}> · T{s.round}</span>}
                          </div>
                          <div style={{ color: C.muted, fontSize: 12 }}>
                            {fmtVal(s.reps, s.mode)}{s.mode === "time" ? "" : " reps"}{s.weight ? ` @${s.weight}kg` : ""}{s.rest > 0 ? ` · repos ${s.rest}s` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={quitRun} style={{ ...S.ghost, marginTop: 12 }}>
                      Quitter la séance
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* History (always visible) */}
        {!run && pastKeys.length > 0 && (
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 14 }}>Historique</div>
            {pastKeys.map((k) => {
              const sets = history[k].sets;
              const repsTot = sets.filter((s) => s.mode !== "time").reduce((a, s) => a + s.reps, 0);
              const timeTot = sets.filter((s) => s.mode === "time").reduce((a, s) => a + s.reps, 0);
              const parts = [];
              if (repsTot) parts.push(`${repsTot} reps`);
              if (timeTot) parts.push(fmtVal(timeTot, "time"));
              return (
                <div key={k} style={S.histRow}>
                  <div style={{ textTransform: "capitalize", color: k === tk ? C.lime : C.chalk, fontSize: 14 }}>
                    {fmtDate(k)} {k === tk ? "· aujourd'hui" : ""}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13 }}>
                    {sets.length} séries{parts.length ? " · " : ""}<span style={{ color: C.chalk, fontWeight: 700 }}>{parts.join(" + ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 8 }}>
          {loading ? "Chargement…" : "Données sauvegardées automatiquement."}
        </div>
      </div>
    </div>
  );
}

// ── Catch-up tab: log a session on any past date ─────────────
function CatchUp({ exerciseChips, exercise, type, catalog, weight, reps, setReps, secs, setSecs, mode, setMode, stepper, history, saveDay, todayKey }) {
  const [date, setDate] = useState(todayKey);
  const [series, setSeries] = useState(3);
  const [msg, setMsg] = useState("");

  const existing = history[date] || { sets: [] };
  const val = mode === "time" ? secs : reps;

  const addBatch = () => {
    const now = new Date().toISOString();
    const newSets = Array.from({ length: series }, () => ({
      exercise, reps: val, mode, rest: 0, at: now, type,
      ...(catTypeHasWeight(catalog, type) && weight > 0 ? { weight } : {}),
    }));
    saveDay(date, { sets: [...existing.sets, ...newSets] });
    setMsg(`${series} série(s) de ${fmtVal(val, mode)} ajoutée(s).`);
    setTimeout(() => setMsg(""), 2500);
  };

  const clearDay = () => {
    saveDay(date, { sets: [] });
    setMsg("Journée vidée.");
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div style={S.card}>
      <div style={S.label}>Jour à rattraper</div>
      <input
        type="date"
        value={date}
        max={todayKey}
        onChange={(e) => setDate(e.target.value)}
        style={S.dateInput}
      />

      <div style={{ height: 18 }} />
      {exerciseChips}

      <div style={S.stepHead}><span style={S.stepDot}>4</span> Mesure de la série</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setMode("reps")} style={{ ...S.typeChip, ...(mode === "reps" ? S.typeChipOn : {}) }}>Répétitions</button>
        <button onClick={() => setMode("time")} style={{ ...S.typeChip, ...(mode === "time" ? S.typeChipOn : {}) }}>Temps</button>
      </div>

      {mode === "reps" ? (
        <>
          <div style={S.label}>Répétitions par série</div>
          <div style={{ marginBottom: 20 }}>{stepper(reps, setReps, 1, 200, 1, "reps")}</div>
        </>
      ) : (
        <>
          <div style={S.label}>Durée par série</div>
          <div style={{ marginBottom: 6 }}>{stepper(secs, setSecs, 5, 600, 5, "s")}</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>= {fmtVal(secs, "time")}</div>
        </>
      )}

      <div style={S.label}>Nombre de séries</div>
      <div style={{ marginBottom: 22 }}>{stepper(series, setSeries, 1, 30, 1, "séries")}</div>

      <button onClick={addBatch} style={S.validate}>
        Ajouter à cette date
      </button>

      {existing.sets.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>
            Déjà enregistré ce jour : {existing.sets.length} séries
          </div>
          <button onClick={clearDay} style={S.ghost}>
            Vider cette journée
          </button>
        </div>
      )}

      {msg && <div style={{ marginTop: 14, color: C.done, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
    </div>
  );
}

// ── Workout tab: build reusable sessions, then launch them ───
function WorkoutTab({ workouts, saveWorkout, deleteWorkout, launchWorkout, stepper, catalog }) {
  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [editId, setEditId] = useState(null);

  // Exercise picker (adds to the current block draft).
  const [bType, setBType] = useState(defaultTypeKey(catalog));
  const [bGroup, setBGroup] = useState(catalog.groups[0] || "");
  const [bEx, setBEx] = useState(catItemsFor(catalog, defaultTypeKey(catalog), catalog.groups[0])[0] || "");
  const [bMode, setBMode] = useState("reps");
  const [bReps, setBReps] = useState(10);
  const [bSecs, setBSecs] = useState(30);
  const [bWeight, setBWeight] = useState(20);

  // Current block draft (list of exercises = superset when length > 1).
  const [draft, setDraft] = useState([]); // [{exercise, reps, mode}]
  const [rounds, setRounds] = useState(5);
  const [restBetween, setRestBetween] = useState(0);  // repos entre exos d'un tour
  const [restAfter, setRestAfter] = useState(90);     // repos après un tour

  const bItems = catItemsFor(catalog, bType, bGroup);

  const addExoToDraft = () => {
    setDraft((d) => [
      ...d,
      {
        exercise: bEx, reps: bMode === "time" ? bSecs : bReps, mode: bMode, type: bType,
        ...(catTypeHasWeight(catalog, bType) && bWeight > 0 ? { weight: bWeight } : {}),
      },
    ]);
  };
  const removeExoFromDraft = (i) => setDraft((d) => d.filter((_, j) => j !== i));

  const addBlock = () => {
    if (!draft.length) return;
    setBlocks((bl) => [
      ...bl,
      {
        exercises: draft,
        rounds,
        restBetween: draft.length > 1 ? restBetween : 0,
        restAfter,
      },
    ]);
    setDraft([]);
  };
  const removeBlock = (i) => setBlocks((bl) => bl.filter((_, j) => j !== i));
  const moveBlock = (i, dir) => setBlocks((bl) => {
    const j = i + dir;
    if (j < 0 || j >= bl.length) return bl;
    const n = [...bl];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const reset = () => { setName(""); setBlocks([]); setDraft([]); setEditId(null); };

  const save = () => {
    if (!name.trim() || !blocks.length) return;
    const id = editId || "w" + Date.now();
    saveWorkout({ id, name: name.trim(), blocks });
    reset();
  };

  const edit = (wk) => {
    setEditId(wk.id);
    setName(wk.name);
    // Normalise old blocks to the new shape for editing.
    setBlocks(wk.blocks.map((b) => b.exercises ? b : {
      exercises: [{ exercise: b.exercise, reps: b.reps, mode: b.mode || "reps" }],
      rounds: b.series || 1,
      restBetween: 0,
      restAfter: b.rest != null ? b.rest : 0,
    }));
    setDraft([]);
  };

  // Human summary of a block.
  const blockSummary = (b) => {
    const exos = b.exercises || [{ exercise: b.exercise, reps: b.reps, mode: b.mode }];
    const rds = b.rounds || b.series || 1;
    const exoStr = exos.map((e) => `${fmtVal(e.reps, e.mode)}${e.mode === "time" ? "" : "×"} ${e.exercise}${e.weight ? ` @${e.weight}kg` : ""}`).join(" + ");
    return `${rds} tour${rds > 1 ? "s" : ""} · ${exoStr}`;
  };

  const list = Object.values(workouts).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {/* Saved workouts */}
      {list.length > 0 && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 14 }}>Mes entraînements</div>
          {list.map((wk) => (
            <div key={wk.id} style={{ ...S.row, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.chalk, fontSize: 15, fontWeight: 700 }}>{wk.name}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {wk.blocks.length} bloc{wk.blocks.length > 1 ? "s" : ""}
                </div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  {wk.blocks.map((b, i) => <div key={i}>{blockSummary(b)}</div>)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => launchWorkout(wk)} style={S.launch}>Lancer</button>
                  <button onClick={() => edit(wk)} style={S.ghost}>Modifier</button>
                  <button onClick={() => deleteWorkout(wk.id)} style={S.ghost}>Suppr.</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Builder */}
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 12 }}>{editId ? "Modifier l'entraînement" : "Nouvel entraînement"}</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex. Séance du soir, Haut du corps…)"
          style={S.searchInput}
        />

        {/* Blocks already added */}
        {blocks.length > 0 && (
          <div style={{ margin: "16px 0" }}>
            {blocks.map((b, i) => (
              <div key={i} style={S.blockRow}>
                <div style={S.rowNum}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.chalk, fontSize: 14, fontWeight: 600 }}>
                    {(b.exercises || []).length > 1 ? "Superset" : (b.exercises ? b.exercises[0].exercise : b.exercise)}
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>
                    {blockSummary(b)}
                    {b.restAfter ? ` · repos ${b.restAfter}s/tour` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveBlock(i, -1)} disabled={i === 0} style={{ ...S.moveBtn, ...(i === 0 ? S.moveOff : {}) }}>▲</button>
                  <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} style={{ ...S.moveBtn, ...(i === blocks.length - 1 ? S.moveOff : {}) }}>▼</button>
                </div>
                <button onClick={() => removeBlock(i)} style={S.xBtn}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Block draft builder ── */}
        <div style={{ ...S.pickSection, marginTop: 16 }}>
          <div style={S.stepHead}><span style={S.stepDot}>+</span> Composer un bloc</div>

          {/* draft exercises */}
          {draft.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {draft.map((e, i) => (
                <div key={i} style={S.draftRow}>
                  <span style={{ color: C.lime, fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: C.chalk, fontSize: 14, fontWeight: 600 }}>{e.exercise}</span>
                    <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>
                      {fmtVal(e.reps, e.mode)}{e.mode === "time" ? "" : " reps"}
                    </span>
                  </div>
                  <button onClick={() => removeExoFromDraft(i)} style={S.xBtn}>×</button>
                </div>
              ))}
              {draft.length > 1 && (
                <div style={{ color: C.effort, fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                  Superset · {draft.length} exos enchaînés
                </div>
              )}
            </div>
          )}

          {/* exercise picker */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {catalog.types.map((t) => (
              <button
                key={t.key}
                onClick={() => { setBType(t.key); const it = catItemsFor(catalog, t.key, bGroup); if (it.length && !it.includes(bEx)) setBEx(it[0]); }}
                style={{ ...S.typeChip, ...(bType === t.key ? S.typeChipOn : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {catalog.groups.map((g) => {
              const empty = catItemsFor(catalog, bType, g).length === 0;
              return (
                <button
                  key={g}
                  disabled={empty}
                  onClick={() => { setBGroup(g); const it = catItemsFor(catalog, bType, g); if (it.length && !it.includes(bEx)) setBEx(it[0]); }}
                  style={{ ...S.catChip, ...(bGroup === g ? S.catChipOn : {}), ...(empty ? S.catChipOff : {}) }}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {bItems.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13 }}>Aucun exercice ici.</div>
            ) : (
              bItems.map((e) => (
                <button key={e} onClick={() => setBEx(e)} style={{ ...S.chip, ...(bEx === e ? S.chipOn : {}) }}>{e}</button>
              ))
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setBMode("reps")} style={{ ...S.typeChip, ...(bMode === "reps" ? S.typeChipOn : {}) }}>Répétitions</button>
            <button onClick={() => setBMode("time")} style={{ ...S.typeChip, ...(bMode === "time" ? S.typeChipOn : {}) }}>Temps</button>
          </div>
          {bMode === "reps" ? (
            <div style={{ marginBottom: 12 }}>{stepper(bReps, setBReps, 1, 200, 1, "reps")}</div>
          ) : (
            <div style={{ marginBottom: 12 }}>{stepper(bSecs, setBSecs, 5, 600, 5, "s")}</div>
          )}

          {catTypeHasWeight(catalog, bType) && (
            <div style={{ marginBottom: 12 }}>{stepper(bWeight, setBWeight, 0, 300, 2.5, "kg")}</div>
          )}

          <button onClick={addExoToDraft} style={{ ...S.ghost, width: "100%", padding: "12px", borderColor: C.lime, color: C.lime }}>
            + Ajouter {bEx} au bloc
          </button>
        </div>

        {/* block parameters (only meaningful once draft has content) */}
        {draft.length > 0 && (
          <div style={{ ...S.pickSection }}>
            <div style={S.stepHead}><span style={S.stepDot}>⟳</span> Paramètres du bloc</div>

            <div style={S.gridLabel}>Nombre de tours</div>
            <div style={{ marginBottom: 14 }}>{stepper(rounds, setRounds, 1, 30, 1, "tours")}</div>

            {draft.length > 1 && (
              <>
                <div style={S.gridLabel}>Repos entre exos du tour</div>
                <div style={{ marginBottom: 14 }}>{stepper(restBetween, setRestBetween, 0, 180, 5, "s")}</div>
              </>
            )}

            <div style={S.gridLabel}>Repos après chaque tour</div>
            <div style={{ marginBottom: 18 }}>{stepper(restAfter, setRestAfter, 0, 300, 5, "s")}</div>

            <button onClick={addBlock} style={{ ...S.validate, width: "100%", background: C.effort }}>
              Valider ce bloc ({draft.length > 1 ? "superset" : "1 exo"} × {rounds} tours)
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={save} style={{ ...S.validate, flex: 1, opacity: name.trim() && blocks.length ? 1 : 0.4 }}>
            {editId ? "Enregistrer" : "Créer l'entraînement"}
          </button>
          {(editId || blocks.length > 0 || name || draft.length > 0) && (
            <button onClick={reset} style={S.ghost}>Annuler</button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Progress tab: global overview by default, with an optional
// per-exercise filter, bucketed by week / month / year ─────────
const PERIODS = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

function bucketKey(dateStr, period) {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "year") return String(d.getFullYear());
  if (period === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // week: clé = lundi de la semaine
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function bucketLabel(key, period) {
  if (period === "year") return key;
  if (period === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  return "Sem. " + new Date(key + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// Une seule fonction pour calculer n'importe quel KPI/objectif à partir
// d'une liste de séries — évite de dupliquer la logique entre les tuiles
// de stats et le suivi d'objectifs.
function metricValue(sets, metric) {
  switch (metric) {
    case "sessions": return new Set(sets.map((s) => s.date)).size;
    case "series": return sets.length;
    case "reps": return sets.filter((s) => s.mode !== "time").reduce((a, s) => a + s.reps, 0);
    case "time": return sets.filter((s) => s.mode === "time").reduce((a, s) => a + s.reps, 0);
    case "volume": return sets.reduce((a, s) => a + (s.weight ? s.reps * s.weight : 0), 0);
    case "weight": return sets.reduce((a, s) => Math.max(a, s.weight || 0), 0);
    default: return 0;
  }
}

const METRIC_INFO = {
  sessions: { label: "Séances", unit: "", step: 1 },
  series: { label: "Séries", unit: "", step: 1 },
  reps: { label: "Reps", unit: "", step: 5 },
  time: { label: "Temps", unit: "s", step: 30 },
  volume: { label: "Volume", unit: "kg", step: 50 },
  weight: { label: "Charge max", unit: "kg", step: 2.5 },
};

function ProgressTab({ history, goals, saveGoal, deleteGoal, stepper, catalog }) {
  const [period, setPeriod] = useState("week");
  const [type, setType] = useState(defaultTypeKey(catalog));
  const [group, setGroup] = useState(catalog.groups[0] || "");
  const [exercise, setExercise] = useState(null); // null = vue globale (tous exercices)
  const [search, setSearch] = useState("");

  const groupItems = catItemsFor(catalog, type, group);
  const q = search.trim().toLowerCase();
  const searchHits = q ? catAllExos(catalog).filter((x) => x.name.toLowerCase().includes(q)) : null;
  const typeLabel = (t) => catTypeLabel(catalog, t);

  // Toutes les séries, aplaties avec leur date.
  const allSets = [];
  Object.keys(history).forEach((d) => {
    (history[d].sets || []).forEach((s) => allSets.push({ ...s, date: d }));
  });
  const scoped = exercise ? allSets.filter((s) => s.exercise === exercise) : allSets;

  // Regroupement par période (semaine/mois/année), chronologique.
  const buckets = {};
  scoped.forEach((s) => {
    const key = bucketKey(s.date, period);
    (buckets[key] = buckets[key] || []).push(s);
  });
  const bucketKeys = Object.keys(buckets).sort();

  const rows = bucketKeys.map((key) => {
    const sets = buckets[key];
    if (exercise) {
      const hasWeight = sets.some((s) => s.weight > 0);
      const isTime = sets.every((s) => s.mode === "time");
      let metric, label, unit;
      if (hasWeight) { metric = sets.reduce((a, s) => a + s.reps * (s.weight || 0), 0); label = "Volume"; unit = "kg"; }
      else if (isTime) { metric = sets.reduce((a, s) => a + s.reps, 0); label = "Temps total"; unit = "s"; }
      else { metric = sets.reduce((a, s) => a + s.reps, 0); label = "Reps totales"; unit = ""; }
      const maxWeight = hasWeight ? Math.max(...sets.map((s) => s.weight || 0)) : null;
      return { key, sets, metric, label, unit, maxWeight };
    }
    // Vue globale : nombre de séries + top exercices de la période.
    const byExo = {};
    sets.forEach((s) => { byExo[s.exercise] = (byExo[s.exercise] || 0) + 1; });
    const top = Object.entries(byExo).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { key, sets, metric: sets.length, label: "Séries", unit: "", top };
  });

  const maxMetric = Math.max(1, ...rows.map((r) => r.metric));

  // ── KPIs clés (tout l'historique, respecte le filtre exercice) ──
  const kSessions = metricValue(scoped, "sessions");
  const kSeries = metricValue(scoped, "series");
  const kReps = metricValue(scoped, "reps");
  const kTime = metricValue(scoped, "time");
  const kVolume = metricValue(scoped, "volume");
  const kWeight = metricValue(scoped, "weight");
  let favorite = null;
  if (!exercise) {
    const counts = {};
    allSets.forEach((s) => { counts[s.exercise] = (counts[s.exercise] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    favorite = top ? top[0] : null;
  }

  // ── Objectifs ─────────────────────────────────────────────────
  const availableMetrics = exercise
    ? (kWeight > 0 ? ["weight", "volume", "sessions", "series"] : kTime > 0 ? ["time", "sessions", "series"] : ["reps", "sessions", "series"])
    : ["sessions", "series", "reps", "volume", "time"];
  const scopedGoals = Object.values(goals).filter((g) => (exercise ? g.exercise === exercise : !g.exercise));

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [gMetric, setGMetric] = useState("sessions");
  const [gTarget, setGTarget] = useState(10);
  const [gDeadline, setGDeadline] = useState("");

  const addGoal = () => {
    saveGoal({
      id: "g" + Date.now(),
      exercise: exercise || null,
      metric: gMetric,
      target: gTarget,
      unit: METRIC_INFO[gMetric].unit,
      deadline: gDeadline || null,
      createdAt: new Date().toISOString(),
    });
    setShowGoalForm(false);
    setGTarget(10);
    setGDeadline("");
  };

  const goalProgress = (g) => {
    const relevant = allSets.filter((s) => (g.exercise ? s.exercise === g.exercise : true) && s.date >= g.createdAt.slice(0, 10));
    const current = metricValue(relevant, g.metric);
    return { current, pct: Math.min(100, Math.round((current / g.target) * 100)) };
  };

  return (
    <>
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={S.label}>Filtrer par exercice</div>
          {exercise && (
            <button onClick={() => { setExercise(null); setSearch(""); }} style={S.ghostSmall}>
              Tous les exercices
            </button>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Rechercher un exercice… (laisser vide = vue globale)"
          style={S.searchInput}
        />
        {searchHits ? (
          <div style={{ margin: "16px 0 6px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchHits.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 14 }}>Aucun exercice trouvé.</div>
              ) : (
                searchHits.map((x, i) => (
                  <button
                    key={x.name + i}
                    onClick={() => { setType(x.type); setGroup(x.group); setExercise(x.name); setSearch(""); }}
                    style={{ ...S.searchHit, ...(exercise === x.name ? S.chipOn : {}) }}
                  >
                    <span>{x.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{typeLabel(x.type)} · {x.group}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ ...S.pickSection, marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {catalog.types.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setType(t.key); const it = catItemsFor(catalog, t.key, group); if (it.length) setExercise(it[0]); }}
                  style={{ ...S.typeChip, ...(type === t.key ? S.typeChipOn : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {catalog.groups.map((g) => {
                const empty = catItemsFor(catalog, type, g).length === 0;
                return (
                  <button
                    key={g}
                    disabled={empty}
                    onClick={() => { setGroup(g); const it = catItemsFor(catalog, type, g); if (it.length) setExercise(it[0]); }}
                    style={{ ...S.catChip, ...(group === g ? S.catChipOn : {}), ...(empty ? S.catChipOff : {}) }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {groupItems.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 14 }}>Aucun exercice pour ce groupe.</div>
              ) : (
                groupItems.map((e) => (
                  <button key={e} onClick={() => setExercise(e)} style={{ ...S.chip, ...(exercise === e ? S.chipOn : {}) }}>
                    {e}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 14 }}>Vue d'ensemble{exercise ? ` · ${exercise}` : ""}</div>
        {scoped.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 14 }}>Rien à afficher pour l'instant.</div>
        ) : (
          <div style={S.statGrid}>
            <div style={S.statTile}>
              <div style={S.statValue}>{kSessions}</div>
              <div style={S.statLabel}>Séances</div>
            </div>
            <div style={S.statTile}>
              <div style={S.statValue}>{kSeries}</div>
              <div style={S.statLabel}>Séries</div>
            </div>
            {kReps > 0 && (
              <div style={S.statTile}>
                <div style={S.statValue}>{kReps}</div>
                <div style={S.statLabel}>Reps totales</div>
              </div>
            )}
            {kTime > 0 && (
              <div style={S.statTile}>
                <div style={S.statValue}>{fmtVal(kTime, "time")}</div>
                <div style={S.statLabel}>Temps total</div>
              </div>
            )}
            {kVolume > 0 && (
              <div style={S.statTile}>
                <div style={S.statValue}>{Math.round(kVolume)}<span style={{ fontSize: 13 }}>kg</span></div>
                <div style={S.statLabel}>Volume soulevé</div>
              </div>
            )}
            {kWeight > 0 && (
              <div style={S.statTile}>
                <div style={S.statValue}>{kWeight}<span style={{ fontSize: 13 }}>kg</span></div>
                <div style={S.statLabel}>Charge max</div>
              </div>
            )}
            {favorite && (
              <div style={{ ...S.statTile, flexBasis: "100%" }}>
                <div style={{ ...S.statValue, fontSize: 16 }}>{favorite}</div>
                <div style={S.statLabel}>Exercice favori</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div style={S.label}>{exercise || "Tous les exercices"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{ ...S.ghostSmall, ...(period === p.key ? { background: C.lime, color: C.ground, borderColor: C.lime, fontWeight: 800 } : {}) }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 14, padding: "8px 0" }}>
            {exercise ? "Aucune donnée pour cet exercice pour l'instant." : "Aucune donnée pour l'instant — logue une série pour voir apparaître ta progression."}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150, overflowX: "auto", padding: "8px 2px 4px" }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 34 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, whiteSpace: "nowrap" }}>
                    {Math.round(r.metric)}{r.unit}
                  </div>
                  <div style={{ width: 22, height: Math.max(4, (r.metric / maxMetric) * 100), background: C.lime, borderRadius: 5 }} />
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6, whiteSpace: "nowrap" }}>{bucketLabel(r.key, period)}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              {rows.slice().reverse().map((r, i) => (
                <div key={i} style={S.histRow}>
                  <div style={{ color: C.chalk, fontSize: 14 }}>
                    {bucketLabel(r.key, period)}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, textAlign: "right" }}>
                    {exercise ? (
                      <>
                        {r.sets.length} série{r.sets.length > 1 ? "s" : ""} · <span style={{ color: C.chalk, fontWeight: 700 }}>{r.label} {Math.round(r.metric)}{r.unit}</span>
                        {r.maxWeight ? ` · max ${r.maxWeight}kg` : ""}
                      </>
                    ) : (
                      <>
                        <span style={{ color: C.chalk, fontWeight: 700 }}>{r.metric} série{r.metric > 1 ? "s" : ""}</span>
                        {r.top.length ? " · " + r.top.map(([name, n]) => `${name} ×${n}`).join(", ") : ""}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={S.label}>Objectifs{exercise ? ` · ${exercise}` : " · globaux"}</div>
          <button onClick={() => setShowGoalForm((v) => !v)} style={S.ghostSmall}>
            {showGoalForm ? "Annuler" : "+ Objectif"}
          </button>
        </div>

        {showGoalForm && (
          <div style={{ ...S.pickSection, marginBottom: 14 }}>
            <div style={S.gridLabel}>Métrique</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {availableMetrics.map((m) => (
                <button key={m} onClick={() => setGMetric(m)} style={{ ...S.catChip, ...(gMetric === m ? S.catChipOn : {}) }}>
                  {METRIC_INFO[m].label}
                </button>
              ))}
            </div>
            <div style={S.gridLabel}>Cible</div>
            <div style={{ marginBottom: 14 }}>{stepper(gTarget, setGTarget, 1, 100000, METRIC_INFO[gMetric].step, METRIC_INFO[gMetric].unit)}</div>
            <div style={S.gridLabel}>Échéance (optionnel)</div>
            <input
              type="date"
              value={gDeadline}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setGDeadline(e.target.value)}
              style={{ ...S.dateInput, marginBottom: 14 }}
            />
            <button onClick={addGoal} style={S.validate}>Créer l'objectif</button>
          </div>
        )}

        {scopedGoals.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 14 }}>Aucun objectif{exercise ? " pour cet exercice" : ""} pour l'instant.</div>
        ) : (
          scopedGoals.map((g) => {
            const { current, pct } = goalProgress(g);
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + "T00:00:00") - new Date()) / 86400000) : null;
            const done = pct >= 100;
            return (
              <div key={g.id} style={S.goalCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: C.chalk, fontSize: 14, fontWeight: 700 }}>{METRIC_INFO[g.metric].label}</div>
                  <button onClick={() => deleteGoal(g.id)} style={S.xBtn}>×</button>
                </div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                  {Math.round(current)}{g.unit} / {g.target}{g.unit}
                  {daysLeft != null && (daysLeft >= 0 ? ` · ${daysLeft}j restants` : " · échéance dépassée")}
                </div>
                <div style={S.progressTrack}>
                  <div style={{ ...S.progressFill, width: `${pct}%`, background: done ? C.done : C.lime }} />
                </div>
                <div style={{ color: done ? C.done : C.muted, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                  {pct}%{done ? " · Objectif atteint 🎉" : ""}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ── Catalogue : créer / renommer / supprimer types, groupes et exercices ──
function CatalogTab({ catalog, saveCatalog }) {
  const [mType, setMType] = useState(catalog.types[0]?.key || null);
  const [mGroup, setMGroup] = useState(catalog.groups[0] || null);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeWeight, setNewTypeWeight] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newExoName, setNewExoName] = useState("");

  const slugify = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || ("t" + Date.now());

  const addType = () => {
    const label = newTypeLabel.trim();
    if (!label) return;
    let key = slugify(label);
    if (catalog.types.some((t) => t.key === key)) key = key + "-" + Date.now().toString(36);
    saveCatalog({ ...catalog, types: [...catalog.types, { key, label, hasWeight: newTypeWeight }] });
    setNewTypeLabel("");
    setNewTypeWeight(false);
    setMType(key);
  };
  const renameType = (key) => {
    const cur = catalog.types.find((t) => t.key === key);
    const label = prompt("Renommer le type", cur?.label || "");
    if (!label || !label.trim()) return;
    saveCatalog({ ...catalog, types: catalog.types.map((t) => (t.key === key ? { ...t, label: label.trim() } : t)) });
  };
  const toggleTypeWeight = (key) => {
    saveCatalog({ ...catalog, types: catalog.types.map((t) => (t.key === key ? { ...t, hasWeight: !t.hasWeight } : t)) });
  };
  const deleteType = (key) => {
    const n = catalog.exos.filter((e) => e.type === key).length;
    if (!confirm(n ? `Supprimer ce type et ses ${n} exercice(s) ?` : "Supprimer ce type ?")) return;
    const types = catalog.types.filter((t) => t.key !== key);
    const exos = catalog.exos.filter((e) => e.type !== key);
    saveCatalog({ ...catalog, types, exos });
    if (mType === key) setMType(types[0]?.key || null);
  };

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name || catalog.groups.includes(name)) return;
    saveCatalog({ ...catalog, groups: [...catalog.groups, name] });
    setNewGroupName("");
    setMGroup(name);
  };
  const renameGroup = (name) => {
    const next = prompt("Renommer le groupe", name);
    if (!next || !next.trim() || next.trim() === name) return;
    const trimmed = next.trim();
    saveCatalog({
      ...catalog,
      groups: catalog.groups.map((g) => (g === name ? trimmed : g)),
      exos: catalog.exos.map((e) => (e.group === name ? { ...e, group: trimmed } : e)),
    });
    if (mGroup === name) setMGroup(trimmed);
  };
  const deleteGroup = (name) => {
    const n = catalog.exos.filter((e) => e.group === name).length;
    if (!confirm(n ? `Supprimer ce groupe et ses ${n} exercice(s) ?` : "Supprimer ce groupe ?")) return;
    const groups = catalog.groups.filter((g) => g !== name);
    const exos = catalog.exos.filter((e) => e.group !== name);
    saveCatalog({ ...catalog, groups, exos });
    if (mGroup === name) setMGroup(groups[0] || null);
  };

  const addExo = () => {
    const name = newExoName.trim();
    if (!name || !mType || !mGroup) return;
    const id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    saveCatalog({ ...catalog, exos: [...catalog.exos, { id, name, type: mType, group: mGroup }] });
    setNewExoName("");
  };
  const renameExo = (id) => {
    const cur = catalog.exos.find((e) => e.id === id);
    const name = prompt("Renommer l'exercice", cur?.name || "");
    if (!name || !name.trim()) return;
    saveCatalog({ ...catalog, exos: catalog.exos.map((e) => (e.id === id ? { ...e, name: name.trim() } : e)) });
  };
  const deleteExo = (id) => {
    if (!confirm("Supprimer cet exercice du catalogue ?")) return;
    saveCatalog({ ...catalog, exos: catalog.exos.filter((e) => e.id !== id) });
  };

  const currentExos = catalog.exos.filter((e) => e.type === mType && e.group === mGroup);

  return (
    <>
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 12 }}>Types d'exercice</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {catalog.types.map((t) => (
            <div key={t.key} style={{ ...S.chip, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span onClick={() => renameType(t.key)} style={{ cursor: "pointer" }}>{t.label}</span>
              <button
                onClick={() => toggleTypeWeight(t.key)}
                title="Bascule le suivi de charge (kg) pour ce type"
                style={{ ...S.xBtn, width: 24, height: 24, fontSize: 10, fontWeight: 800, color: t.hasWeight ? C.lime : C.muted, borderColor: t.hasWeight ? C.lime : C.line }}
              >
                kg
              </button>
              <button onClick={() => deleteType(t.key)} style={{ ...S.xBtn, width: 24, height: 24 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} placeholder="Nouveau type (ex. Cardio)" style={{ ...S.searchInput, flex: 1 }} />
          <button onClick={addType} style={S.launch}>+ Ajouter</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 13 }}>
          <input type="checkbox" checked={newTypeWeight} onChange={(e) => setNewTypeWeight(e.target.checked)} />
          Implique une charge externe (kg)
        </label>
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 12 }}>Groupes musculaires</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {catalog.groups.map((g) => (
            <div key={g} style={{ ...S.catChip, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span onClick={() => renameGroup(g)} style={{ cursor: "pointer" }}>{g}</span>
              <button onClick={() => deleteGroup(g)} style={{ ...S.xBtn, width: 20, height: 20, fontSize: 12 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nouveau groupe (ex. Cou)" style={{ ...S.searchInput, flex: 1 }} />
          <button onClick={addGroup} style={S.launch}>+ Ajouter</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 12 }}>Exercices</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {catalog.types.map((t) => (
            <button key={t.key} onClick={() => setMType(t.key)} style={{ ...S.typeChip, flex: "unset", padding: "10px 16px", ...(mType === t.key ? S.typeChipOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {catalog.groups.map((g) => (
            <button key={g} onClick={() => setMGroup(g)} style={{ ...S.catChip, ...(mGroup === g ? S.catChipOn : {}) }}>
              {g}
            </button>
          ))}
        </div>

        {!mType || !mGroup ? (
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 14 }}>Crée au moins un type et un groupe pour ajouter des exercices.</div>
        ) : currentExos.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 14, marginBottom: 14 }}>Aucun exercice ici.</div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            {currentExos.map((e) => (
              <div key={e.id} style={S.draftRow}>
                <span onClick={() => renameExo(e.id)} style={{ flex: 1, color: C.chalk, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {e.name}
                </span>
                <button onClick={() => deleteExo(e.id)} style={S.xBtn}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newExoName}
            onChange={(e) => setNewExoName(e.target.value)}
            placeholder={mType && mGroup ? `Nouvel exercice · ${mGroup}` : "Choisis un type et un groupe d'abord"}
            style={{ ...S.searchInput, flex: 1 }}
          />
          <button onClick={addExo} style={{ ...S.launch, opacity: mType && mGroup ? 1 : 0.4 }}>+ Ajouter</button>
        </div>
      </div>
    </>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: `radial-gradient(1200px 600px at 50% -10%, #1b2230 0%, ${C.ground} 55%)`,
    color: C.chalk,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    padding: "24px 16px 48px",
  },
  wrap: { maxWidth: 440, margin: "0 auto" },
  eyebrow: { fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", color: C.limeDim, fontWeight: 700 },
  h1: { fontSize: 38, fontWeight: 800, letterSpacing: "-.03em", margin: "2px 0 0", lineHeight: 1 },
  tab: {
    flex: 1, padding: "11px", borderRadius: 12, border: `1px solid ${C.line}`,
    background: "transparent", color: C.muted, fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  tabOn: { background: C.panelHi, color: C.chalk, borderColor: C.line },
  card: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, marginBottom: 16 },
  cardLive: { border: `1px solid ${C.limeDim}`, background: "#1b2214" },
  cardRing: { border: `1px solid ${C.ring}`, background: "#241512" },
  cardEffort: { border: `1px solid ${C.effort}`, background: "#0e2230" },
  stop: {
    marginTop: 4, padding: "14px 40px", borderRadius: 14, border: "none",
    background: C.ring, color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer",
    letterSpacing: ".02em",
  },
  label: { fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 12 },
  step: {
    width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.chalk, fontSize: 24, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
  },
  chip: {
    padding: "9px 14px", borderRadius: 999, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  chipOn: { background: C.lime, color: C.ground, borderColor: C.lime, fontWeight: 800, boxShadow: `0 0 0 3px ${C.lime}33` },
  catChip: {
    padding: "8px 13px", borderRadius: 10, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.muted, fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  catChipOn: { background: C.limeDim, color: C.ground, borderColor: C.lime, boxShadow: `0 0 0 2px ${C.lime}44` },
  catChipOff: { opacity: 0.28, cursor: "not-allowed", background: "transparent" },
  pickSection: {
    background: C.ground, border: `1px solid ${C.line}`, borderRadius: 14,
    padding: "14px 14px 16px", marginBottom: 12,
  },
  stepHead: {
    display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700,
    color: C.chalk, marginBottom: 12,
  },
  stepDot: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 22, height: 22, borderRadius: 999, background: C.lime, color: C.ground,
    fontSize: 12, fontWeight: 800,
  },
  typeChip: {
    flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.line}`,
    background: "transparent", color: C.muted, fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  typeChipOn: { background: C.chalk, color: C.ground, borderColor: C.chalk, boxShadow: `0 0 0 2px ${C.chalk}33` },
  searchHit: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
    padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.chalk, fontSize: 14, fontWeight: 600, cursor: "pointer",
    textAlign: "left", width: "100%",
  },
  validate: {
    width: "100%", marginTop: 4, padding: "16px", borderRadius: 14, border: "none",
    background: C.lime, color: C.ground, fontSize: 16, fontWeight: 800, cursor: "pointer", letterSpacing: "-.01em",
  },
  ghost: {
    background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
    padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  ghostSmall: {
    background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
    padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  dateInput: {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.chalk, fontSize: 15, fontWeight: 600, colorScheme: "dark",
  },
  searchInput: {
    width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${C.line}`, background: C.panelHi, color: C.chalk, fontSize: 15,
    fontWeight: 600, outline: "none",
  },
  gridLabel: { fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 },
  launch: {
    padding: "9px 20px", borderRadius: 10, border: "none", background: C.lime,
    color: C.ground, fontSize: 13, fontWeight: 800, cursor: "pointer",
  },
  blockRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
    borderTop: `1px solid ${C.line}`,
  },
  draftRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
    borderRadius: 10, background: C.panelHi, marginBottom: 6,
  },
  xBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line}`,
    background: "transparent", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1,
  },
  moveBtn: {
    width: 28, height: 20, borderRadius: 6, border: `1px solid ${C.line}`,
    background: C.panelHi, color: C.chalk, fontSize: 10, cursor: "pointer", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  },
  moveOff: { opacity: 0.25, cursor: "not-allowed" },
  row: { display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: `1px solid ${C.line}` },
  rowNum: {
    width: 30, height: 30, borderRadius: 8, background: C.panelHi, color: C.muted,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
  },
  histRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `1px solid ${C.line}` },
  errorBanner: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
    background: "#3a1414", border: `1px solid ${C.ring}`, color: C.chalk,
    padding: "10px 14px", borderRadius: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.4,
  },
  errorBannerClose: {
    background: "transparent", border: "none", color: C.chalk, cursor: "pointer",
    fontWeight: 800, fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0,
  },
  statGrid: { display: "flex", flexWrap: "wrap", gap: 10 },
  statTile: {
    flex: "1 1 105px", minWidth: 105, background: C.panelHi, border: `1px solid ${C.line}`,
    borderRadius: 12, padding: "12px 14px",
  },
  statValue: { fontSize: 22, fontWeight: 800, color: C.chalk, lineHeight: 1.1 },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 },
  goalCard: { background: C.panelHi, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 10 },
  progressTrack: { height: 8, borderRadius: 999, background: C.ground, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", borderRadius: 999, transition: "width .3s" },
};
