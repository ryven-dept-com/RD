// Runs once when the Node.js server starts. Ensures the database schema exists
// and seeds the demo catalogue + admin reference data when the database is
// empty, so a freshly deployed store matches the original design out of the box.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const [{ db }, { bootstrapIfNeeded }] = await Promise.all([
        import("@/db"),
        import("@/lib/seed-db"),
      ]);
      await bootstrapIfNeeded(db);
    } catch (err) {
      // Never crash the server on a bootstrap failure; pages still render
      // their own error states and the admin/health endpoints report status.
      console.error("[bootstrap] database bootstrap failed:", err);
    }
  }
}
