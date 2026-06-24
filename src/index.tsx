import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { createDataStore } from "./data/store.js";
import { createFoodCatalog } from "./modules/food-catalog.js";
import { createFoodsRoutes } from "./routes/web/foods.jsx";
import { Layout } from "./views/Layout.jsx";

const DB_PATH = "data/dag-cal.sqlite";

// Ensure parent directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
const store = createDataStore(db);
const catalog = createFoodCatalog(store);

const app = new Hono();

app.get("/", (c) => {
	return c.html(
		<Layout title="Home">
			<h1>dag-cal</h1>
			<p>
				<a href="/foods">Manage Foods</a>
			</p>
		</Layout>,
	);
});

app.route("/foods", createFoodsRoutes(catalog));

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
