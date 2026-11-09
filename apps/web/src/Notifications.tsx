import { useEffect, useState } from "react";
import { call } from "./Settings";
export function Notifications({ onDate }: { onDate: (d: string) => void }) {
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    call("/notifications")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <article>
      <h2>Upozornění</h2>
      <p role="alert">{error}</p>
      <button
        onClick={async () => {
          try {
            if (!("serviceWorker" in navigator) || !("PushManager" in window))
              throw Error("Toto zařízení nepodporuje Web Push.");
            const { publicKey } = await call("/push/key");
            if (!publicKey)
              throw Error("Provozovatel musí nejprve nastavit VAPID klíče.");
            if ((await Notification.requestPermission()) !== "granted")
              throw Error("Oprávnění nebylo uděleno.");
            const sw = await navigator.serviceWorker.ready;
            const subscription = await sw.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: publicKey,
            });
            await call("/push", subscription.toJSON());
            setError("Zařízení přihlášeno k upozorněním.");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Povolit push na tomto zařízení
      </button>
      {items.length === 0 && <p>Zatím nemáte žádná upozornění.</p>}
      {items.map((n) => (
        <button
          key={n.id}
          onClick={async () => {
            await call("/notifications/" + n.id + "/read", {});
            onDate(n.date);
          }}
        >
          {n.read ? "" : "● "}
          {n.title} · {n.date}
        </button>
      ))}
    </article>
  );
}
