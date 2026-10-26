import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { supabase, getStaffProfile, canAccessAdmin, homeRouteForRole, type MenuItem, type Category, type StaffProfile, formatCurrency, currencySymbol } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowDown, ArrowUp, Eye, Flame, Sparkles } from "lucide-react";
import { GuidedTour } from "@/components/GuidedTour";
import { AppShell } from "@/components/AppShell";
import { AppLoadingSkeleton } from "@/components/AppLoadingSkeleton";

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

  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [restaurantCurrency, setRestaurantCurrency] = useState("NGN");
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState<string | null>(null);
  const [restaurantLogoFile, setRestaurantLogoFile] = useState<File | null>(null);
  const [savingRestaurantLogo, setSavingRestaurantLogo] = useState(false);
  const [restaurantLogoError, setRestaurantLogoError] = useState<string | null>(null);
  const [restaurantLogoSuccess, setRestaurantLogoSuccess] = useState(false);
  const [showManagementTour, setShowManagementTour] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemEmoji, setNewItemEmoji] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPopular, setNewItemPopular] = useState(false);
  const [newItemNew, setNewItemNew] = useState(false);
  const [newItemImage, setNewItemImage] = useState<File | null>(null);
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
      if (!canAccessAdmin(p.role)) {
        navigate({ to: homeRouteForRole(p.role) });
        return;
      }
      setProfile(p);

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("name, logo_url, currency")
        .eq("id", p.restaurant_id)
        .single();

      setRestaurantName(restaurant?.name?.trim() || "Restaurant");
      setRestaurantCurrency(restaurant?.currency || "NGN");
      setRestaurantLogoUrl(restaurant?.logo_url ?? null);

      if (p.role === "owner" || p.role === "manager") {
        const tourKey = `menu-wave-management-tour:${p.id}`;
        if (window.localStorage.getItem(tourKey) !== "completed") {
          setShowManagementTour(true);
        }
      }

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

  const moveCategory = async (category: Category, direction: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);
    const index = sorted.findIndex((c) => c.id === category.id);
    const other = sorted[index + direction];
    if (!other) return;
    const currentOrder = category.display_order;
    const otherOrder = other.display_order;
    setCategories((prev) => prev.map((c) => c.id === category.id ? { ...c, display_order: otherOrder } : c.id === other.id ? { ...c, display_order: currentOrder } : c).sort((a,b)=>a.display_order-b.display_order));
    const [a, b] = await Promise.all([
      supabase.from("categories").update({ display_order: otherOrder }).eq("id", category.id),
      supabase.from("categories").update({ display_order: currentOrder }).eq("id", other.id),
    ]);
    if (a.error || b.error) { setError(a.error?.message || b.error?.message || "Could not reorder categories."); await loadAll(); }
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

    if (newItemImage) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(newItemImage.type))
        return setAddItemError("Food image must be JPEG, PNG or WebP.");
      if (newItemImage.size > 5 * 1024 * 1024)
        return setAddItemError("Food image must be 5 MB or smaller.");
    }

    setAddingItem(true);
    let imageUrl: string | null = null;
    let uploadedPath: string | null = null;

    try {
      if (newItemImage) {
        const extension =
          newItemImage.type === "image/png" ? "png" :
          newItemImage.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${profile!.restaurant_id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(uploadedPath, newItemImage, {
            cacheControl: "3600",
            contentType: newItemImage.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        imageUrl = supabase.storage.from("menu-images").getPublicUrl(uploadedPath).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("menu_items")
        .insert({
          name: trimmedName,
          price: priceNum,
          category: newItemCategory,
          emoji: newItemEmoji.trim() || null,
          description: newItemDescription.trim() || null,
          is_popular: newItemPopular,
          is_new: newItemNew,
          display_order: menuItems.filter((m) => m.category === newItemCategory).length + 1,
          image_url: imageUrl,
          is_available: true,
          restaurant_id: profile!.restaurant_id,
        })
        .select()
        .single();

      if (error) throw error;

      setMenuItems((prev) => [...prev, data as MenuItem]);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemEmoji("");
      setNewItemDescription("");
      setNewItemPopular(false);
      setNewItemNew(false);
      setNewItemImage(null);
      const imageInput = document.getElementById("menu-item-image") as HTMLInputElement | null;
      if (imageInput) imageInput.value = "";
      setAddItemSuccess(true);
      setTimeout(() => setAddItemSuccess(false), 3000);
    } catch (err) {
      if (uploadedPath) await supabase.storage.from("menu-images").remove([uploadedPath]);
      setAddItemError(err instanceof Error ? err.message : "Could not add menu item.");
    } finally {
      setAddingItem(false);
    }
  };

  const menuImagePath = (url: string | null) => {
    if (!url) return null;
    const marker = "/storage/v1/object/public/menu-images/";
    const index = url.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
  };

  const deleteMenuItem = async (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeletingItemId(item.id);
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) {
      setDeletingItemId(null);
      return setError(error.message);
    }

    const imagePath = menuImagePath(item.image_url);
    if (imagePath) {
      const { error: imageError } = await supabase.storage.from("menu-images").remove([imagePath]);
      if (imageError) console.warn("Menu item deleted, but its image could not be removed:", imageError.message);
    }

    setDeletingItemId(null);
    setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
  };

  const toggleAvailable = async (item: MenuItem) => {
    const next = !item.is_available;
    setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, is_available: next } : m)));
    const { error } = await supabase.from("menu_items").update({ is_available: next }).eq("id", item.id);
    if (error) setError(error.message);
  };

  const restaurantLogoPath = (url: string | null) => {
    if (!url) return null;
    const marker = "/storage/v1/object/public/restaurant-logos/";
    const index = url.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
  };

  const updateRestaurantLogo = async (e: FormEvent) => {
    e.preventDefault();
    setRestaurantLogoError(null);
    setRestaurantLogoSuccess(false);

    if (!restaurantLogoFile) {
      setRestaurantLogoError("Choose a restaurant logo first.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(restaurantLogoFile.type)) {
      setRestaurantLogoError("Restaurant logo must be JPEG, PNG or WebP.");
      return;
    }

    if (restaurantLogoFile.size > 2 * 1024 * 1024) {
      setRestaurantLogoError("Restaurant logo must be 2 MB or smaller.");
      return;
    }

    setSavingRestaurantLogo(true);
    let uploadedPath: string | null = null;

    try {
      const extension =
        restaurantLogoFile.type === "image/png" ? "png" :
        restaurantLogoFile.type === "image/webp" ? "webp" : "jpg";

      uploadedPath = `${profile!.restaurant_id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("restaurant-logos")
        .upload(uploadedPath, restaurantLogoFile, {
          cacheControl: "3600",
          contentType: restaurantLogoFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const newLogoUrl = supabase.storage
        .from("restaurant-logos")
        .getPublicUrl(uploadedPath).data.publicUrl;

      const { error: rpcError } = await supabase.rpc("set_restaurant_logo", {
        p_logo_url: newLogoUrl,
      });

      if (rpcError) throw rpcError;

      const oldLogoPath = restaurantLogoPath(restaurantLogoUrl);
      setRestaurantLogoUrl(newLogoUrl);
      setRestaurantLogoFile(null);

      const input = document.getElementById("restaurant-logo") as HTMLInputElement | null;
      if (input) input.value = "";

      if (oldLogoPath && oldLogoPath !== uploadedPath) {
        const { error: removeError } = await supabase.storage
          .from("restaurant-logos")
          .remove([oldLogoPath]);
        if (removeError) console.warn("Logo updated, but the previous logo could not be removed:", removeError.message);
      }

      setRestaurantLogoSuccess(true);
      setTimeout(() => setRestaurantLogoSuccess(false), 3000);
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from("restaurant-logos").remove([uploadedPath]);
      }
      setRestaurantLogoError(err instanceof Error ? err.message : "Could not update restaurant logo.");
    } finally {
      setSavingRestaurantLogo(false);
    }
  };

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      // Keep the export contract explicit: restaurant owners should never receive
      // internal IDs/tenant keys just because a new database column was added.
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, Name, Order, Amount, Status, table_number, public_code, payment_status")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      if (rows.length === 0) {
        setError("No orders to export.");
        return;
      }

      const currencyCode = String(restaurantCurrency || "NGN").toUpperCase();
      const headers = [
        "Order Code",
        "Date",
        "Time",
        "Customer Name",
        "Table",
        "Order Items",
        `Total (${currencyCode})`,
        "Payment Status",
        "Order Status",
      ];

      const escapeCsv = (value: unknown) => {
        const text = value == null ? "" : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      const exportRows = rows.map((row) => {
        const createdAt = new Date(row.created_at);
        const validDate = !Number.isNaN(createdAt.getTime());
        return [
          row.public_code ?? "",
          // Prefix with an invisible zero-width space so spreadsheet apps keep this
          // as display text instead of converting it to a date serial (which can
          // render as ####### when the column is narrow).
          validDate ? `\u200B${createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}` : "",
          validDate ? createdAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }) : "",
          row.Name ?? "",
          row.table_number ?? "",
          row.Order ?? "",
          Number(row.Amount ?? 0).toFixed(2),
          row.payment_status ? String(row.payment_status).replace(/\b\w/g, (c) => c.toUpperCase()) : "",
          row.Status ?? "",
        ].map(escapeCsv).join(",");
      });

      // UTF-8 BOM makes Excel on Windows recognize ×, ₦ and other Unicode
      // characters correctly when the CSV is opened directly.
      const csv = `\uFEFF${[headers.map(escapeCsv).join(","), ...exportRows].join("\r\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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
  }, [restaurantCurrency]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (checking || !profile) return <AppLoadingSkeleton />;

  return (
      <AppShell profile={profile} active="admin" title={restaurantName} subtitle="Admin · Analytics & menu control" restaurantName={restaurantName} restaurantLogoUrl={restaurantLogoUrl} actions={<><button onClick={exportCsv} disabled={exporting} className="hidden rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:inline">{exporting ? "Exporting…" : "Export CSV"}</button>{(profile.role === "owner" || profile.role === "manager") && <button type="button" onClick={() => setShowManagementTour(true)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 sm:px-4 sm:text-sm">Take tour</button>}</>}>

      {error && <div className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      <main className="mx-auto max-w-5xl space-y-5 p-5">
        {(profile?.role === "owner" || profile?.role === "manager") && (
          <section id="tour-restaurant-settings" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">Restaurant Settings</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your logo appears on the customer ordering page and table QR codes.
              </p>
            </div>

            <form onSubmit={updateRestaurantLogo} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {restaurantLogoFile ? (
                  <img
                    src={URL.createObjectURL(restaurantLogoFile)}
                    alt="New restaurant logo preview"
                    className="h-full w-full object-contain p-2"
                  />
                ) : restaurantLogoUrl ? (
                  <img
                    src={restaurantLogoUrl}
                    alt="Current restaurant logo"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="px-2 text-center text-xs font-semibold text-slate-400">No logo yet</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <label htmlFor="restaurant-logo" className="mb-1 block text-sm font-semibold text-slate-700">
                  Restaurant logo
                </label>
                <input
                  id="restaurant-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setRestaurantLogoFile(e.target.files?.[0] ?? null);
                    setRestaurantLogoError(null);
                    setRestaurantLogoSuccess(false);
                  }}
                  className="block w-full text-sm text-slate-600"
                />
                <p className="mt-1 text-xs text-slate-400">JPEG, PNG or WebP · max 2 MB</p>

                <button
                  type="submit"
                  disabled={savingRestaurantLogo || !restaurantLogoFile}
                  className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingRestaurantLogo ? "Updating…" : restaurantLogoUrl ? "Update logo" : "Upload logo"}
                </button>
              </div>
            </form>

            {restaurantLogoError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{restaurantLogoError}</p>
            )}
            {restaurantLogoSuccess && (
              <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Restaurant logo updated successfully.</p>
            )}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Today", today], ["This Week", week], ["This Month", month], ["All Time", all]].map(([label, s]: any) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">{formatCurrency(Number(s?.revenue ?? 0), restaurantCurrency, 0)}</p>
              <p className="text-xs text-slate-500">{s?.order_count ?? 0} orders · avg {formatCurrency(Math.round(Number(s?.avg_order_value ?? 0)), restaurantCurrency, 0)}</p>
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
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${currencySymbol(restaurantCurrency)}${(v / 1000).toFixed(0)}k` : formatCurrency(v, restaurantCurrency, 0)} />
                <Tooltip formatter={(v: number) => [formatCurrency(v, restaurantCurrency, 0), "revenue"]} />
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
              <div key={t.item_name} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
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
              <div key={s.status} className="rounded-xl bg-[#F8FAFC] p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-900">{s.order_count}</p>
                <p className="text-xs uppercase text-slate-500">{s.status}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tour-menu-management" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Categories <span className="text-slate-400">({categories.length})</span></h2>
          <form onSubmit={addCategory} className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={addingCategory} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
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
                  <div className="flex items-center gap-1"><button onClick={() => moveCategory(c, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" title="Move up"><ArrowUp className="h-4 w-4" /></button><button onClick={() => moveCategory(c, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" title="Move down"><ArrowDown className="h-4 w-4" /></button><button onClick={() => deleteCategory(c)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button></div>
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
            <input type="number" step="0.01" min="0" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder={`Price (${currencySymbol(restaurantCurrency)})`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} disabled={categories.length === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100">
              {categories.length === 0 ? <option value="">Add a category first</option> : categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input type="text" value={newItemEmoji} onChange={(e) => setNewItemEmoji(e.target.value)} placeholder="Emoji (optional)" maxLength={4} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder="Short appetizing description (optional)" maxLength={180} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-4" />
            <label className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 sm:col-span-2"><input type="checkbox" checked={newItemPopular} onChange={(e)=>setNewItemPopular(e.target.checked)} /> 🔥 Mark as popular</label>
            <label className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 sm:col-span-2"><input type="checkbox" checked={newItemNew} onChange={(e)=>setNewItemNew(e.target.checked)} /> ✨ Mark as new</label>
            <label className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">Food photo (optional)</span>
              <input
                id="menu-item-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setNewItemImage(e.target.files?.[0] ?? null)}
                className="block w-full text-xs"
              />
              <span className="mt-1 block text-xs text-slate-400">JPEG, PNG or WebP · max 5 MB</span>
            </label>
            {newItemImage && (
              <div className="flex items-center gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2 sm:col-span-2">
                <img src={URL.createObjectURL(newItemImage)} alt="Food preview" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{newItemImage.name}</p>
                  <p className="text-xs text-slate-500">{(newItemImage.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            )}
            <button type="submit" disabled={addingItem || categories.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-4">
              {addingItem ? "Uploading & adding…" : "Add Item"}
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
                  <div className="flex min-w-0 items-center gap-3">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.name ?? "Menu item"} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">{m.emoji || "🍽️"}</div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.category} · {formatCurrency(Number(m.price ?? 0), restaurantCurrency)}</div>{m.description && <p className="mt-1 line-clamp-1 text-xs text-slate-400">{m.description}</p>}<div className="mt-1 flex gap-1">{m.is_popular && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">🔥 Popular</span>}{m.is_new && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">✨ New</span>}</div>
                    </div>
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


      {profile && (profile.role === "owner" || profile.role === "manager") && (
        <GuidedTour
          open={showManagementTour}
          storageKey={`menu-wave-management-tour:${profile.id}`}
          onClose={() => setShowManagementTour(false)}
        />
      )}
      </AppShell>
  );
}
