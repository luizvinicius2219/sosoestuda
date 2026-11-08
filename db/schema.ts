import { integer, pgTable, text } from "drizzle-orm/pg-core";
export const userStudyState = pgTable("user_study_state", {
 ownerId:text("owner_id").primaryKey(), stateJson:text("state_json").notNull(),
 version:integer("version").notNull().default(1), updatedAt:text("updated_at").notNull(),
});
