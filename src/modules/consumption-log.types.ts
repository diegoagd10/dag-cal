import type { FoodId } from "./food-catalog.types.js";

export type LogEntryId = string;
export type IsoDate = string; // "YYYY-MM-DD"

export interface LogEntry {
	id: LogEntryId;
	date: IsoDate;
	foodId: FoodId;
	quantity: number;
}

export interface ConsumptionLog {
	logConsumption(date: IsoDate, foodId: FoodId, quantity: number): LogEntry; // throws FoodNotFound | FoodArchived
	updateLogEntry(id: LogEntryId, quantity: number): LogEntry; // throws LogEntryNotFound
	removeLogEntry(id: LogEntryId): void;
	listEntries(date: IsoDate): LogEntry[];
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

export class FoodNotFoundError extends Error {
	constructor(id: FoodId) {
		super(`FoodNotFound: no food with id "${id}"`);
		this.name = "FoodNotFound";
	}
}

export class FoodArchivedError extends Error {
	constructor(id: FoodId) {
		super(`FoodArchived: food "${id}" is archived`);
		this.name = "FoodArchived";
	}
}

export class LogEntryNotFoundError extends Error {
	constructor(id: LogEntryId) {
		super(`LogEntryNotFound: no entry with id "${id}"`);
		this.name = "LogEntryNotFound";
	}
}
