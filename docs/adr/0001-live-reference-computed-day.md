# Log entries reference Foods live; day totals are computed, not stored

A log entry holds a live reference to its Food plus a quantity — it does **not** copy the nutritional values at log time. A day's total calories and macros are computed on load by summing `(Food macros × quantity / reference value)` over that day's log entries; no total is ever persisted.

We considered the snapshot-copy approach (each log entry freezes the macros it was logged with, so history is immutable). We rejected it in favour of a domain convention: **a change of brand or recipe is a different Food, not an edit**. With that rule, editing a Food is rare and deliberate, so the cost of mutable history is acceptable, and we avoid duplicating nutritional data across every log entry.

Consequences:
- Editing a Food retroactively changes every past day that references it; the UI must warn the user before saving.
- Deleting is conditional: a Food referenced by ≥1 log entry is **archived** (soft-deleted, hidden from selection, still resolvable); a Food with zero log entries is **hard-deleted**.
- No denormalized daily total exists to fall out of sync — the day snapshot is always derived.
