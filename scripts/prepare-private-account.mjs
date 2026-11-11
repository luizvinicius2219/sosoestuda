// Runs only while the one-time server-side credential is configured.
// No credentials or private planner content are part of the repository.
if (process.env.SOFIA_INITIAL_PASSWORD_HASH) await import("./setup-sofia.mjs");
if (process.env.NOTEBOOK_IMPORT_JSON) {
  const { importPrivateNotebook } = await import("./import-notebook.mjs");
  await importPrivateNotebook();
}
