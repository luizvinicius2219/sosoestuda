import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Identity is supplied by the hosting platform, never by the request payload.
export const userStudyState = sqliteTable("user_study_state", {
  ownerId: text("owner_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
