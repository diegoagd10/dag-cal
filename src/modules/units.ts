export type WeightUnit = "g" | "oz";

const GRAMS_PER_OZ = 28.349523125;

export class UnitConversionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnitConversionError";
	}
}

/**
 * Convert a weight quantity between grams and ounces.
 * Pure math — does not validate sign. Callers validate positivity first.
 */
export function convertWeight(
	value: number,
	from: WeightUnit,
	to: WeightUnit,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new UnitConversionError("value must be a finite number");
	}
	if (from === to) return value;
	const grams = from === "g" ? value : value * GRAMS_PER_OZ;
	return to === "g" ? grams : grams / GRAMS_PER_OZ;
}
