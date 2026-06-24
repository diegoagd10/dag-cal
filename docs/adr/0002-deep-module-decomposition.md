# 0002. Deep-module decomposition for the diary

- **Status**: Accepted
- **PRD**: #1

## Context

dag-cal lets a single user define reusable Foods, log how much they ate on a day, track daily water and weight, and read a computed Day snapshot for any date (PRD #1). The behaviour is small but the rules cluster into distinct responsibilities (Food lifecycle with conditional delete, consumption logging, hydration, weight, day composition). The PRD's light seam sketch proposed one application service; that collapses into a god object that also owns Food creation. This ADR replaces that sketch with responsibility-bounded deep modules, all sitting on one shared, injectable persistence module. This is the contract `to-issues` slices within and `validator` audits depth against; it supersedes the single-seam sketch in PRD #1.

## Deep modules

### Food catalog

- **Seam**: application module; tested directly against an in-memory SQLite (`:memory:`).
- **Interface**: `createFood(name, referencePortion{value, unit∈g|oz|unit}, nutrition{calories, protein, carbs, fat, fiber, sugar, sodium})`, `updateFood(id, …)`, `deleteFood(id)`, `isReferenced(id)`, `listActiveFoods(nameQuery?)`, `getFood(id)`.
- **Hides**: input validation, foods persistence, and the **archive-vs-hard-delete decision** — `deleteFood` archives a Food referenced by ≥1 log entry and hard-deletes one with zero references, resolving the reference count via the shared Data store (no dependency on Consumption log). `isReferenced` exposes only the yes/no the rule hinges on (driving the edit/delete warnings), hiding that it is implemented as a count. `listActiveFoods` takes an optional name filter for large catalogs.
- **Depth note**: passes the deletion test — remove it and the conditional-delete rule (ADR 0001) scatters into every caller.

### Consumption log

- **Seam**: application module; in-memory SQLite.
- **Interface**: `logConsumption(date, foodId, quantity)`, `updateLogEntry(id, quantity)`, `removeLogEntry(id)`, `listEntries(date)`.
- **Hides**: log-entry persistence and the rule that you cannot log against an archived Food. A log entry holds a live reference to its Food plus a decimal quantity (ADR 0001) — it stores no nutritional values.
- **Depth note**: owns the entry lifecycle and the active-Food guard; deleting it spreads both into callers.

### Hydration log

- **Seam**: application module; in-memory SQLite.
- **Interface**: `adjustWater(date, deltaOunces) → DailyWater{ounces}`, `getWater(date) → DailyWater{ounces}`.
- **Hides**: the single per-day ounce total and clamping at zero. The domain knows only ounces; presets (glass = 8 oz, bottle = 16 oz) and the `glasses = oz / 8` display are UI concerns — the caller sends a signed ounce delta. Individual presses are never persisted, only the running total.
- **Depth note**: hides the per-day accumulation behind two methods; a day with no water reads `ounces: 0`, never absent.

### Weight log

- **Seam**: application module; in-memory SQLite.
- **Interface**: `recordWeight(date, value, unit∈kg|lb)`, `getWeight(date) → value in the requested unit`.
- **Hides**: canonical kilogram storage, the kg↔lb conversion (1 kg = 2.20462 lb), and the one-per-day overwrite rule.
- **Depth note**: callers never touch units or the overwrite semantics.

### Day snapshot

- **Seam**: application module, read-only; in-memory SQLite.
- **Interface**: `getDaySnapshot(date) → { totals: Nutrition, entries[{food, quantity, contributed macros}], water{ounces}, weight?{kilograms} }`.
- **Hides**: the composition of a date's log entries (joined to their Foods, including archived ones), water, and weight, plus the **Nutrition** computation — each entry's macros are `Food values × (quantity / reference value)` and the day totals are their sum (ADR 0001). Nothing is persisted; the snapshot is always derived.
- **Depth note**: the deepest module — the single place that owns day assembly and macro totalling, so no other module re-implements it.

### Nutrition (internal, not a test seam)

- **Interface**: pure functions — `entryMacros(food, quantity)`, `sumMacros(entries)`, and unit conversions (oz↔g, kg↔lb). `oz→glasses` is presentation and lives in the UI, not here.
- **Hides**: all arithmetic; no I/O.
- **Depth note**: pure and reused by Day snapshot and Weight log; tested transitively through their seams.

### Data store (internal, not a test seam)

- **Interface**: typed persistence operations per concept plus `countLogEntriesForFood(id)` and date-scoped reads; **parameterised by the SQLite connection** so tests inject `:memory:` and production injects the file.
- **Hides**: the Drizzle schema, SQL, and the `better-sqlite3` driver. One concrete implementation — no abstract repository interfaces, because there is a single backend (one adapter = a hypothetical seam, not worth abstracting).
- **Depth note**: every domain module depends on it; it concentrates all SQL in one place.

## Seam map

- **HTTP routes** (thin adapters) → Food catalog, Consumption log, Hydration log, Weight log, Day snapshot.
- Each of those five domain modules → **Data store** (the only shared dependency).
- **Day snapshot** and **Weight log** → **Nutrition** (pure macros/conversions). Hydration log needs no Nutrition — it stores only ounces.
- Domain modules do **not** call each other — all cross-cutting reads go through the shared Data store. Cross-module seams are therefore ~zero; the only shared seams are the concrete Data store and pure Nutrition.
- **Test surface**: the five domain module interfaces, each exercised against a fresh in-memory SQLite. Nutrition and Data store are covered transitively, never mocked.

## Interfaces

The exact contract `to-issues` slices within (shared types, then the five public seams; internal collaborators last):

```typescript
type FoodId = string;  type LogEntryId = string;  type IsoDate = string;   // "YYYY-MM-DD"
type Unit = "g" | "oz" | "unit";   type WeightUnit = "kg" | "lb";

interface Nutrition {                                  // the seven values, per reference portion
  calories: number; protein: number; carbs: number; fat: number;
  fiber: number;    sugar: number;   sodium: number;
}
interface ReferencePortion { value: number; unit: Unit; }
interface Food { id: FoodId; name: string; referencePortion: ReferencePortion; nutrition: Nutrition; archived: boolean; }
interface LogEntry { id: LogEntryId; date: IsoDate; foodId: FoodId; quantity: number; }

interface FoodCatalog {
  createFood(input: { name: string; referencePortion: ReferencePortion; nutrition: Nutrition }): Food;
  updateFood(id: FoodId, changes: Partial<{ name: string; referencePortion: ReferencePortion; nutrition: Nutrition }>): Food; // throws FoodNotFound
  deleteFood(id: FoodId): { outcome: "archived" | "deleted" };
  isReferenced(id: FoodId): boolean;                   // drives edit/delete warnings; hides the COUNT
  listActiveFoods(nameQuery?: string): Food[];         // optional name-substring filter
  getFood(id: FoodId): Food | undefined;
}

interface ConsumptionLog {
  logConsumption(date: IsoDate, foodId: FoodId, quantity: number): LogEntry;   // throws FoodNotFound | FoodArchived
  updateLogEntry(id: LogEntryId, quantity: number): LogEntry;                   // throws LogEntryNotFound
  removeLogEntry(id: LogEntryId): void;
  listEntries(date: IsoDate): LogEntry[];
}

interface DailyWater { date: IsoDate; ounces: number; }                         // glasses derived by the UI
interface HydrationLog {
  adjustWater(date: IsoDate, deltaOunces: number): DailyWater;                  // + adds, − subtracts; clamps at 0
  getWater(date: IsoDate): DailyWater;                                          // ounces 0 when none
}

interface WeightReading { date: IsoDate; value: number; unit: WeightUnit; }     // value in the requested unit
interface WeightLog {
  recordWeight(date: IsoDate, value: number, unit: WeightUnit): WeightReading;  // stored as kg; same-day overwrite
  getWeight(date: IsoDate, unit: WeightUnit): WeightReading | undefined;
}

interface SnapshotEntry { entry: LogEntry; food: Food; macros: Nutrition; }
interface DaySnapshot {
  date: IsoDate; totals: Nutrition; entries: SnapshotEntry[];
  water: { ounces: number }; weight?: { kilograms: number };
}
interface DaySnapshotReader { getDaySnapshot(date: IsoDate): DaySnapshot; }      // resolves archived foods; never persists a total

// ---- internal collaborators (not test seams) ----
interface NutritionMath {
  entryMacros(food: Food, quantity: number): Nutrition;   // food values × (quantity / referencePortion.value)
  sumMacros(parts: Nutrition[]): Nutrition;
  ozToGrams(oz: number): number; gramsToOz(g: number): number;   // 1 oz = 28.35 g
  kgToLb(kg: number): number;    lbToKg(lb: number): number;     // 1 kg = 2.20462 lb
}
// DataStore: one concrete Drizzle/better-sqlite3 module built from a connection —
// createDataStore(db) where tests pass new Database(":memory:"). Exposes typed per-concept
// persistence plus countLogEntriesForFood(id) and date-scoped reads. No abstract repo interfaces.
```

## Rejected alternatives

- **One `Diary` application service (the PRD sketch).** A single ~12-operation service owning Food creation, logging, water, weight, and the snapshot. Rejected as a god object: it mixed Food lifecycle (reusable definitions) with day records, and the name implied "deliver the day summary" while doing far more. The chosen split is deeper — each module's interface is small relative to the rule it hides, and the conditional-delete rule, the active-Food guard, and the snapshot composition each get a clear owner.
- **Abstract repository interfaces per concept.** Rejected: with a single SQLite backend and tests that inject a real `:memory:` database (not mocks), repository interfaces are a hypothetical seam with one implementation — premature indirection. A single concrete, connection-injected Data store is deeper and simpler.
