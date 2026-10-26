import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BarChart3, ChefHat, LogOut, Menu, ReceiptText, Users, X } from "lucide-react";
import { canAccessAdmin, canAccessCashier, canAccessKitchen, supabase, type StaffProfile } from "@/lib/supabase";

type Props = {
  profile: StaffProfile;
  active: "admin" | "cashier" | "kitchen" | "staff";
  title: string;
  subtitle: string;
  restaurantName?: string;
  restaurantLogoUrl?: string | null;
  actions?: ReactNode;
  children: ReactNode;
  darkContent?: boolean;
};

export function AppShell({ profile, active, title, subtitle, restaurantName = "Restaurant", restaurantLogoUrl, actions, children, darkContent = false }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  const items = [
    canAccessAdmin(profile.role) && { key: "admin", to: "/admin", label: "Admin", icon: BarChart3, id: undefined },
    canAccessCashier(profile.role) && { key: "cashier", to: "/cashier", label: "Cashier", icon: ReceiptText, id: "tour-cashier" },
    canAccessKitchen(profile.role) && { key: "kitchen", to: "/kitchen", label: "Kitchen", icon: ChefHat, id: "tour-kitchen" },
    (profile.role === "owner" || profile.role === "manager") && { key: "staff", to: "/staff", label: "Staff", icon: Users, id: "tour-staff" },
  ].filter(Boolean) as Array<{ key: string; to: "/admin" | "/cashier" | "/kitchen" | "/staff"; label: string; icon: typeof BarChart3; id?: string }>;

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0F172A] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <img src="/menu-wave-logo.svg" alt="Menu-Wave" className="h-10 w-10 rounded-xl object-contain" />
        <div className="min-w-0"><p className="truncate text-sm font-bold">Menu-Wave</p><p className="text-[11px] text-slate-400">Restaurant operations</p></div>
      </div>
      <nav className="flex-1 space-y-1.5 p-3">
        {items.map(({ key, to, label, icon: Icon, id }) => (
          <Link id={id} key={key} to={to} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active === key ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Log out</button>
        <div className="mt-3 flex items-center gap-2 px-3 text-[10px] text-slate-500"><img src="/menu-wave-logo.svg" alt="" className="h-4 w-4 rounded" />Powered by Menu-Wave</div>
      </div>
    </div>
  );

  return <div className={`min-h-screen ${darkContent ? "bg-slate-900" : "bg-[#F8FAFC]"}`}>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/60" /><aside className="relative h-full w-72 shadow-2xl">{sidebar}<button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></aside></div>}
    <div className="lg:pl-64">
      <header className={`sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 ${darkContent ? "border-slate-700 bg-slate-900/95 text-white" : "border-slate-200 bg-white/95 text-slate-900"} backdrop-blur`}>
        <div className="flex min-w-0 items-center gap-3"><button onClick={() => setOpen(true)} className={`rounded-xl border p-2 lg:hidden ${darkContent ? "border-slate-700" : "border-slate-200"}`}><Menu className="h-5 w-5" /></button><div className="min-w-0"><h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1><p className={`truncate text-xs ${darkContent ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p></div></div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  </div>;
}
