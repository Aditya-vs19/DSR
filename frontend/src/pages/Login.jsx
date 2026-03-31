import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

const rolePath = {
  employee: "/employee",
  admin: "/admin",
  hr: "/hr",
  superadmin: "/superadmin"
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await login(form.email, form.password);
      navigate(rolePath[user.role] || "/login");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fieldClassName =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-slate-200/80 bg-[#fbfcfb] lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.08),_transparent_32%)]" />
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />

          <div className="relative z-10 flex max-w-xl flex-col items-center px-12 text-center">
            <div className="mb-10 flex items-center gap-5">
              <img src={logo} alt="DSR Management Logo" className="h-24 w-auto object-contain" />
              
            </div>

            <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-slate-700">
              Building The Future With Tech
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-slate-500">
              We design, build and implement streamlined workflows for high-visibility operations.
            </p>
          </div>
        </section>

        <section className="relative flex items-center justify-center overflow-hidden bg-[#84c8ba] px-5 py-8 sm:px-8 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(45,212,191,0.20),_transparent_38%),radial-gradient(circle_at_right,_rgba(251,191,36,0.12),_transparent_28%)]" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(120deg,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0)_32%,rgba(255,255,255,0.26)_65%,rgba(255,255,255,0)_100%)]" />

          <div className="relative z-10 w-full max-w-xl">
            <div className="mb-8 text-center lg:hidden">
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-[#128a97]">DSR Management</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-800">
                Building The Future With Tech
              </h2>
            </div>

            <form
              className="mx-auto w-full max-w-lg rounded-[10px] bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)] ring-1 ring-white/70 backdrop-blur sm:p-7 lg:p-8"
              onSubmit={handleSubmit}
            >
              <h1 className="text-3xl font-bold tracking-tight text-[#0f6171] sm:text-[2.2rem]">Welcome back</h1>
              <p className="mt-3 text-base text-slate-500">Sign in to continue to your dashboard</p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-700">Username</label>
                  <input
                    className={fieldClassName}
                    type="text"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <input
                      className={`${fieldClassName} pr-14`}
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-400 transition hover:text-slate-600"
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                        <path
                          d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-3">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-[#0f6171] focus:ring-[#0f6171]"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {error && <p className="mt-5 text-sm font-medium text-rose-600">{error}</p>}

              <button
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#2f2f2f] px-6 py-3.5 text-base font-semibold text-white shadow-[0_14px_24px_rgba(15,23,42,0.16)] transition hover:bg-[#232323] disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <div className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-400">
                &copy; {new Date().getFullYear()} DSR Management. All rights reserved.
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
