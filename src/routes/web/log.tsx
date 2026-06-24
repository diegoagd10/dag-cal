import { type Context, Hono } from "hono";
import type { FC } from "hono/jsx";
import type { ConsumptionLog } from "../../modules/consumption-log.types.js";
import {
	FoodArchivedError,
	type LogEntry,
	LogEntryNotFoundError,
} from "../../modules/consumption-log.types.js";
import type { Food, FoodCatalog } from "../../modules/food-catalog.js";
import {
	FoodNotFoundError,
	ValidationError,
} from "../../modules/food-catalog.js";
import type { WeightUnit } from "../../modules/units.js";
import { convertWeight } from "../../modules/units.js";
import { Layout } from "../../views/Layout.jsx";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createLogRoutes(
	catalog: FoodCatalog,
	log: ConsumptionLog,
): Hono {
	const app = new Hono();

	// GET /days/:date — day view + log form
	app.get("/:date", (c) => {
		const date = c.req.param("date");
		if (!ISO_DATE.test(date)) return c.text("Invalid date", 400);

		const foods = catalog.listActiveFoods();
		const entries = log.listEntries(date);
		// Resolve each entry's Food so the unit + name render without JS.
		const rows = entries.map((e) => ({
			entry: e,
			food: catalog.getFood(e.foodId),
		}));

		return c.html(
			<Layout title={`Log — ${date}`}>
				<DayView date={date} foods={foods} rows={rows} />
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
				return renderDayWith(c, catalog, log, date, e.message, body);
			}
			if (e instanceof FoodNotFoundError) {
				return renderDayWith(c, catalog, log, date, `Food not found`, body);
			}
			if (e instanceof FoodArchivedError) {
				return renderDayWith(c, catalog, log, date, `Food is archived`, body);
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
	log: ConsumptionLog,
	date: string,
	error: string,
	body: Record<string, unknown>,
) {
	const foods = catalog.listActiveFoods();
	const entries = log.listEntries(date);
	const rows = entries.map((e) => ({
		entry: e,
		food: catalog.getFood(e.foodId),
	}));
	return c.html(
		<Layout title={`Log — ${date}`}>
			<DayView
				date={date}
				foods={foods}
				rows={rows}
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

// ---- Parsing ----

function parseQuantity(raw: unknown): number {
	const str = typeof raw === "string" ? raw.trim() : "";
	const n = Number(str);
	if (str === "" || Number.isNaN(n) || !Number.isFinite(n) || n <= 0) {
		throw new ValidationError("quantity must be a positive number");
	}
	return n;
}

function isWeightUnit(unit: unknown): unit is WeightUnit {
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
	rows: { entry: LogEntry; food: Food | undefined }[];
	error?: string;
	formDefaults?: { foodId: string; quantity: string; unit: string };
}

const DayView: FC<DayViewProps> = ({
	date,
	foods,
	rows,
	error,
	formDefaults,
}) => (
	<div>
		<h1>{date}</h1>
		<p>
			<a href="/foods">Manage Foods</a>
		</p>
		<LogEntryForm
			date={date}
			foods={foods}
			error={error}
			defaults={formDefaults}
		/>
		<h2>Entries</h2>
		{rows.length === 0 ? (
			<p>Nothing logged yet.</p>
		) : (
			<ul>
				{rows.map(({ entry, food }) => (
					<LogEntryRow date={date} entry={entry} food={food} />
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

interface LogEntryRowProps {
	date: string;
	entry: LogEntry;
	food: Food | undefined;
}

const LogEntryRow: FC<LogEntryRowProps> = ({ date, entry, food }) => {
	const name = food?.name ?? "(archived food)";
	const unit = food?.referencePortion.unit ?? "";
	return (
		<li>
			{name} — {entry.quantity} {unit}
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
