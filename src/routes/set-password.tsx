import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/set-password")({ component: SetPasswordPage });

function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(Boolean(data.session));
      if (!data.session) setError("Your invitation session is missing or has expired. Ask your restaurant administrator to send a new invitation.");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) { setReady(true); setError(""); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate({ to: "/" });
    const { data: staff } = await supabase.from("staff").select("role").eq("id", user.id).single();
    if (staff?.role === "owner" || staff?.role === "manager" || staff?.role === "platform_admin") navigate({ to: "/admin" });
    else if (staff?.role === "kitchen") navigate({ to: "/kitchen" });
    else navigate({ to: "/cashier" });
  };

  return <main className="mw-password-page">
    <section className="mw-password-card">
      <div className="mw-auth-mobile-brand"><img src="/menu-wave-logo.png" alt=""/><span>Menu-Wave</span></div>
      <div className="mw-password-icon"><KeyRound size={24}/></div>
      <span className="mw-eyebrow mw-eyebrow-blue">Staff invitation</span>
      <h1>Set your password</h1>
      <p>Create a secure password for your Menu-Wave staff account.</p>
      {error && <div className="mw-auth-error">{error}</div>}
      <form onSubmit={submit} className="mw-password-form">
        <label className="mw-field-label" htmlFor="new-password">Password</label>
        <div className="mw-input-wrap"><LockKeyhole size={18}/><input id="new-password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} disabled={!ready||saving} placeholder="At least 8 characters" autoComplete="new-password"/></div>
        <label className="mw-field-label" htmlFor="confirm-password">Confirm password</label>
        <div className="mw-input-wrap"><LockKeyhole size={18}/><input id="confirm-password" type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} disabled={!ready||saving} placeholder="Repeat your password" autoComplete="new-password"/></div>
        <button type="submit" disabled={!ready||saving} className="mw-primary-button">{saving ? "Saving…" : <>Set password & continue <ArrowRight size={17}/></>}</button>
      </form>
    </section>
  </main>;
}
