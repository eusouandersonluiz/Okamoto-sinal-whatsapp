import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";

// Stores the per-tenant Google OAuth tokens used for Google Contacts (People API)
// import/export. One Google account per tenant (unique tenant_id).
export const googleOauthTokensTable = pgTable(
  "google_oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    googleSub: text("google_sub"),
    email: text("email"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenType: text("token_type"),
    scope: text("scope"),
    expiry: timestamp("expiry", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.tenantId)],
);

export type GoogleOauthToken = typeof googleOauthTokensTable.$inferSelect;

// Short-lived OAuth state records (CSRF + tenant resolution) so the connect flow
// works in a first-party tab without relying on the iframe's session cookie.
export const googleOauthStatesTable = pgTable("google_oauth_states", {
  state: text("state").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id"),
  email: text("email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GoogleOauthState = typeof googleOauthStatesTable.$inferSelect;
