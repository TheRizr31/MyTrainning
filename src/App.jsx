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
const TYPES = [
  { key: "charges", label: "Avec charges" },
  { key: "poids", label: "Poids du corps" },
];

const GROUPS = [
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

// EXOS[type][groupe] = liste d'exercices
const EXOS = {
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

// Flat list for search, with type/group context.
const ALL_EXOS = [];
TYPES.forEach((t) =>
  GROUPS.forEach((g) => (EXOS[t.key][g] || []).forEach((e) =>
    ALL_EXOS.push({ name: e, type: t.key, group: g })
  ))
);
const itemsFor = (type, group) => (EXOS[type] && EXOS[type][group]) || [];

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today"); // today | catchup | workout
  const [type, setType] = useState("poids");
  const [group, setGroup] = useState(GROUPS[0]);
  const [exercise, setExercise] = useState(itemsFor("poids", GROUPS[0])[0]);
  const [search, setSearch] = useState("");
  const [restLen, setRestLen] = useState(60);
  const [reps, setReps] = useState(15);
  const [mode, setMode] = useState("reps"); // "reps" | "time"
  const [secs, setSecs] = useState(30);      // duration per set when mode === "time"

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

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.list("day:");
        if (res?.keys?.length) {
          const entries = {};
          for (const k of res.keys) {
            try {
              const r = await window.storage.get(k);
              if (r) entries[k.replace("day:", "")] = JSON.parse(r.value);
            } catch {}
          }
          setHistory(entries);
        }
      } catch {}
      try {
        const wr = await window.storage.list("wk:");
        if (wr?.keys?.length) {
          const ws = {};
          for (const k of wr.keys) {
            try {
              const r = await window.storage.get(k);
              if (r) ws[k.replace("wk:", "")] = JSON.parse(r.value);
            } catch {}
          }
          setWorkouts(ws);
        }
      } catch {}
      try {
        const rr = await window.storage.get("run:active");
        if (rr) {
          const parsed = JSON.parse(rr.value);
          if (parsed && parsed.steps && parsed.idx < parsed.steps.length) {
            setRun(parsed);
            setTab("workout");
          }
        }
      } catch {}
      setLoading(false);
    })();
    return () => { clearInterval(tickRef.current); stopAlarm(); };
  }, []);

  const saveWorkout = async (wk) => {
    setWorkouts((w) => ({ ...w, [wk.id]: wk }));
    try { await window.storage.set("wk:" + wk.id, JSON.stringify(wk)); } catch {}
  };
  const deleteWorkout = async (id) => {
    setWorkouts((w) => { const n = { ...w }; delete n[id]; return n; });
    try { await window.storage.delete("wk:" + id); } catch {}
  };

  const saveDay = async (key, session) => {
    setHistory((h) => ({ ...h, [key]: session }));
    try {
      await window.storage.set("day:" + key, JSON.stringify(session));
    } catch {}
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
  const logSet = (key, ex, val, rst, m = "reps") => {
    setHistory((h) => {
      const cur = h[key] || { sets: [] };
      const set = { exercise: ex, reps: val, mode: m, rest: rst, at: new Date().toISOString() };
      const next = { sets: [...cur.sets, set] };
      window.storage.set("day:" + key, JSON.stringify(next)).catch(() => {});
      return { ...h, [key]: next };
    });
  };

  const addSetTo = (key, existing) => {
    const val = mode === "time" ? secs : reps;
    const set = { exercise, reps: val, mode, rest: restLen, at: new Date().toISOString() };
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
    try {
      if (r) window.storage.set("run:active", JSON.stringify(r));
      else window.storage.delete("run:active");
    } catch {}
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
    logSet(tk, step.exercise, step.reps, step.rest, step.mode || "reps");
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

  const groupItems = itemsFor(type, group);
  const q = search.trim().toLowerCase();
  const searchHits = q ? ALL_EXOS.filter((x) => x.name.toLowerCase().includes(q)) : null;
  const typeLabel = (t) => (TYPES.find((x) => x.key === t) || {}).label;

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
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setType(t.key);
                    const items = itemsFor(t.key, group);
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
              {GROUPS.map((g) => {
                const empty = itemsFor(type, g).length === 0;
                return (
                  <button
                    key={g}
                    disabled={empty}
                    onClick={() => {
                      setGroup(g);
                      const items = itemsFor(type, g);
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
        </>
      )}
    </>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={{ marginBottom: 22 }}>
          <div style={S.eyebrow}>Séance du soir</div>
          <h1 style={S.h1}>Suivi pompes</h1>
          <div style={{ color: C.muted, fontSize: 14, marginTop: 2, textTransform: "capitalize" }}>{fmtDate(tk)}</div>
        </header>

        {!run && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab("today")} style={{ ...S.tab, ...(tab === "today" ? S.tabOn : {}) }}>
            Aujourd'hui
          </button>
          <button onClick={() => setTab("catchup")} style={{ ...S.tab, ...(tab === "catchup" ? S.tabOn : {}) }}>
            Rattrapage
          </button>
          <button onClick={() => setTab("workout")} style={{ ...S.tab, ...(tab === "workout" ? S.tabOn : {}) }}>
            Entraînements
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
                        logSet(tk, exercise, secs, restLen, "time");
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
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.mode === "time" ? C.effort : C.done }}>
                        {fmtVal(s.reps, s.mode)}
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
          />
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
                      objectif {fmtVal(step.reps, step.mode)}{step.mode === "time" ? "" : " reps"}
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
                            {fmtVal(s.reps, s.mode)}{s.mode === "time" ? "" : " reps"}{s.rest > 0 ? ` · repos ${s.rest}s` : ""}
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
function CatchUp({ exerciseChips, exercise, reps, setReps, secs, setSecs, mode, setMode, stepper, history, saveDay, todayKey }) {
  const [date, setDate] = useState(todayKey);
  const [series, setSeries] = useState(3);
  const [msg, setMsg] = useState("");

  const existing = history[date] || { sets: [] };
  const val = mode === "time" ? secs : reps;

  const addBatch = () => {
    const now = new Date().toISOString();
    const newSets = Array.from({ length: series }, () => ({ exercise, reps: val, mode, rest: 0, at: now }));
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
function WorkoutTab({ workouts, saveWorkout, deleteWorkout, launchWorkout, stepper }) {
  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [editId, setEditId] = useState(null);

  // Exercise picker (adds to the current block draft).
  const [bType, setBType] = useState("poids");
  const [bGroup, setBGroup] = useState(GROUPS[0]);
  const [bEx, setBEx] = useState(itemsFor("poids", GROUPS[0])[0]);
  const [bMode, setBMode] = useState("reps");
  const [bReps, setBReps] = useState(10);
  const [bSecs, setBSecs] = useState(30);

  // Current block draft (list of exercises = superset when length > 1).
  const [draft, setDraft] = useState([]); // [{exercise, reps, mode}]
  const [rounds, setRounds] = useState(5);
  const [restBetween, setRestBetween] = useState(0);  // repos entre exos d'un tour
  const [restAfter, setRestAfter] = useState(90);     // repos après un tour

  const bItems = itemsFor(bType, bGroup);

  const addExoToDraft = () => {
    setDraft((d) => [...d, { exercise: bEx, reps: bMode === "time" ? bSecs : bReps, mode: bMode }]);
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
    const exoStr = exos.map((e) => `${fmtVal(e.reps, e.mode)}${e.mode === "time" ? "" : "×"} ${e.exercise}`).join(" + ");
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
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => { setBType(t.key); const it = itemsFor(t.key, bGroup); if (it.length && !it.includes(bEx)) setBEx(it[0]); }}
                style={{ ...S.typeChip, ...(bType === t.key ? S.typeChipOn : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {GROUPS.map((g) => {
              const empty = itemsFor(bType, g).length === 0;
              return (
                <button
                  key={g}
                  disabled={empty}
                  onClick={() => { setBGroup(g); const it = itemsFor(bType, g); if (it.length && !it.includes(bEx)) setBEx(it[0]); }}
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
};
