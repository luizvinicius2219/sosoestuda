// Runs only while the one-time server-side credential is configured.
// No credentials or private planner content are part of the repository.
if (process.env.SOFIA_INITIAL_PASSWORD_HASH) await import("./setup-sofia.mjs");
