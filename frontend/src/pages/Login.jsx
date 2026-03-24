import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const rolePath = {
  employee: "/employee",
  admin: "/admin",
  hr: "/hr",
  superadmin: "/superadmin"
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await login(form.username, form.password);
      navigate(rolePath[user.role] || "/login");
    } catch (apiError) {
      console.error("Login request failed", apiError?.response?.data || apiError);
      setError(apiError.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow" onSubmit={handleSubmit}>
        <h1 className="mb-1 text-2xl font-bold text-slate-800">DSR Management</h1>
        <p className="mb-6 text-sm text-slate-500">Login to continue</p>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Username</label>
          <input
            className="input"
            type="text"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            required
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
        </div>

        {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
