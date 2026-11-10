import { registerPlugin, Capacitor } from "@capacitor/core";
export const nativeWidgets = registerPlugin<{
  connect(v: {
    origin: string;
    token: string;
    deviceId: string;
  }): Promise<void>;
  disconnect(): Promise<void>;
  status(): Promise<{ connected: boolean; deviceId?: string }>;
  refresh(): Promise<void>;
}>("MoneyWidgets");
export const nativeWidgetSupport = () => Capacitor.isNativePlatform();
