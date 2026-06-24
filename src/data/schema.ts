import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const foods = sqliteTable("foods", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	referenceValue: real("reference_value").notNull(),
	referenceUnit: text("reference_unit").notNull(),
	calories: real("calories").notNull(),
	protein: real("protein").notNull(),
	carbs: real("carbs").notNull(),
	fat: real("fat").notNull(),
	fiber: real("fiber").notNull(),
	sugar: real("sugar").notNull(),
	sodium: real("sodium").notNull(),
	archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});
