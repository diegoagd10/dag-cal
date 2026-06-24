# dag-cal

A single-user calorie and nutrition diary. The user logs what they eat day by day, plus water and weight, and reviews any past day. "Calendar" means navigating day by day — there is no calendar sync (no CalDAV).

## Language

**Food**:
A reusable definition of an edible item: a name, a reference portion, and the seven nutritional values (calories, protein, carbs, fat, fiber, sugar, sodium) for that reference portion. Created once, referenced by many log entries. A change of brand is a different Food, not an edit. It is *active* while selectable, or *archived* once soft-deleted.
_Avoid_: Alimento, Product, Item, Meal

**Archived food**:
A Food the user deleted while it was still referenced by at least one log entry. Hidden from selection when creating new log entries, but kept so past days still resolve. A Food referenced by zero log entries is hard-deleted instead, never archived.
_Avoid_: Deleted food, Inactive food

**Reference portion**:
The amount a Food's nutritional values are stated for: a decimal `value` plus a `unit` ∈ {g, oz, unit}. The unit is intrinsic to the food — bread is measured in `unit`, spinach in `g`. Stated as the label states it (e.g. "100 g", "1 unit"), not normalised. Weight foods (g/oz) are one dimension and interconvert (1 oz = 28.35 g); `unit` foods are counted only.
_Avoid_: Porción de referencia, Serving size

**Log entry**:
A record that the user consumed a `quantity` of a Food on a given day. Holds a live reference to the Food (not a copy) plus a decimal `quantity` expressed in that Food's reference-portion unit. Its macros are `Food values × (quantity / reference portion value)`.
_Avoid_: Registro, Entry, Consumption

**Daily water**:
A single total volume of water for a day, stored in ounces. The user adds or removes it through input presets — `glass` (8 oz) or `bottle` (16 oz) — but only the running total is persisted, never the individual presses. Displayed as ounces and as `oz / 8` glasses.
_Avoid_: Glass (as stored unit), Hydration

**Weight measurement**:
The user's body weight on a given day, stored in kilograms — one per day, the latest of the day overwriting any earlier one. It references no Food and adds no calories; it is a separate series used to track weight change. `kg` / `lb` is a display/input preference (fixed conversion 1 kg = 2.20462 lb); stored values are always kg.
_Avoid_: Peso, Weigh-in, Body mass

**Day snapshot**:
The computed view of a single day — total calories and macros plus the list of log entries — derived on load by summing `(Food macros × quantity / reference value)` over that day's log entries. Never persisted as a stored total.
_Avoid_: Snapshot del día, Stored summary, Daily total
