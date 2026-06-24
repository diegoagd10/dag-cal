import { randomUUID } from "node:crypto";
import type { DataStore } from "../data/store.js";
import type {
	CreateFoodInput,
	Food,
	FoodCatalog,
	FoodId,
	Unit,
	UpdateFoodInput,
} from "./food-catalog.types.js";

export type {
	CreateFoodInput,
	Food,
	FoodCatalog,
	FoodId,
	Unit,
	UpdateFoodInput,
} from "./food-catalog.types.js";

const VALID_UNITS = new Set<Unit>(["g", "oz", "unit"]);

function validateName(name: unknown): asserts name is string {
	if (typeof name !== "string" || name.trim().length === 0) {
		throw new ValidationError("name must be a non-empty string");
	}
}

function validateUnit(unit: unknown): asserts unit is Unit {
	if (!VALID_UNITS.has(unit as Unit)) {
		throw new ValidationError("unit must be one of g, oz, unit");
	}
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

export function createFoodCatalog(store: DataStore): FoodCatalog {
	return {
		createFood(input: CreateFoodInput): Food {
			validateName(input.name);
			validateUnit(input.referencePortion.unit);

			return store.insertFood({
				id: randomUUID(),
				name: input.name.trim(),
				referencePortion: input.referencePortion,
				nutrition: { ...input.nutrition },
				archived: false,
			});
		},

		updateFood(id: FoodId, changes: UpdateFoodInput): Food {
			if (changes.name !== undefined) {
				validateName(changes.name);
			}
			if (changes.referencePortion !== undefined) {
				validateUnit(changes.referencePortion.unit);
			}

			const updated = store.updateFood(id, changes);
			if (!updated) {
				throw new FoodNotFoundError(id);
			}
			return updated;
		},

		listActiveFoods(nameQuery?: string): Food[] {
			return store.findActiveFoods(nameQuery);
		},

		getFood(id: FoodId): Food | undefined {
			return store.findFoodById(id);
		},
	};
}
