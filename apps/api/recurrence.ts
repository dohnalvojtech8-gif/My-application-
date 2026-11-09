export function occurrence(
  start: string,
  frequency: string,
  interval: number,
  index: number,
): string {
  const d = new Date(start + "T12:00:00Z"),
    original = d.getUTCDate();
  if (frequency === "DAILY" || frequency === "WEEKLY")
    d.setUTCDate(
      original + index * interval * (frequency === "WEEKLY" ? 7 : 1),
    );
  else {
    d.setUTCDate(1);
    d.setUTCMonth(
      d.getUTCMonth() + index * interval * (frequency === "YEARLY" ? 12 : 1),
    );
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(original, last));
  }
  return d.toISOString().slice(0, 10);
}
