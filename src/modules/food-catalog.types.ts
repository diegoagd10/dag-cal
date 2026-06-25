export type FoodId = string;
export type Unit = "g" | "oz" | "unit";

export interface Nutrition {
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	fiber: number;
	sugar: number;
	sodium: number;
}

export interface ReferencePortion {
	value: number;
	unit: Unit;
}

export interface Food {
	id: FoodId;
	name: string;
	referencePortion: ReferencePortion;
	nutrition: Nutrition;
	archived: boolean;
}

export interface CreateFoodInput {
	name: string;
	referencePortion: ReferencePortion;
	nutrition: Nutrition;
}

export type UpdateFoodInput = Partial<{
	name: string;
	referencePortion: ReferencePortion;
	nutrition: Nutrition;
}>;

export interface FoodCatalog {
	createFood(input: CreateFoodInput): Food;
	updateFood(id: FoodId, changes: UpdateFoodInput): Food;
	deleteFood(id: FoodId): { outcome: "archived" | "deleted" };
	isReferenced(id: FoodId): boolean;
	listActiveFoods(nameQuery?: string): Food[];
	getFood(id: FoodId): Food | undefined;
}
