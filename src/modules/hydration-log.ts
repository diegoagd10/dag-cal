import type { DataStore } from "../data/store.js";
import type { HydrationLog, IsoDate } from "./hydration-log.types.js";

export type { DailyWater, HydrationLog } from "./hydration-log.types.js";
export { ValidationError } from "./hydration-log.types.js";

import { ValidationError } from "./hydration-log.types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateIsoDate(date: unknown): asserts date is string {
	if (typeof date !== "string" || !ISO_DATE.test(date)) {
		throw new ValidationError("date must be a YYYY-MM-DD string");
	}
}

function validateDelta(delta: unknown): asserts delta is number {
	if (typeof delta !== "number" || !Number.isFinite(delta)) {
		throw new ValidationError("deltaOunces must be a finite number");
	}
}

/**
 * Hydration log (ADR 0002): owns the single per-day ounce total. Only the
 * running total is persisted — individual presses are never recorded. A day
 * with no water reads `ounces: 0`. The domain knows only ounces; presets and
 * the glasses display are UI concerns that never reach here.
 */
export function createHydrationLog(store: DataStore): HydrationLog {
	return {
		adjustWater(date, deltaOunces) {
			validateIsoDate(date);
			validateDelta(deltaOunces);

			const current = store.findWaterByDate(date) ?? 0;
			const next = Math.max(0, current + deltaOunces);
			// No-op when the delta changes nothing (zero delta, or already at 0
			// and a further subtract would clamp) — avoids a needless write.
			if (next !== current) {
				store.upsertWater(date, next);
			}
			return { date: date as IsoDate, ounces: next };
		},

		getWater(date) {
			validateIsoDate(date);
			return {
				date: date as IsoDate,
				ounces: store.findWaterByDate(date) ?? 0,
			};
		},
	};
}
