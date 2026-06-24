import { Hono } from "hono";
import type { FC } from "hono/jsx";
import type { Food, FoodCatalog, Unit } from "../../modules/food-catalog.js";
import {
	FoodNotFoundError,
	ValidationError,
} from "../../modules/food-catalog.js";
import { Layout } from "../../views/Layout.jsx";

export function createFoodsRoutes(catalog: FoodCatalog): Hono {
	const app = new Hono();

	// GET /foods — searchable list
	app.get("/", (c) => {
		const q = c.req.query("q") ?? "";
		const foods = catalog.listActiveFoods(q);
		return c.html(
			<Layout title="Foods">
				<FoodList foods={foods} query={q} />
			</Layout>,
		);
	});

	// GET /foods/new — create form
	app.get("/new", (c) => {
		return c.html(
			<Layout title="New Food">
				<FoodForm />
			</Layout>,
		);
	});

	// POST /foods — create handler
	app.post("/", async (c) => {
		const body = await c.req.parseBody();
		try {
			const food = catalog.createFood(parseFoodInput(body));
			return c.redirect(`/foods/${food.id}`);
		} catch (e) {
			if (e instanceof ValidationError) {
				return c.html(
					<Layout title="New Food">
						<FoodForm error={e.message} defaults={bodyToDefaults(body)} />
					</Layout>,
				);
			}
			throw e;
		}
	});

	// GET /foods/:id — view
	app.get("/:id", (c) => {
		const food = catalog.getFood(c.req.param("id"));
		if (!food) {
			return c.text("Food not found", 404);
		}
		return c.html(
			<Layout title={food.name}>
				<FoodView food={food} />
			</Layout>,
		);
	});

	// GET /foods/:id/edit — edit form
	app.get("/:id/edit", (c) => {
		const food = catalog.getFood(c.req.param("id"));
		if (!food) {
			return c.text("Food not found", 404);
		}
		return c.html(
			<Layout title={`Edit ${food.name}`}>
				<FoodForm food={food} />
			</Layout>,
		);
	});

	// POST /foods/:id — update handler
	app.post("/:id", async (c) => {
		const id = c.req.param("id");
		const body = await c.req.parseBody();
		try {
			const updated = catalog.updateFood(id, parseUpdateInput(body));
			return c.redirect(`/foods/${updated.id}`);
		} catch (e) {
			if (e instanceof FoodNotFoundError) {
				return c.text("Food not found", 404);
			}
			if (e instanceof ValidationError) {
				const food = catalog.getFood(id);
				if (!food) return c.text("Food not found", 404);
				return c.html(
					<Layout title={`Edit ${food.name}`}>
						<FoodForm
							food={food}
							error={e.message}
							defaults={bodyToDefaults(body)}
						/>
					</Layout>,
				);
			}
			throw e;
		}
	});

	return app;
}

// ---- Parsing ----

function parseUnit(raw: unknown): Unit {
	const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
	if (v === "g" || v === "oz" || v === "unit") return v;
	throw new ValidationError("unit must be one of g, oz, unit");
}

function parseNumber(raw: unknown, label: string): number {
	const str = typeof raw === "string" ? raw.trim() : "";
	const n = Number(str);
	if (str === "" || Number.isNaN(n)) {
		throw new ValidationError(`${label} must be a number`);
	}
	return n;
}

interface ParsedBody {
	[key: string]: unknown;
}

function parseFoodInput(body: ParsedBody) {
	return {
		name: String(body.name ?? "").trim(),
		referencePortion: {
			value: parseNumber(body.referenceValue, "Reference value"),
			unit: parseUnit(body.referenceUnit),
		},
		nutrition: {
			calories: parseNumber(body.calories, "Calories"),
			protein: parseNumber(body.protein, "Protein"),
			carbs: parseNumber(body.carbs, "Carbs"),
			fat: parseNumber(body.fat, "Fat"),
			fiber: parseNumber(body.fiber, "Fiber"),
			sugar: parseNumber(body.sugar, "Sugar"),
			sodium: parseNumber(body.sodium, "Sodium"),
		},
	};
}

function parseUpdateInput(body: ParsedBody) {
	const changes: Record<string, unknown> = {};
	if (body.name !== undefined) changes.name = String(body.name).trim();
	if (body.referenceValue !== undefined || body.referenceUnit !== undefined) {
		changes.referencePortion = {
			value: parseNumber(body.referenceValue, "Reference value"),
			unit: parseUnit(body.referenceUnit),
		};
	}
	// Only include nutrition if any field is present
	const hasNutrition =
		body.calories !== undefined ||
		body.protein !== undefined ||
		body.carbs !== undefined ||
		body.fat !== undefined ||
		body.fiber !== undefined ||
		body.sugar !== undefined ||
		body.sodium !== undefined;
	if (hasNutrition) {
		changes.nutrition = {
			calories: parseNumber(body.calories, "Calories"),
			protein: parseNumber(body.protein, "Protein"),
			carbs: parseNumber(body.carbs, "Carbs"),
			fat: parseNumber(body.fat, "Fat"),
			fiber: parseNumber(body.fiber, "Fiber"),
			sugar: parseNumber(body.sugar, "Sugar"),
			sodium: parseNumber(body.sodium, "Sodium"),
		};
	}
	return changes;
}

function bodyToDefaults(body: ParsedBody) {
	return {
		name: String(body.name ?? ""),
		referenceValue: String(body.referenceValue ?? "100"),
		referenceUnit: String(body.referenceUnit ?? "g"),
		calories: String(body.calories ?? ""),
		protein: String(body.protein ?? ""),
		carbs: String(body.carbs ?? ""),
		fat: String(body.fat ?? ""),
		fiber: String(body.fiber ?? "0"),
		sugar: String(body.sugar ?? "0"),
		sodium: String(body.sodium ?? "0"),
	};
}

// ---- Components ----

interface FoodListProps {
	foods: Food[];
	query: string;
}

const FoodList: FC<FoodListProps> = ({ foods, query }) => (
	<div>
		<h1>Foods</h1>
		<form method="get" action="/foods">
			<input
				type="search"
				name="q"
				value={query}
				placeholder="Search foods..."
			/>
			<button type="submit">Search</button>
		</form>
		<p>
			<a href="/foods/new">+ New Food</a>
		</p>
		{foods.length === 0 ? (
			<p>{query ? "No foods match your search." : "No foods yet."}</p>
		) : (
			<ul>
				{foods.map((food) => (
					<li>
						<a href={`/foods/${food.id}`}>{food.name}</a> —{" "}
						{food.referencePortion.value} {food.referencePortion.unit}
						{" | "}
						<a href={`/foods/${food.id}/edit`}>Edit</a>
					</li>
				))}
			</ul>
		)}
	</div>
);

interface FoodViewProps {
	food: Food;
}

const FoodView: FC<FoodViewProps> = ({ food }) => {
	const { nutrition, referencePortion: r } = food;
	return (
		<div>
			<h1>{food.name}</h1>
			<p>
				<a href={`/foods/${food.id}/edit`}>Edit</a> |{" "}
				<a href="/foods">← Back to list</a>
			</p>
			<h2>Reference portion</h2>
			<p>
				{r.value} {r.unit}
			</p>
			<h2>
				Nutrition (per {r.value} {r.unit})
			</h2>
			<NutritionTable nutrition={nutrition} />
		</div>
	);
};

interface NutritionTableProps {
	nutrition: Food["nutrition"];
}

const NutritionTable: FC<NutritionTableProps> = ({ nutrition }) => (
	<table>
		<thead>
			<tr>
				<th>Nutrient</th>
				<th>Amount</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>Calories</td>
				<td>{nutrition.calories}</td>
			</tr>
			<tr>
				<td>Protein</td>
				<td>{nutrition.protein} g</td>
			</tr>
			<tr>
				<td>Carbs</td>
				<td>{nutrition.carbs} g</td>
			</tr>
			<tr>
				<td>Fat</td>
				<td>{nutrition.fat} g</td>
			</tr>
			<tr>
				<td>Fiber</td>
				<td>{nutrition.fiber} g</td>
			</tr>
			<tr>
				<td>Sugar</td>
				<td>{nutrition.sugar} g</td>
			</tr>
			<tr>
				<td>Sodium</td>
				<td>{nutrition.sodium} mg</td>
			</tr>
		</tbody>
	</table>
);

interface FoodFormProps {
	food?: Food;
	error?: string;
	defaults?: ReturnType<typeof bodyToDefaults>;
}

const FoodForm: FC<FoodFormProps> = ({ food, error, defaults }) => {
	const isEdit = !!food;
	const action = isEdit ? `/foods/${food.id}` : "/foods";
	const d = defaults ?? {
		name: food?.name ?? "",
		referenceValue: String(food?.referencePortion.value ?? "100"),
		referenceUnit: food?.referencePortion.unit ?? "g",
		calories: String(food?.nutrition.calories ?? ""),
		protein: String(food?.nutrition.protein ?? ""),
		carbs: String(food?.nutrition.carbs ?? ""),
		fat: String(food?.nutrition.fat ?? ""),
		fiber: String(food?.nutrition.fiber ?? "0"),
		sugar: String(food?.nutrition.sugar ?? "0"),
		sodium: String(food?.nutrition.sodium ?? "0"),
	};

	return (
		<div>
			<h1>{isEdit ? `Edit ${food.name}` : "New Food"}</h1>
			{error && <p style="color: red;">{error}</p>}
			<form method="post" action={action}>
				<fieldset>
					<legend>Basic info</legend>
					<div>
						<label>
							Name: <input name="name" value={d.name} required />
						</label>
					</div>
					<div>
						<label>
							Reference value:{" "}
							<input
								name="referenceValue"
								type="number"
								step="any"
								value={d.referenceValue}
								required
							/>
						</label>
					</div>
					<div>
						<label>
							Reference unit:{" "}
							<select name="referenceUnit" value={d.referenceUnit}>
								<option value="g">g</option>
								<option value="oz">oz</option>
								<option value="unit">unit</option>
							</select>
						</label>
					</div>
				</fieldset>
				<fieldset>
					<legend>Nutrition (per reference portion)</legend>
					<NutritionField
						label="Calories"
						name="calories"
						value={d.calories}
						unit="kcal"
					/>
					<NutritionField
						label="Protein"
						name="protein"
						value={d.protein}
						unit="g"
					/>
					<NutritionField label="Carbs" name="carbs" value={d.carbs} unit="g" />
					<NutritionField label="Fat" name="fat" value={d.fat} unit="g" />
					<NutritionField label="Fiber" name="fiber" value={d.fiber} unit="g" />
					<NutritionField label="Sugar" name="sugar" value={d.sugar} unit="g" />
					<NutritionField
						label="Sodium"
						name="sodium"
						value={d.sodium}
						unit="mg"
					/>
				</fieldset>
				<div>
					<button type="submit">
						{isEdit ? "Save Changes" : "Create Food"}
					</button>
					{" | "}
					<a href={isEdit ? `/foods/${food.id}` : "/foods"}>Cancel</a>
				</div>
			</form>
		</div>
	);
};

interface NutritionFieldProps {
	label: string;
	name: string;
	value: string;
	unit: string;
}

const NutritionField: FC<NutritionFieldProps> = ({
	label,
	name,
	value,
	unit,
}) => (
	<div>
		<label>
			{label}:{" "}
			<input name={name} type="number" step="any" value={value} required />{" "}
			{unit}
		</label>
	</div>
);
