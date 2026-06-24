import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { createDataStore } from "./data/store.js";
import { createConsumptionLog } from "./modules/consumption-log.js";
import { createDaySnapshot } from "./modules/day-snapshot.js";
import { createFoodCatalog } from "./modules/food-catalog.js";
import { createFoodsRoutes } from "./routes/web/foods.jsx";
import { createLogRoutes } from "./routes/web/log.jsx";
import { Layout } from "./views/Layout.jsx";

const DB_PATH = "data/dag-cal.sqlite";

// Ensure parent directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
const store = createDataStore(db);
const catalog = createFoodCatalog(store);
const consumptionLog = createConsumptionLog(store);
const daySnapshot = createDaySnapshot(store);

const app = new Hono();

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

app.get("/", (c) => {
	return c.html(
		<Layout title="Home">
			<h1>dag-cal</h1>
			<p>
				<a href={`/days/${today()}`}>Today's Log</a>
			</p>
			<p>
				<a href="/foods">Manage Foods</a>
			</p>
		</Layout>,
	);
});

app.route("/foods", createFoodsRoutes(catalog));
app.route("/days", createLogRoutes(catalog, consumptionLog, daySnapshot));

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
