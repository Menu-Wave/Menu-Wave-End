import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, getStaffProfile, nextStatus, type Order, type StaffProfile } from "@/lib/supabase";

export const Route = createFileRoute("/cashier")({
  component: CashierPage,
});

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function CashierPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"All" | string>("All");
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getStaffProfile();
      if (!p) {
        navigate({ to: "/" });
        return;
      }
      setProfile(p);
      setChecking(false);
    })();
  }, [navigate]);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadOrders();
    const channel = supabase
      .channel("cashier-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, loadOrders]);

  const visible = useMemo(() => {
    let list = filter === "All" ? orders : orders.filter((o) => (o.Status || "New") === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      const normalized = q.replace(/^[a-z]+-/, "");
      list = list.filter((o) => {
        const code = (o.public_code || "").toLowerCase().replace(/^[a-z]+-/, "");
        const name = (o.Name || "").toLowerCase();
        const table = o.table_number != null ? String(o.table_number).toLowerCase() : "";
        return code.includes(normalized) || name.includes(q) || table === q;
      });
    }
    return list;
  }, [orders, filter, search]);

  const togglePaid = async (o: Order) => {
    const next = (o.payment_status || "").toLowerCase() === "paid" ? "unpaid" : "paid";
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, payment_status: next } : x)));
    await supabase.from("orders").update({ payment_status: next }).eq("id", o.id);
  };

  const advanceStatus = async (o: Order) => {
    const next = nextStatus(o.Status);
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, Status: next } : x)));
    await supabase.from("orders").update({ Status: next }).eq("id", o.id);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (checking) return <div className="grid h-screen place-items-center text-slate-400">Loading…</div>;

  const counts = {
    All: orders.length,
    New: orders.filter((o) => (o.Status || "New") === "New").length,
    Preparing: orders.filter((o) => o.Status === "Preparing").length,
    Ready: orders.filter((o) => o.Status === "Ready").length,
    Done: orders.filter((o) => o.Status === "Done").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cashier</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              {connected ? "Live" : "Reconnecting…"}
            </div>
          </div>
          <div className="flex gap-2">
            {(profile?.role === "manager" || profile?.role === "platform_admin") && (
              <Link to="/admin" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Admin
              </Link>
            )}
            <button onClick={logout} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Log out
            </button>
          </div>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order code, name, or table #…"
          className="mb-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", "New", "Preparing", "Ready", "Done"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {s} {counts[s]}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {visible.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No orders in this view.</p>}
        {visible.map((o) => {
          const paid = (o.payment_status || "").toLowerCase() === "paid";
          return (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{o.Name || "Customer"}</h2>
                  <p className="text-xs text-slate-500">
                    {timeAgo(o.created_at)} · {o.public_code || `#${o.id}`}
                    {o.table_number != null && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        Table {o.table_number}
                      </span>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">
                  {o.Status || "New"}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-line text-sm text-slate-600">{o.Order}</p>
              <p className="mb-3 text-xl font-extrabold text-slate-900">₦{Number(o.Amount ?? 0).toLocaleString()}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => togglePaid(o)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${
                    paid ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {paid ? "Paid" : "Pending Payment"}
                </button>
                {o.Status !== "Done" && (
                  <button
                    onClick={() => advanceStatus(o)}
                    className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Mark {nextStatus(o.Status)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
