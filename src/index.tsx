import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Home } from "./views/Home.jsx";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/jsx/:name", (c) => {
	const name = c.req.param("name");
	const items = ["Hono", "JSX", "TypeScript", "Node"];
	return c.html(<Home name={name} items={items} />);
});

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
