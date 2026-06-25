import type { IsoDate } from "./consumption-log.types.js";

export type { IsoDate } from "./consumption-log.types.js";

/**
 * A single per-day water total, stored in ounces. The domain knows only
 * ounces; presets (glass = 8 oz, bottle = 16 oz) and the `glasses = oz / 8`
 * display are UI concerns and never reach this type.
 */
export interface DailyWater {
	date: IsoDate;
	ounces: number;
}

/**
 * Hydration log (ADR 0002): owns the single per-day ounce total. The caller
 * sends a signed ounce delta; individual presses are never persisted, only
 * the running total. A day with no water reads `ounces: 0`, never absent.
 */
export interface HydrationLog {
	adjustWater(date: IsoDate, deltaOunces: number): DailyWater; // + adds, − subtracts; clamps at 0
	getWater(date: IsoDate): DailyWater; // ounces 0 when none recorded
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}
