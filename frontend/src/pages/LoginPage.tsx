import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../app/auth";
import { authApi, ApiError } from "../lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
const registerSchema = loginSchema.extend({
  firstName: z.string().min(1, "Enter your first name."),
  lastName: z.string().min(1, "Enter your last name."),
  password: z.string().min(12, "Use at least 12 characters."),
});

type LoginPageProps = { mode?: "login" | "register" };

export function LoginPage({ mode = "login" }: LoginPageProps) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await authApi.register(form);
        navigate("/login", { replace: true });
        return;
      }
      await signIn(form.email, form.password);
      navigate("/learn", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We could not complete that request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page page-container">
      <div className="auth-card">
        <p className="eyebrow">{isRegister ? "Begin here" : "Welcome back"}</p>
        <h1>
          {isRegister ? "Create your space." : "Pick up where you left off."}
        </h1>
        <p className="lede">
          {isRegister
            ? "Your learning journey starts with one simple step."
            : "Sign in to return to your courses and progress."}
        </p>
        <form className="auth-form" onSubmit={submit} noValidate>
          {isRegister && (
            <div className="form-row">
              <label>
                First name
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last name
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  autoComplete="family-name"
                />
              </label>
            </div>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary form-submit" disabled={busy}>
            {busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <Link className="text-link" to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
        <Link className="text-link" to="/">
          Back home
        </Link>
      </div>
    </section>
  );
}
