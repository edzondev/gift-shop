import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useRef, useState } from "react";
import adminCss from "../admin.css?url";
import { beginLogin, loginFailureMessage, releaseSubmit } from "../admin-session";
import { adminMe, loginAdmin } from "../admin-session.functions";
import { controlValue } from "../field-value";

export const Route = createFileRoute("/admin_/login")({
  beforeLoad: async () => {
    const me = await adminMe();
    if (me.kind === "ok") throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [{ title: "Entrar" }],
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const login = useServerFn(loginAdmin);
  const navigate = useNavigate();
  const gate = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const attempt = beginLogin(isSubmitting, gate, { email, password });
    if (attempt.kind === "ignored") return;
    if (attempt.kind === "invalid") {
      setMessage(attempt.message);
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    void login({ data: { email: attempt.email, password: attempt.password } })
      .then(async (view) => {
        if (view.kind === "ok") {
          await navigate({ to: "/admin" });
          return;
        }
        releaseSubmit(gate);
        setIsSubmitting(false);
        setMessage(view.message);
      })
      .catch(() => {
        releaseSubmit(gate);
        setIsSubmitting(false);
        setMessage(loginFailureMessage("unavailable"));
      });
  }

  return (
    <main className="login">
      <form className="panel stack" onSubmit={submit}>
        <h1>Entrar</h1>
        <p className="muted">Panel de la artesana</p>
        <label className="field" htmlFor="admin-email">
          <span>Correo</span>
          <input
            id="admin-email"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(controlValue(event.currentTarget))}
          />
        </label>
        <label className="field" htmlFor="admin-password">
          <span>Contraseña</span>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(controlValue(event.currentTarget))}
          />
        </label>
        {message === null ? null : (
          <p role="alert" className="field-error">
            {message}
          </p>
        )}
        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
