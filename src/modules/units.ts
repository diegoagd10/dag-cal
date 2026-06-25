export type FoodWeightUnit = "g" | "oz";
export type WeightUnit = "kg" | "lb";

const GRAMS_PER_OZ = 28.349523125;
const LB_PER_KG = 2.20462;

export class UnitConversionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnitConversionError";
	}
}

/**
 * Convert a food weight quantity between grams and ounces.
 * Pure math — does not validate sign. Callers validate positivity first.
 */
export function convertWeight(
	value: number,
	from: FoodWeightUnit,
	to: FoodWeightUnit,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new UnitConversionError("value must be a finite number");
	}
	if (from === to) return value;
	const grams = from === "g" ? value : value * GRAMS_PER_OZ;
	return to === "g" ? grams : grams / GRAMS_PER_OZ;
}

/**
 * Convert kilograms to pounds (1 kg = 2.20462 lb).
 * Pure math — does not validate sign. Callers validate first.
 */
export function kgToLb(kg: number): number {
	if (typeof kg !== "number" || !Number.isFinite(kg)) {
		throw new UnitConversionError("value must be a finite number");
	}
	return kg * LB_PER_KG;
}

/**
 * Convert pounds to kilograms (1 kg = 2.20462 lb).
 * Pure math — does not validate sign. Callers validate first.
 */
export function lbToKg(lb: number): number {
	if (typeof lb !== "number" || !Number.isFinite(lb)) {
		throw new UnitConversionError("value must be a finite number");
	}
	return lb / LB_PER_KG;
}
