import type { CapacitorConfig } from "@capacitor/cli";
const serverUrl = process.env.MOBILE_SERVER_URL;
if (serverUrl && !serverUrl.startsWith("https://"))
  throw Error("MOBILE_SERVER_URL must use HTTPS");
const config: CapacitorConfig = {
  appId: "cz.systematic.money",
  appName: "SYSTEMATIC MONEY",
  webDir: "dist/web",
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
};
export default config;
