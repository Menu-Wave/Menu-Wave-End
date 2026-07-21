import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, getStaffProfile } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await routeByRole();
      } else {
        setCheckingSession(false);
      }
    })();
  }, []);

  const routeByRole = async () => {
    const profile = await getStaffProfile();
    if (!profile) {
      setError("Your account isn't linked to a restaurant yet. Contact your admin.");
      await supabase.auth.signOut();
      setCheckingSession(false);
      return;
    }
    if (profile.role === "manager" || profile.role === "platform_admin") {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/cashier" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    await routeByRole();
  };

  if (checkingSession) {
    return <div className="grid h-screen place-items-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="grid h-screen place-items-center bg-slate-50 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Menu-Wave Staff</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
