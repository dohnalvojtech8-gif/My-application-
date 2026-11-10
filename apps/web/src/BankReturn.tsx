import { useState } from "react";
const query = new URLSearchParams(location.search);
const code = query.get("code"),
  state = query.get("state");
const valid =
  !!code && code.length <= 2000 && !!state && /^[a-f0-9]{64}$/.test(state);
if (location.pathname === "/bank/callback")
  history.replaceState(null, "", "/bank/callback");
export function BankReturn() {
  const [copied] = useState(valid);
  if (!copied)
    return (
      <main className="auth">
        <h1>Připojení banky nebylo dokončeno</h1>
        <p>Vraťte se do nastavení a zahajte připojení znovu.</p>
        <a href="/">Zpět do aplikace</a>
      </main>
    );
  const params = new URLSearchParams({ code: code!, state: state! });
  return (
    <main className="auth">
      <h1>Dokončit připojení banky</h1>
      <p>
        Vraťte se do stejného účtu SYSTEMATIC MONEY, ze kterého jste připojení
        zahájili.
      </p>
      <a href={"systematicmoney://bank?" + params}>
        Vrátit do mobilní aplikace
      </a>
      <p>
        <a
          href={
            "/?bankCode=" +
            encodeURIComponent(code!) +
            "&bankState=" +
            encodeURIComponent(state!)
          }
        >
          Dokončit ve webové aplikaci
        </a>
      </p>
    </main>
  );
}
export function captureBankReturn() {
  const q = new URLSearchParams(location.search),
    code = q.get("bankCode"),
    state = q.get("bankState");
  if (code && state) {
    history.replaceState(null, "", location.pathname);
    return { code, state };
  }
  return null;
}
