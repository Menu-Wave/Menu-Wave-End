import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    event.preventDefault();
    setError("");
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

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Set your password</h1>
        <p className="mt-2 text-sm text-slate-600">Create a password for your Menu-Wave staff account. You will use your email and this password to sign in later.</p>
        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Password</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} disabled={!ready||saving} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="At least 8 characters" autoComplete="new-password"/></div>
          <div><label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label><input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} disabled={!ready||saving} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Repeat your password" autoComplete="new-password"/></div>
          <button type="submit" disabled={!ready||saving} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50">{saving?"Saving...":"Set password & continue"}</button>
        </form>
      </div>
    </main>
  );
}
