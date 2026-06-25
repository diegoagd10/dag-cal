import { type Context, Hono } from "hono";
import type { FC } from "hono/jsx";
import type { ConsumptionLog } from "../../modules/consumption-log.types.js";
import {
	FoodArchivedError,
	type LogEntry,
	LogEntryNotFoundError,
} from "../../modules/consumption-log.types.js";
import type {
	DaySnapshotReader,
	Nutrition,
} from "../../modules/day-snapshot.types.js";
import type { Food, FoodCatalog } from "../../modules/food-catalog.js";
import {
	FoodNotFoundError,
	ValidationError,
} from "../../modules/food-catalog.js";
import type { HydrationLog } from "../../modules/hydration-log.types.js";
import { ValidationError as HydrationValidationError } from "../../modules/hydration-log.types.js";
import type { FoodWeightUnit, WeightUnit } from "../../modules/units.js";
import { convertWeight, kgToLb } from "../../modules/units.js";
import type { WeightLog } from "../../modules/weight-log.types.js";
import { ValidationError as WeightValidationError } from "../../modules/weight-log.types.js";
import { Layout } from "../../views/Layout.jsx";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GLASS_OZ = 8;
const BOTTLE_OZ = 16;

export function createLogRoutes(
	catalog: FoodCatalog,
	log: ConsumptionLog,
	snapshot: DaySnapshotReader,
	hydration: HydrationLog,
	weight: WeightLog,
): Hono {
	const app = new Hono();

	// GET /days/:date — day view + log form
	app.get("/:date", (c) => {
		const date = c.req.param("date");
		if (!ISO_DATE.test(date)) return c.text("Invalid date", 400);

		const foods = catalog.listActiveFoods();
		const daySnapshot = snapshot.getDaySnapshot(date);
		const weightUnit = resolveWeightUnit(c.req.query("weightUnit"));

		return c.html(
			<Layout title={`Log — ${date}`}>
				<DayView
					date={date}
					foods={foods}
					daySnapshot={daySnapshot}
					weightUnit={weightUnit}
					prev={shiftDate(date, -1)}
					next={shiftDate(date, 1)}
				/>
			</Layout>,
		);
	});

	// POST /days/:date/entries — logConsumption
	app.post("/:date/entries", async (c) => {
		const date = c.req.param("date");
		if (!ISO_DATE.test(date)) return c.text("Invalid date", 400);
		const body = await c.req.parseBody();
		const foodId = String(body.foodId ?? "");

		try {
			log.logConsumption(date, foodId, resolveQuantity(catalog, foodId, body));
			return c.redirect(`/days/${date}`);
		} catch (e) {
			if (e instanceof ValidationError) {
				return renderDayWith(c, catalog, snapshot, date, e.message, body);
			}
			if (e instanceof FoodNotFoundError) {
				return renderDayWith(
					c,
					catalog,
					snapshot,
					date,
					`Food not found`,
					body,
				);
			}
			if (e instanceof FoodArchivedError) {
				return renderDayWith(
					c,
					catalog,
					snapshot,
					date,
					`Food is archived`,
					body,
				);
			}
			throw e;
		}
	});

	// POST /days/:date/water — adjustWater with a signed ounce delta
	app.post("/:date/water", async (c) => {
		const date = c.req.param("date");
		if (!ISO_DATE.test(date)) return c.text("Invalid date", 400);
		const body = await c.req.parseBody();

		try {
			hydration.adjustWater(date, parseDelta(body.delta));
			return c.redirect(`/days/${date}`);
		} catch (e) {
			if (
				e instanceof ValidationError ||
				e instanceof HydrationValidationError
			) {
				return renderDayWith(c, catalog, snapshot, date, e.message, body);
			}
			throw e;
		}
	});

	// POST /days/:date/weight — recordWeight (kg or lb)
	app.post("/:date/weight", async (c) => {
		const date = c.req.param("date");
		if (!ISO_DATE.test(date)) return c.text("Invalid date", 400);
		const body = await c.req.parseBody();
		const unit = resolveWeightUnit(String(body.unit ?? ""));

		try {
			weight.recordWeight(date, parseWeightValue(body.value), unit);
			return c.redirect(`/days/${date}?weightUnit=${unit}`);
		} catch (e) {
			if (e instanceof WeightValidationError || e instanceof ValidationError) {
				return renderDayWith(c, catalog, snapshot, date, e.message, body, unit);
			}
			throw e;
		}
	});

	// POST /entries/:id — update quantity
	app.post("/entries/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.parseBody();
		const rawDate = String(body._date ?? "");
		let quantity: number;
		try {
			quantity = parseQuantity(body.quantity);
		} catch (e) {
			if (e instanceof ValidationError) {
				return redirectOrError(c, catalog, log, rawDate, e.message);
			}
			throw e;
		}
		try {
			const updated = log.updateLogEntry(id, quantity);
			return c.redirect(`/days/${updated.date}`);
		} catch (e) {
			if (e instanceof LogEntryNotFoundError) {
				return c.text("Entry not found", 404);
			}
			throw e;
		}
	});

	// POST /entries/:id/delete — remove
	app.post("/entries/:id/delete", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.parseBody();
		log.removeLogEntry(id);
		const date = String(body._date ?? "");
		if (ISO_DATE.test(date)) return c.redirect(`/days/${date}`);
		return c.redirect("/days");
	});

	return app;
}

async function renderDayWith(
	c: Context,
	catalog: FoodCatalog,
	snapshot: DaySnapshotReader,
	date: string,
	error: string,
	body: Record<string, unknown>,
	weightUnit: WeightUnit = "kg",
) {
	const foods = catalog.listActiveFoods();
	const daySnapshot = snapshot.getDaySnapshot(date);
	return c.html(
		<Layout title={`Log — ${date}`}>
			<DayView
				date={date}
				foods={foods}
				daySnapshot={daySnapshot}
				weightUnit={weightUnit}
				prev={shiftDate(date, -1)}
				next={shiftDate(date, 1)}
				error={error}
				formDefaults={{
					foodId: String(body.foodId ?? ""),
					quantity: String(body.quantity ?? ""),
					unit: String(body.unit ?? ""),
				}}
			/>
		</Layout>,
	);
}

function redirectOrError(
	c: Context,
	_catalog: FoodCatalog,
	_log: ConsumptionLog,
	date: string,
	error: string,
) {
	if (ISO_DATE.test(date))
		return c.redirect(`/days/${date}?err=${encodeURIComponent(error)}`);
	return c.text(error, 400);
}

/**
 * UTC-safe prev/next ISO date. Constructs the date from a YYYY-MM-DD string at
 * UTC midnight, shifts by `delta` days, and formats back to YYYY-MM-DD — never
 * touches local time, so month/year boundaries and DST can't skew the result.
 */
function shiftDate(iso: string, delta: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	date.setUTCDate(date.getUTCDate() + delta);
	return date.toISOString().slice(0, 10);
}

// ---- Parsing ----

function parseQuantity(raw: unknown): number {
	const str = typeof raw === "string" ? raw.trim() : "";
	const n = Number(str);
	if (str === "" || Number.isNaN(n) || !Number.isFinite(n) || n <= 0) {
		throw new ValidationError("quantity must be a positive number");
	}
	return n;
}

/**
 * Parse a signed ounce delta from the water preset form. Zero, negatives,
 * and decimals are all valid — only non-numeric / non-finite input is rejected.
 */
function parseDelta(raw: unknown): number {
	const str = typeof raw === "string" ? raw.trim() : "";
	const n = Number(str);
	if (str === "" || Number.isNaN(n) || !Number.isFinite(n)) {
		throw new ValidationError("delta must be a finite number");
	}
	return n;
}

/**
 * Resolve a body-weight display preference from the `weightUnit` query param.
 * Defaults to kg for an absent/invalid value — keeping display state in the URL
 * (not a cookie) so server-rendered tests stay stateless.
 */
function resolveWeightUnit(raw: string | undefined): WeightUnit {
	return raw === "lb" ? "lb" : "kg";
}

/** Parse a positive body-weight value (kg or lb) from the submitted form. */
function parseWeightValue(raw: unknown): number {
	const str = typeof raw === "string" ? raw.trim() : "";
	const n = Number(str);
	if (str === "" || Number.isNaN(n) || !Number.isFinite(n) || n <= 0) {
		throw new ValidationError("weight must be a positive number");
	}
	return n;
}

function isWeightUnit(unit: unknown): unit is FoodWeightUnit {
	return unit === "g" || unit === "oz";
}

/**
 * Resolve the canonical quantity (in the Food's reference-portion unit) from
 * the submitted form body. Weight-based Foods accept the quantity in either
 * grams or ounces and convert to the reference unit; count-based Foods use the
 * bare count. Falls back to the reference unit when the Food is missing so
 * logConsumption can raise FoodNotFound itself.
 */
function resolveQuantity(
	catalog: FoodCatalog,
	foodId: string,
	body: Record<string, unknown>,
): number {
	const quantity = parseQuantity(body.quantity);
	const food = catalog.getFood(foodId);
	if (!food) return quantity;

	const refUnit = food.referencePortion.unit;
	if (!isWeightUnit(refUnit)) return quantity;

	const submittedUnit = String(body.unit ?? "").trim();
	if (!isWeightUnit(submittedUnit) || submittedUnit === refUnit) {
		return quantity;
	}
	return convertWeight(quantity, submittedUnit, refUnit);
}

// ---- Components ----

interface DayViewProps {
	date: string;
	foods: Food[];
	daySnapshot: {
		totals: Nutrition;
		entries: { entry: LogEntry; food: Food; macros: Nutrition }[];
		water: { ounces: number };
		weight?: { kilograms: number };
	};
	weightUnit: WeightUnit;
	prev: string;
	next: string;
	error?: string;
	formDefaults?: { foodId: string; quantity: string; unit: string };
}

const DayView: FC<DayViewProps> = ({
	date,
	foods,
	daySnapshot,
	weightUnit,
	prev,
	next,
	error,
	formDefaults,
}) => (
	<div>
		<h1>{date}</h1>
		<p>
			<a href={`/days/${prev}`}>← Previous</a> |{" "}
			<a href={`/days/${next}`}>Next →</a>
		</p>
		<p>
			<a href="/foods">Manage Foods</a>
		</p>
		<LogEntryForm
			date={date}
			foods={foods}
			error={error}
			defaults={formDefaults}
		/>
		<Totals totals={daySnapshot.totals} />
		<WaterSection date={date} ounces={daySnapshot.water.ounces} />
		<WeightSection date={date} weight={daySnapshot.weight} unit={weightUnit} />
		<h2>Entries</h2>
		{daySnapshot.entries.length === 0 ? (
			<p>Nothing logged yet.</p>
		) : (
			<ul>
				{daySnapshot.entries.map(({ entry, food, macros }) => (
					<LogEntryRow date={date} entry={entry} food={food} macros={macros} />
				))}
			</ul>
		)}
	</div>
);

interface LogEntryFormProps {
	date: string;
	foods: Food[];
	error?: string;
	defaults?: { foodId: string; quantity: string; unit: string };
}

const LogEntryForm: FC<LogEntryFormProps> = ({
	date,
	foods,
	error,
	defaults,
}) => {
	const selected =
		foods.find((f) => f.id === (defaults?.foodId ?? "")) ?? foods[0];
	const refUnit = selected?.referencePortion.unit;
	const isWeight = refUnit === "g" || refUnit === "oz";
	const unitDefault = defaults?.unit ?? refUnit ?? "";
	return (
		<form method="post" action={`/days/${date}/entries`}>
			<h2>Log a Food</h2>
			{error && <p style="color: red;">{error}</p>}
			<p>
				<label>
					Food:{" "}
					<select name="foodId" required>
						{foods.length === 0 ? (
							<option value="" disabled>
								No active foods — create one first
							</option>
						) : (
							foods.map((f) => (
								<option value={f.id} selected={f.id === defaults?.foodId}>
									{f.name} ({f.referencePortion.value} {f.referencePortion.unit}
									)
								</option>
							))
						)}
					</select>
				</label>
			</p>
			<p>
				<label>
					Quantity:{" "}
					<input
						name="quantity"
						type="number"
						step="any"
						min="0"
						value={defaults?.quantity ?? "1"}
						required
					/>
					{isWeight ? (
						<select name="unit">
							<option value="g" selected={unitDefault === "g"}>
								g
							</option>
							<option value="oz" selected={unitDefault === "oz"}>
								oz
							</option>
						</select>
					) : (
						<span>{refUnit ? ` ${refUnit}` : ""}</span>
					)}
				</label>
			</p>
			<p>
				<button type="submit" disabled={foods.length === 0}>
					Log
				</button>
			</p>
		</form>
	);
};

interface TotalsProps {
	totals: Nutrition;
}

const Totals: FC<TotalsProps> = ({ totals }) => (
	<section>
		<h2>Day totals</h2>
		<dl>
			<dt>Calories</dt>
			<dd>
				<strong data-testid="total-calories">{round(totals.calories)}</strong>{" "}
				kcal
			</dd>
			<dt>Protein</dt>
			<dd data-testid="total-protein">{round(totals.protein)} g</dd>
			<dt>Carbs</dt>
			<dd data-testid="total-carbs">{round(totals.carbs)} g</dd>
			<dt>Fat</dt>
			<dd data-testid="total-fat">{round(totals.fat)} g</dd>
			<dt>Fiber</dt>
			<dd data-testid="total-fiber">{round(totals.fiber)} g</dd>
			<dt>Sugar</dt>
			<dd data-testid="total-sugar">{round(totals.sugar)} g</dd>
			<dt>Sodium</dt>
			<dd data-testid="total-sodium">{round(totals.sodium)} mg</dd>
		</dl>
	</section>
);

interface LogEntryRowProps {
	date: string;
	entry: LogEntry;
	food: Food;
	macros: Nutrition;
}

const LogEntryRow: FC<LogEntryRowProps> = ({ date, entry, food, macros }) => {
	const unit = food.referencePortion.unit;
	return (
		<li>
			{food.name} — {entry.quantity} {unit} (
			<span data-testid="entry-calories">{round(macros.calories)}</span> kcal,{" "}
			<span data-testid="entry-protein">{round(macros.protein)}</span>g p,{" "}
			<span data-testid="entry-carbs">{round(macros.carbs)}</span>g c,{" "}
			<span data-testid="entry-fat">{round(macros.fat)}</span>g f,{" "}
			<span data-testid="entry-fiber">{round(macros.fiber)}</span>g fiber,{" "}
			<span data-testid="entry-sugar">{round(macros.sugar)}</span>g sugar,{" "}
			<span data-testid="entry-sodium">{round(macros.sodium)}</span>mg sodium)
			{" | "}
			<form
				method="post"
				action={`/entries/${entry.id}`}
				style="display: inline;"
			>
				<input type="hidden" name="_date" value={date} />
				<input
					name="quantity"
					type="number"
					step="any"
					min="0"
					value={entry.quantity}
					style="width: 5em;"
					required
				/>
				<button type="submit">Update</button>
			</form>{" "}
			<form
				method="post"
				action={`/entries/${entry.id}/delete`}
				style="display: inline;"
			>
				<input type="hidden" name="_date" value={date} />
				<button type="submit">Remove</button>
			</form>
		</li>
	);
};

interface WaterSectionProps {
	date: string;
	ounces: number;
}

/**
 * Water UI (ADR 0002): presets (glass = 8 oz, bottle = 16 oz) and the
 * `glasses = oz / 8` display are presentation only — each preset form posts
 * a signed ounce delta to the water route; the domain persists just the
 * running total.
 */
const WaterSection: FC<WaterSectionProps> = ({ date, ounces }) => {
	const glasses = ounces / GLASS_OZ;
	const presets = [
		{ label: "+ Glass", delta: GLASS_OZ },
		{ label: "− Glass", delta: -GLASS_OZ },
		{ label: "+ Bottle", delta: BOTTLE_OZ },
		{ label: "− Bottle", delta: -BOTTLE_OZ },
	];
	return (
		<section>
			<h2>Water</h2>
			<p>
				<strong data-testid="water-ounces">{round(ounces)}</strong> oz ·{" "}
				<span data-testid="water-glasses">{round(glasses)}</span> glasses
			</p>
			<p>
				{presets.map((p) => (
					<form
						method="post"
						action={`/days/${date}/water`}
						style="display: inline;"
					>
						<input type="hidden" name="delta" value={p.delta} />
						<button type="submit">{p.label}</button>
					</form>
				))}
			</p>
		</section>
	);
};

interface WeightSectionProps {
	date: string;
	weight?: { kilograms: number };
	unit: WeightUnit;
}

/**
 * Weight UI (ADR 0002): the snapshot carries only canonical kilograms; the
 * view converts to the requested display unit (kg or lb). The form posts the
 * value and unit to the weight route, which persists kg — switching display
 * units never corrupts history. Display preference lives in the `weightUnit`
 * query param so server-rendered tests stay stateless.
 */
const WeightSection: FC<WeightSectionProps> = ({ date, weight, unit }) => {
	const kilograms = weight?.kilograms;
	const display =
		kilograms === undefined
			? undefined
			: unit === "kg"
				? kilograms
				: kgToLb(kilograms);
	return (
		<section>
			<h2>Weight</h2>
			{display === undefined ? (
				<p>No weight recorded.</p>
			) : (
				<p>
					<strong data-testid="weight-value">{round(display)}</strong> {unit}
				</p>
			)}
			<form method="post" action={`/days/${date}/weight`}>
				<label>
					Weight:{" "}
					<input name="value" type="number" step="any" min="0" required />
				</label>
				<select name="unit">
					<option value="kg" selected={unit === "kg"}>
						kg
					</option>
					<option value="lb" selected={unit === "lb"}>
						lb
					</option>
				</select>
				<button type="submit">Record</button>
			</form>
		</section>
	);
};

function round(n: number): number {
	// Display two decimals max, drop trailing zeros.
	return Number(n.toFixed(2));
}
