import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { supabase, getStaffProfile, type MenuItem, type Category, type StaffProfile } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type StatsRow = { order_count: number; revenue: number; avg_order_value: number };

function AdminPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [checking, setChecking] = useState(true);

  const [today, setToday] = useState<StatsRow | null>(null);
  const [week, setWeek] = useState<StatsRow | null>(null);
  const [month, setMonth] = useState<StatsRow | null>(null);
  const [all, setAll] = useState<StatsRow | null>(null);
  const [revByDay, setRevByDay] = useState<any[]>([]);
  const [byHour, setByHour] = useState<any[]>([]);
  const [byStatus, setByStatus] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemEmoji, setNewItemEmoji] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [addItemSuccess, setAddItemSuccess] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getStaffProfile();
      if (!p) {
        navigate({ to: "/" });
        return;
      }
      if (p.role !== "manager" && p.role !== "platform_admin") {
        navigate({ to: "/cashier" });
        return;
      }
      setProfile(p);
      setChecking(false);
    })();
  }, [navigate]);

  const loadAll = useCallback(async () => {
    const results = await Promise.all([
      supabase.from("v_stats_today").select("*").single(),
      supabase.from("v_stats_this_week").select("*").single(),
      supabase.from("v_stats_this_month").select("*").single(),
      supabase.from("v_stats_all_time").select("*").single(),
      supabase.from("v_revenue_by_day").select("*"),
      supabase.from("v_orders_by_hour").select("*"),
      supabase.from("v_orders_by_status").select("*"),
      supabase.from("v_top_items_best_effort").select("*").limit(5),
      supabase.from("menu_items").select("*").order("id"),
      supabase.from("categories").select("*").order("display_order"),
    ]);
    setToday((results[0].data as StatsRow) ?? null);
    setWeek((results[1].data as StatsRow) ?? null);
    setMonth((results[2].data as StatsRow) ?? null);
    setAll((results[3].data as StatsRow) ?? null);
    setRevByDay((results[4].data as any[]) ?? []);
    setByHour((results[5].data as any[]) ?? []);
    setByStatus((results[6].data as any[]) ?? []);
    setTopItems((results[7].data as any[]) ?? []);
    setMenuItems((results[8].data as MenuItem[]) ?? []);
    setCategories((results[9].data as Category[]) ?? []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadAll();
    const interval = setInterval(loadAll, 45000);
    return () => clearInterval(interval);
  }, [profile, loadAll]);

  useEffect(() => {
    if (!newItemCategory && categories.length > 0) setNewItemCategory(categories[0].name);
  }, [categories, newItemCategory]);

  const formatHour12 = (h: number) => {
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${period}`;
  };
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const row = byHour.find((r) => Number(r.hour_of_day) === h);
    return { hour: formatHour12(h), orders: Number(row?.order_count ?? 0) };
  });
  const dayData = revByDay
    .slice()
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .map((r) => ({
      day: new Date(String(r.day)).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: Number(r.revenue ?? 0),
    }));

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    const trimmed = newCategoryName.trim();
    if (!trimmed) return setCategoryError("Category name is required.");
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase()))
      return setCategoryError("A category with this name already exists.");
    setAddingCategory(true);
    const nextOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.display_order)) + 1 : 1;
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: trimmed, display_order: nextOrder, restaurant_id: profile!.restaurant_id })
      .select()
      .single();
    setAddingCategory(false);
    if (error) return setCategoryError(error.message);
    setCategories((prev) => [...prev, data as Category]);
    setNewCategoryName("");
  };

  const deleteCategory = async (category: Category) => {
    const itemsIn = menuItems.filter((m) => m.category === category.name).length;
    const warning =
      itemsIn > 0
        ? `Delete "${category.name}"? This will also permanently delete ${itemsIn} menu item(s). This cannot be undone.`
        : `Delete "${category.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    const { error } = await supabase.rpc("delete_category_cascade", {
      target_restaurant_id: profile!.restaurant_id,
      target_category: category.name,
    });
    if (error) return setError(error.message);
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    setMenuItems((prev) => prev.filter((m) => m.category !== category.name));
  };

  const addMenuItem = async (e: FormEvent) => {
    e.preventDefault();
    setAddItemError(null);
    setAddItemSuccess(false);
    const trimmedName = newItemName.trim();
    const priceNum = parseFloat(newItemPrice);
    if (!trimmedName) return setAddItemError("Name is required.");
    if (!newItemPrice || isNaN(priceNum) || priceNum <= 0) return setAddItemError("Price must be greater than 0.");
    if (!newItemCategory) return setAddItemError("Please add and select a category first.");
    setAddingItem(true);
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        name: trimmedName,
        price: priceNum,
        category: newItemCategory,
        emoji: newItemEmoji.trim() || null,
        is_available: true,
        restaurant_id: profile!.restaurant_id,
      })
      .select()
      .single();
    setAddingItem(false);
    if (error) return setAddItemError(error.message);
    setMenuItems((prev) => [...prev, data as MenuItem]);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemEmoji("");
    setAddItemSuccess(true);
    setTimeout(() => setAddItemSuccess(false), 3000);
  };

  const deleteMenuItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeletingItemId(item.id);
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    setDeletingItemId(null);
    if (error) return setError(error.message);
    setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
  };

  const toggleAvailable = async (item: MenuItem) => {
    const next = !item.is_available;
    setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, is_available: next } : m)));
    const { error } = await supabase.from("menu_items").update({ is_available: next }).eq("id", item.id);
    if (error) setError(error.message);
  };

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return setError("No orders to export.");
      const headers = Object.keys(rows[0]);
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [headers.join(","), ...rows.map((r: any) => headers.map((h) => esc(r[h])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (checking) return <div className="grid h-screen place-items-center text-slate-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin</h1>
          <p className="text-xs text-slate-500">Analytics & menu control</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="hidden text-xs text-slate-400 sm:inline">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={exportCsv} disabled={exporting} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link to="/cashier" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Cashier</Link>
          <Link to="/kitchen" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Kitchen</Link>
          <button onClick={logout} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Log out</button>
        </div>
      </header>

      {error && <div className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      <main className="mx-auto max-w-5xl space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Today", today], ["This Week", week], ["This Month", month], ["All Time", all]].map(([label, s]: any) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">₦{Number(s?.revenue ?? 0).toLocaleString()}</p>
              <p className="text-xs text-slate-500">{s?.order_count ?? 0} orders · avg ₦{Math.round(Number(s?.avg_order_value ?? 0)).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Revenue — last 30 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`)} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "revenue"]} />
                <Bar dataKey="revenue" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Orders by hour</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Top 5 items</h2>
          <div className="space-y-2">
            {topItems.map((t, i) => (
              <div key={t.item_name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="font-semibold text-slate-800">{t.item_name}</span>
                </div>
                <span className="text-sm text-slate-500">{t.times_ordered}x</span>
              </div>
            ))}
            {topItems.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Current orders by status</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {byStatus.map((s) => (
              <div key={s.status} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-900">{s.order_count}</p>
                <p className="text-xs uppercase text-slate-500">{s.status}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Categories <span className="text-slate-400">({categories.length})</span></h2>
          <form onSubmit={addCategory} className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={addingCategory} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {addingCategory ? "Adding…" : "Add Category"}
            </button>
          </form>
          {categoryError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{categoryError}</p>}
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => {
              const itemCount = menuItems.filter((m) => m.category === c.name).length;
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
                  </div>
                  <button onClick={() => deleteCategory(c)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
                </li>
              );
            })}
            {categories.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No categories yet — add one above to get started.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Add new menu item</h2>
          <form onSubmit={addMenuItem} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
            <input type="number" step="0.01" min="0" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Price (₦)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} disabled={categories.length === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100">
              {categories.length === 0 ? <option value="">Add a category first</option> : categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input type="text" value={newItemEmoji} onChange={(e) => setNewItemEmoji(e.target.value)} placeholder="Emoji (optional)" maxLength={4} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={addingItem} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-3">
              {addingItem ? "Adding…" : "Add Item"}
            </button>
          </form>
          {addItemError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{addItemError}</p>}
          {addItemSuccess && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Item added successfully.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Menu items <span className="text-slate-400">({menuItems.length})</span></h2>
            <span className="text-xs text-slate-500">Toggle availability for customer ordering</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {menuItems.map((m) => {
              const available = !!m.is_available;
              return (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-800">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.category} · ₦{Number(m.price ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleAvailable(m)} className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${available ? "bg-green-600" : "bg-slate-300"}`}>
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${available ? "translate-x-7" : "translate-x-1"}`} />
                    </button>
                    <button onClick={() => deleteMenuItem(m)} disabled={deletingItemId === m.id} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {deletingItemId === m.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
