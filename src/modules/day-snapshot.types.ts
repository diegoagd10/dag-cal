import type { IsoDate, LogEntry } from "./consumption-log.types.js";
import type { Food, Nutrition } from "./food-catalog.types.js";

export type { IsoDate, LogEntry } from "./consumption-log.types.js";
export type { Food, Nutrition } from "./food-catalog.types.js";

export interface SnapshotEntry {
	entry: LogEntry;
	food: Food;
	macros: Nutrition;
}

/**
 * Food-only portion of a day's snapshot (ADR 0002).
 * Water and weight are added by their own slices; this slice composes the
 * date's log entries into per-entry contributed macros and a day total.
 * Nothing is persisted — the snapshot is always derived on load.
 */
export interface DaySnapshot {
	date: IsoDate;
	totals: Nutrition;
	entries: SnapshotEntry[];
	water: { ounces: number };
	weight?: { kilograms: number };
}

export interface DaySnapshotReader {
	getDaySnapshot(date: IsoDate): DaySnapshot;
}
