# CLAUDE.md — Brief technique du projet « Suivi Muscu »

Ce fichier est destiné à **Claude Code**. Il décrit l'état actuel de l'app,
son architecture, son modèle de données et les pistes de suite. Lis-le en
entier avant de modifier le code.

---

## 1. Ce qu'est l'application

Une app de suivi d'entraînement (musculation / poids du corps), pensée mobile
d'abord (iPhone). Elle a été prototypée dans un artifact Claude puis exportée
ici pour être développée hors de l'environnement Claude.

Fonctionnalités déjà implémentées (toutes dans `src/App.jsx`) :

- **Onglet Aujourd'hui** : logguer une série à la volée. Sélecteur d'exercice
  en 4 étapes (Type → Groupe musculaire → Exercice → Mesure). Mesure = reps
  **ou** temps. Chrono de repos entre séries avec alarme sonore en boucle
  (bouton Stop). En mode temps, un compte à rebours d'effort qui sonne à la fin.
- **Onglet Rattrapage** : ajouter en bloc plusieurs séries à une date passée
  (exercice, reps/temps, nombre de séries), et vider une journée.
- **Onglet Entraînements** : construire des séances réutilisables faites de
  **blocs**. Un bloc = un ou plusieurs exercices (superset), un nombre de
  tours, un repos entre exos et un repos après chaque tour. Réordonner les
  blocs (▲▼). Lancer une séance guidée qui déroule chaque série une par une,
  déclenche les repos automatiquement, et enregistre chaque série dans
  l'historique du jour. Boutons « Passer la série » et « Bloc suivant ».
- **Historique** : récap par jour, distinguant total reps et total temps.
- **Onglet Progrès** : pour un exercice choisi (même sélecteur type → groupe
  → exercice), graphique en barres + tableau brut par séance. Métrique
  affichée : volume (reps × poids) si des séries pèsent quelque chose, sinon
  temps total ou reps totales selon le mode dominant. KPIs (séances, séries,
  reps, temps, volume, charge max, exercice favori) + objectifs personnels
  avec suivi de progression (voir §3, clé `goal:<id>`).
- **Onglet Catalogue** : le catalogue d'exercices (types, groupes musculaires,
  exercices) est entièrement éditable — créer/renommer/supprimer un type, un
  groupe ou un exercice, et marquer un type comme impliquant une charge
  externe (kg). Voir §3 (clé `catalog:data`) et §4.
- **Persistance** : la séance guidée en cours survit à un changement d'onglet
  et à un rechargement (restaurée au démarrage).
- **Backend optionnel (Cloudflare)** : `worker/` contient une API D1 minimale
  reproduisant l'interface storage. Activée via `VITE_API_URL`/`VITE_API_TOKEN`
  (voir `.env.example`) ; sinon repli sur `localStorage`. Déployée séparément
  du reste du compte Cloudflare de l'utilisateur (DB `suivi-muscu` dédiée).

---

## 2. Architecture technique

- **Stack** : React 18 + Vite. Aucun framework d'état externe (uniquement
  `useState` / `useRef`). Aucune dépendance UI : tout le style est en objets
  inline JS regroupés dans la constante `S` en bas de `App.jsx`.
- **Un seul gros composant** `App` dans `src/App.jsx` (~1300 lignes), avec deux
  sous-composants définis dans le même fichier : `CatchUp` (rattrapage) et
  `WorkoutTab` (constructeur d'entraînements).
- **Audio** : Web Audio API. Un `AudioContext` partagé, débloqué lors d'un
  geste utilisateur (contrainte navigateur). Fonctions `ensureAudio()`,
  `burst()` (un triple bip), `startAlarm()` / `stopAlarm()` (boucle).
- **Chrono** : un moteur unique basé sur une **heure de fin absolue**
  (`endRef.current = Date.now() + len*1000`) plutôt qu'un décompte relatif,
  pour rester juste même si l'onglet passe en arrière-plan. Deux phases :
  `"rest"` (repos) et `"effort"` (série en temps), suivies via `phaseRef`.

### Point important sur le stockage

Le composant appelle `window.storage`, une API **propre à l'environnement
Claude** (clé/valeur asynchrone). Hors de Claude, cet objet n'existe pas.

`src/storage.js` fournit un **adaptateur** qui réimplémente exactement la même
interface (`get` / `set` / `delete` / `list`) sur `localStorage`, et
`src/main.jsx` l'installe via `installStorage()` **avant le premier rendu**.

Conséquence : ne réécris pas les appels `window.storage` du composant ; ils
fonctionnent tels quels grâce à l'adaptateur. Si tu ajoutes du stockage,
respecte la même interface asynchrone.

Méthodes de l'interface (toutes async) :
- `get(key)` → `{ key, value }` ou `null`
- `set(key, value)` → `{ key, value }` (value est une **chaîne** ; le composant
  y met du JSON.stringify)
- `delete(key)` → `{ key, deleted: true }`
- `list(prefix)` → `{ keys: string[] }`

---

## 3. Modèle de données (clés de stockage)

Cinq familles de clés :

- `day:<YYYY-MM-DD>` → une **journée** : `{ sets: Set[] }`
- `wk:<id>` → un **entraînement** réutilisable : `{ id, name, blocks: Block[] }`
- `run:active` → la **séance guidée en cours** (ou absente) : `Run`
- `goal:<id>` → un **objectif** (onglet Progrès) : `{ id, exercise, metric, target, unit, deadline, createdAt }`
  - `exercise` : `string | null` (`null` = objectif global toutes catégories)
  - `metric` : `"sessions" | "series" | "reps" | "time" | "volume" | "weight"`
    (voir `metricValue()` dans `App.jsx` — même fonction utilisée pour les
    tuiles KPI et le calcul de progression d'un objectif)
  - La progression se calcule sur les séries loguées **depuis `createdAt`**
    uniquement (pas d'historique rétroactif compté dans un objectif).
- `catalog:data` → le **catalogue d'exercices** (types, groupes, exercices),
  entièrement éditable depuis l'onglet Catalogue. Voir §4 pour sa forme.

### Set (une série enregistrée)
```
{
  exercise: string,      // nom de l'exercice
  reps: number,          // nombre de reps OU nombre de secondes si mode "time"
  mode: "reps" | "time", // comment lire `reps`
  rest: number,          // repos (s) qui suivait cette série (indicatif)
  at: string,            // ISO datetime
  type: "charges" | "poids",  // optionnel — absent sur les séries créées avant cet ajout
  weight: number         // optionnel — charge (kg), uniquement si type === "charges"
}
```
`type` sert à désambiguïser les exercices présents dans les deux catalogues
(ex. « Squat », « Fentes »). `weight` alimente l'onglet Progrès (volume =
reps × weight). Les anciennes séries sans ces champs restent lisibles ; le
code ne doit pas supposer leur présence.

### Block (un bloc d'un entraînement) — forme actuelle
```
{
  exercises: [ { exercise, reps, mode, type, weight } ],  // 1 exo = normal, 2+ = superset
  rounds: number,        // nombre de tours
  restBetween: number,   // repos (s) entre exos d'un même tour (0 = enchaîner)
  restAfter: number      // repos (s) après chaque tour
}
```
`type`/`weight` par exercice du bloc sont optionnels (mêmes règles que Set),
propagés jusqu'aux `steps` de la séance guidée puis dans le Set loggué.
**Compat ascendante** : d'anciens blocs peuvent avoir la forme
`{ exercise, series, reps, mode, rest }`. Le code lit les deux (`b.exercises ||
[...]`, `b.rounds || b.series`, `b.restAfter ?? b.rest`). Conserve cette
tolérance si tu touches à `launchWorkout` ou à `WorkoutTab`.

### Run (séance guidée en cours)
```
{
  name: string,
  idx: number,           // index de la série courante dans `steps`
  blockCount: number,    // nombre de blocs (pour afficher « Bloc suivant »)
  steps: [ {
    exercise, reps, mode,
    rest,                // repos qui suit CETTE série (0 pour la toute dernière)
    round, rounds,       // tour courant / total
    exoNo, exoCount,     // position dans le superset
    isSuper,             // bool
    block                // index du bloc d'origine (pour « Bloc suivant »)
  } ]
}
```
La fonction `launchWorkout` **aplatit** les blocs en une liste de `steps`
individuels. C'est le cœur de la logique : le repos placé sur chaque step
dépend de sa position (entre-exos, fin-de-tour, ou 0 sur la dernière série).

---

## 4. Catalogue d'exercices

**Entièrement dynamique et éditable depuis l'onglet Catalogue** — plus de
liste figée dans le code. Le catalogue vit dans le state `catalog` de `App`
(persisté sous `catalog:data`), de forme :
```
{
  types: [ { key, label, hasWeight } ],  // ex. {key:"charges", label:"Avec charges", hasWeight:true}
  groups: [ string ],                    // ex. "Pectoraux", "Cou"...
  exos: [ { id, name, type, group } ],   // type/group référencent les clés/noms ci-dessus
}
```
- `hasWeight` sur un type détermine si le champ **Charge (kg)** apparaît pour
  ses exercices (log du jour, rattrapage, blocs d'entraînement) — c'est ce
  flag qu'il faut lire (`catTypeHasWeight`), plus jamais une comparaison en
  dur du genre `type === "charges"`.
- `DEFAULT_TYPES` / `DEFAULT_GROUPS` / `DEFAULT_EXOS` (haut de `App.jsx`) ne
  servent plus qu'à **amorcer** le catalogue au tout premier lancement
  (`buildDefaultCatalog()`) ; ne pas les utiliser ailleurs dans le code.
- Helpers opérant sur un catalogue : `catItemsFor(catalog, type, group)`,
  `catAllExos(catalog)`, `catTypeLabel(catalog, key)`, `catTypeHasWeight(catalog, key)`.
- Renommer/supprimer un type ou un groupe **cascade** sur les exercices qui
  lui appartiennent (confirmation demandée si le nombre d'exercices impactés
  est non nul). Les `Set` déjà loggués gardent le nom/texte tel quel — un
  renommage ne réécrit pas l'historique, seul le catalogue change.
- `CatalogTab` (composant dédié) porte toute la UI de gestion : types,
  groupes, exercices, avec `prompt()`/`confirm()` natifs pour renommer/
  supprimer (pas de dépendance ajoutée).

Tous les sélecteurs de l'app (Aujourd'hui/Rattrapage via `exerciseChips`,
constructeur de bloc dans `WorkoutTab`, filtre de `ProgressTab`) lisent ce
même `catalog`, passé en prop où nécessaire — aucun composant ne doit
retomber sur les constantes `DEFAULT_*`.

---

## 5. Limites connues (IMPORTANT — surtout iOS)

Ces limites viennent du **navigateur**, pas du code. À garder en tête avant de
promettre une fonctionnalité :

1. **Son en mode silencieux (iPhone)** : impossible pour une page web / PWA.
   L'interrupteur silencieux coupe le Web Audio. Seule une app native le
   contourne. → L'alarme n'est audible que si le son du téléphone est actif.
2. **Vibration sur iOS Safari** : `navigator.vibrate` n'existe pas. Le code
   l'appelle en secours (utile sur Android), sans effet sur iPhone.
3. **Arrière-plan** : si l'app est fermée ou l'onglet totalement suspendu, le
   JS ne tourne plus → l'alarme ne peut pas sonner « toute seule » plus tard.
   Le chrono, lui, se recale correctement au retour (heure de fin absolue).
   **Mitigation en place** : Screen Wake Lock API (voir `App.jsx`, effets
   autour de `wakeLockRef`/`timerActive`) — empêche l'écran de se verrouiller
   tout seul tant qu'un chrono (repos ou effort) tourne, ce qui couvre le cas
   le plus fréquent (repos de 60-90s sans interaction pendant une séance
   guidée). Ne couvre pas le cas où l'utilisateur change volontairement
   d'app ou verrouille l'écran manuellement — le wake lock est alors relâché
   par le navigateur et redemandé au retour sur l'onglet si un chrono est
   toujours actif. Supporté sur Safari iOS depuis la 16.4 ; no-op silencieux
   ailleurs (`"wakeLock" in navigator` + try/catch).
4. **Alarme persistante** : l'alarme boucle jusqu'au bouton **Stop** (choix
   assumé, car on ne peut pas garantir un arrêt auto fiable en arrière-plan).

Pour dépasser complètement 1–3, il faut une **app native** (voir Roadmap).

---

## 6. Lancer et développer

```bash
npm install
npm run dev      # http://localhost:5173  (accessible aussi depuis le téléphone
                 # sur le même Wi-Fi via l'IP locale, host activé dans vite.config)
npm run build    # génère dist/
npm run preview  # sert le build de prod localement
```

Le composant est autonome : pas de backend, tout est en local via
localStorage. Effacer les données = vider le localStorage du domaine (ou
ajouter un bouton « réinitialiser » — voir Roadmap).

---

## 7. Roadmap / pistes suggérées

Court terme (pur front, faisable tout de suite) :
- [ ] Bouton **Réinitialiser** (efface `day:*`, `wk:*`, `run:active`).
- [ ] **Export / import** des données en JSON (sauvegarde manuelle).
- [ ] **Graphiques** de progression par exercice (volume, 1RM estimé, temps
      total de gainage…). Une lib légère type `recharts` ou un canvas maison.
- [x] **Édition d'une série** déjà enregistrée (Aujourd'hui + Rattrapage, composant `SetRow`).
- [ ] Réordonner les **exercices d'un superset** (comme les blocs).
- [ ] Templates d'entraînements prédéfinis (Push/Pull/Legs, full-body…).

PWA (pour « installer » l'app sur l'écran d'accueil, usage hors-ligne) :
- [ ] Ajouter un `manifest.webmanifest` (icônes, nom, thème, `display:
      standalone`) et un **service worker** (via `vite-plugin-pwa`).
- [ ] Vérifier le fonctionnement hors-ligne (le localStorage suffit déjà pour
      les données ; le SW sert à mettre en cache l'app elle-même).
- ⚠️ Une PWA **ne lève pas** les limites iOS 1–2 ci-dessus (son en silencieux,
      vibration). Elle règle surtout l'installation et l'usage hors-ligne.

App native (seule voie pour son en silencieux + vibration + notifications
d'arrière-plan fiables sur iPhone) :
- [ ] Option A : réécriture **React Native / Expo** (réutilise la logique JS,
      pas le style inline web). Notifications locales via `expo-notifications`,
      son/vibration natifs.
- [ ] Option B : envelopper la PWA dans **Capacitor** (garde le code web,
      ajoute des plugins natifs pour son/vibration/notifications).
- Prérequis publication iOS : compte Apple Developer + build via Xcode (Mac).

---

## 8. Conventions

- Français dans l'UI et les libellés ; commentaires de code en français.
- Pas de dépendance ajoutée sans raison ; l'app est volontairement minimale.
- Style : objets inline dans `S`. Palette dans la constante `C` en haut de
  `App.jsx` (fond ardoise, accent vert « lime », cyan pour l'effort, rouge/
  orange pour l'alarme).
- Si tu découpes `App.jsx` en plusieurs fichiers (recommandé à terme), commence
  par extraire : le catalogue d'exercices, l'audio, le moteur de chrono, puis
  les 3 onglets. Garde le modèle de données et l'API storage inchangés.
