import { randomUUID } from "node:crypto";
import type { DataStore } from "../data/store.js";
import type { ConsumptionLog, LogEntryId } from "./consumption-log.types.js";
import type { FoodId } from "./food-catalog.types.js";

export type {
	ConsumptionLog,
	FoodArchivedError,
	FoodNotFoundError,
	LogEntry,
	LogEntryId,
	LogEntryNotFoundError,
	ValidationError,
} from "./consumption-log.types.js";

import {
	FoodArchivedError,
	FoodNotFoundError,
	LogEntryNotFoundError,
	ValidationError,
} from "./consumption-log.types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateIsoDate(date: unknown): asserts date is string {
	if (typeof date !== "string" || !ISO_DATE.test(date)) {
		throw new ValidationError("date must be a YYYY-MM-DD string");
	}
}

function validateQuantity(quantity: unknown): asserts quantity is number {
	if (
		typeof quantity !== "number" ||
		!Number.isFinite(quantity) ||
		quantity <= 0
	) {
		throw new ValidationError("quantity must be a positive finite number");
	}
}

export function createConsumptionLog(store: DataStore): ConsumptionLog {
	return {
		logConsumption(date, foodId, quantity) {
			validateIsoDate(date);
			validateQuantity(quantity);

			const food = store.findFoodById(foodId as FoodId);
			if (!food) throw new FoodNotFoundError(foodId);
			if (food.archived) throw new FoodArchivedError(foodId);

			const id = randomUUID() as LogEntryId;
			return store.insertLogEntry({ id, date, foodId, quantity });
		},

		updateLogEntry(id, quantity) {
			validateQuantity(quantity);
			const updated = store.updateLogEntry(id as LogEntryId, quantity);
			if (!updated) throw new LogEntryNotFoundError(id);
			return updated;
		},

		removeLogEntry(id) {
			store.deleteLogEntry(id as LogEntryId);
		},

		listEntries(date) {
			validateIsoDate(date);
			return store.findEntriesByDate(date);
		},
	};
}
