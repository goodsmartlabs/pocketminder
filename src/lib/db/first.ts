/** First row of a result set, or undefined (Postgres equivalent of SQLite's `.get()`). */
export function firstRow<T>(rows: T[]): T | undefined {
  return rows[0];
}

/** The single row an INSERT/UPDATE ... RETURNING produced; throws if none. */
export function oneRow<T>(rows: T[]): T {
  if (rows.length === 0)
    throw new Error("Expected a row but the query returned none.");
  return rows[0];
}
