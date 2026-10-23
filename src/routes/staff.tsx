import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getStaffProfile, supabase, type StaffProfile, type StaffRole } from "@/lib/supabase";

export const Route = createFileRoute("/staff")({ component: StaffPage });

type ManagedRole = "manager" | "cashier" | "kitchen";
type StaffMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: StaffRole;
  created_at: string;
};

const API = "https://wxlhhisfexcltjpvcljo.supabase.co/functions/v1/staff-management";

async function staffRequest(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: "sb_publishable_6bs0IPax7ctABcDJrcWW5w_3PHfgfvk",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Staff request failed.");
  return payload;
}

function StaffPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedRole>("cashier");

  const loadStaff = useCallback(async () => {
    const payload = await staffRequest("GET");
    setStaff(payload.staff ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const p = await getStaffProfile();
      if (!p) return navigate({ to: "/" });
      if (p.role !== "owner" && p.role !== "manager") return navigate({ to: "/admin" });
      setProfile(p);
      try { await loadStaff(); } catch (e) { setError(e instanceof Error ? e.message : "Could not load staff."); }
      finally { setChecking(false); }
    })();
  }, [loadStaff, navigate]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      await staffRequest("POST", { full_name: fullName.trim(), email: email.trim(), role });
      setFullName(""); setEmail(""); setRole("cashier");
      setSuccess(`Invitation sent to ${email.trim()}.`);
      await loadStaff();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not invite worker."); }
    finally { setLoading(false); }
  };

  const changeRole = async (member: StaffMember, nextRole: ManagedRole) => {
    setError(null); setSuccess(null);
    try {
      await staffRequest("PATCH", { id: member.id, role: nextRole });
      setStaff((prev) => prev.map((x) => x.id === member.id ? { ...x, role: nextRole } : x));
      setSuccess(`${member.full_name || member.email || "Worker"}'s role was updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update role."); }
  };

  const remove = async (member: StaffMember) => {
    if (!window.confirm(`Remove ${member.full_name || member.email || "this worker"} from Menu-Wave?`)) return;
    setError(null); setSuccess(null);
    try {
      await staffRequest("DELETE", { id: member.id });
      setStaff((prev) => prev.filter((x) => x.id !== member.id));
      setSuccess("Worker removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove worker."); }
  };

  if (checking) return <div className="grid h-screen place-items-center text-slate-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div><h1 className="text-xl font-bold text-slate-900">Staff Management</h1><p className="text-xs text-slate-500">Invite workers and control their access</p></div>
        <Link to="/admin" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Back to Admin</Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-5">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Add worker</h2>
          <p className="mt-1 text-sm text-slate-500">They will receive an email invitation to join this restaurant.</p>
          <form onSubmit={invite} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as ManagedRole)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="manager">Manager</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option>
            </select>
            <button disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{loading ? "Sending…" : "Send invite"}</button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Restaurant staff</h2><p className="text-sm text-slate-500">{staff.length} account{staff.length === 1 ? "" : "s"}</p></div>
          <div className="divide-y divide-slate-100">
            {staff.map((member) => {
              const protectedAccount = member.role === "owner" || member.role === "platform_admin" || member.id === profile?.id;
              return <div key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-slate-900">{member.full_name || (member.role === "owner" ? "Restaurant owner" : "Staff member")}</p><p className="text-sm text-slate-500">{member.email || "Email not stored for this older account"}</p><span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-600">{member.role.replace("_", " ")}</span></div>
                {!protectedAccount && <div className="flex flex-wrap gap-2"><select value={member.role} onChange={(e) => changeRole(member, e.target.value as ManagedRole)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option></select><button onClick={() => remove(member)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Remove</button></div>}
              </div>;
            })}
            {staff.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No staff accounts yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
