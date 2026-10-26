import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, getStaffProfile, nextStatus, canAccessKitchen, homeRouteForRole, type Order, type StaffProfile } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { AppLoadingSkeleton } from "@/components/AppLoadingSkeleton";

export const Route = createFileRoute("/kitchen")({
  component: KitchenPage,
});

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  return `${mins}m ago`;
}

function KitchenPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(true);
  const [checking, setChecking] = useState(true);
  const knownIds = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getStaffProfile();
      if (!p) {
        navigate({ to: "/" });
        return;
      }
      if (!canAccessKitchen(p.role)) {
        navigate({ to: homeRouteForRole(p.role) });
        return;
      }
      setProfile(p);
      setChecking(false);
    })();
  }, [navigate]);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("Status", ["New", "Preparing", "Ready"])
      .order("created_at", { ascending: true });
    const fresh = (data as Order[]) ?? [];

    // Play a sound only for genuinely new PAID orders arriving after first load
    const newPaidArrivals = fresh.filter(
      (o) => (o.payment_status || "").toLowerCase() === "paid" && !knownIds.current.has(o.id),
    );
    if (knownIds.current.size > 0 && newPaidArrivals.length > 0) {
      audioRef.current?.play().catch(() => {});
    }
    knownIds.current = new Set(fresh.map((o) => o.id));
    setOrders(fresh);
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadOrders();
    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, loadOrders]);

  const advanceStatus = async (o: Order) => {
    const next = nextStatus(o.Status);
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, Status: next } : x)));
    await supabase.from("orders").update({ Status: next }).eq("id", o.id);
  };


  if (checking || !profile) return <AppLoadingSkeleton dark />;

  return (
    <AppShell profile={profile} active="kitchen" title="Kitchen" subtitle={connected ? "Live preparation board · Connected" : "Live preparation board · Reconnecting…"} darkContent>
      {/* Simple beep, no external asset needed */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" />



      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-slate-400">No active orders.</p>
        )}
        {orders.map((o) => {
          const paid = (o.payment_status || "").toLowerCase() === "paid";
          return (
            <div
              key={o.id}
              className={`rounded-2xl border p-4 ${
                paid ? "border-slate-700 bg-slate-800" : "border-slate-800 bg-slate-800/40 opacity-60"
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{o.Name || "Customer"}</h2>
                  <p className="text-xs text-slate-400">
                    {timeAgo(o.created_at)} · {o.public_code || `#${o.id}`}
                    {o.table_number != null && <span className="ml-2">Table {o.table_number}</span>}
                  </p>
                </div>
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-bold uppercase">
                  {o.Status || "New"}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-line text-sm text-slate-300">{o.Order}</p>
              {paid ? (
                o.Status !== "Ready" && o.Status !== "Done" ? (
                  <button
                    onClick={() => advanceStatus(o)}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold hover:bg-blue-700"
                  >
                    Mark {nextStatus(o.Status)}
                  </button>
                ) : (
                  <div className="rounded-xl bg-green-700/30 py-2.5 text-center text-sm font-bold text-green-400">
                    {o.Status}
                  </div>
                )
              ) : (
                <div className="rounded-xl bg-slate-700 py-2.5 text-center text-sm font-bold text-slate-300">
                  Awaiting Payment
                </div>
              )}
            </div>
          );
        })}
      </main>
    </AppShell>
  );
}
