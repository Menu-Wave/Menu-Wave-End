import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { supabase, getStaffProfile, homeRouteForRole } from "@/lib/supabase";

export const Route = createFileRoute("/")({ component: LoginPage });

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
      if (data.session) await routeByRole();
      else setCheckingSession(false);
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
    navigate({ to: homeRouteForRole(profile.role) });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    await routeByRole();
  };

  if (checkingSession) {
    return <div className="mw-loading-screen"><img src="/menu-wave-logo.png" alt="" /><span>Opening Menu-Wave…</span></div>;
  }

  return (
    <main className="mw-auth-page">
      <section className="mw-auth-brand-panel">
        <div className="mw-auth-brand">
          <img src="/menu-wave-logo.png" alt="Menu-Wave" />
          <span>Menu-Wave</span>
        </div>
        <div className="mw-auth-brand-copy">
          <span className="mw-eyebrow">Restaurant operations</span>
          <h1>Keep every order <span>moving.</span></h1>
          <p>One connected workspace for your cashier, kitchen, team and restaurant insights.</p>
          <div className="mw-auth-flow">
            <div><UtensilsCrossed size={18}/><span>Orders</span></div>
            <i />
            <div><ShieldCheck size={18}/><span>Team</span></div>
            <i />
            <div><ArrowRight size={18}/><span>Flow</span></div>
          </div>
        </div>
        <p className="mw-auth-footnote">Restaurant ordering, without the chaos.</p>
      </section>

      <section className="mw-auth-form-panel">
        <form onSubmit={handleLogin} className="mw-auth-card">
          <div className="mw-auth-mobile-brand"><img src="/menu-wave-logo.png" alt=""/><span>Menu-Wave</span></div>
          <span className="mw-eyebrow mw-eyebrow-blue">Management portal</span>
          <h2>Welcome back</h2>
          <p className="mw-auth-subtitle">Sign in with your restaurant staff account.</p>

          <label className="mw-field-label" htmlFor="email">Email address</label>
          <div className="mw-input-wrap"><Mail size={18}/><input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@restaurant.com" autoComplete="email" required /></div>

          <label className="mw-field-label" htmlFor="password">Password</label>
          <div className="mw-input-wrap"><LockKeyhole size={18}/><input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></div>

          {error && <p className="mw-auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="mw-primary-button">{loading ? "Signing in…" : <>Sign in <ArrowRight size={17}/></>}</button>
          <p className="mw-auth-help">Your access is controlled by your restaurant administrator.</p>
        </form>
      </section>
    </main>
  );
}
