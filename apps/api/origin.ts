/** Only server-configured origins are trusted; never use a request Host header. */
export function allowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const values = [env.APP_ORIGIN, env.RENDER_EXTERNAL_URL];
  if (env.NODE_ENV !== "production") values.push("http://localhost:3000");
  return new Set(
    values.flatMap((value) => {
      if (!value) return [];
      try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? [url.origin] : [];
      } catch {
        return [];
      }
    }),
  );
}
