import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wxlhhisfexcltjpvcljo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6bs0IPax7ctABcDJrcWW5w_3PHfgfvk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "menu-wave-staff-auth",
  },
});

export type OrderStatus = "New" | "Preparing" | "Ready" | "Done";
export const STATUSES: OrderStatus[] = ["New", "Preparing", "Ready", "Done"];

export const nextStatus = (s: string | null | undefined): OrderStatus => {
  const i = STATUSES.indexOf((s as OrderStatus) ?? "New");
  if (i < 0) return "Preparing";
  return STATUSES[Math.min(i + 1, STATUSES.length - 1)];
};

// Note: RLS scopes every query below to the logged-in staff member's own
// restaurant automatically (via the `staff` table + policies already built
// and tested). Frontend code never needs to manually filter by restaurant_id.

export interface Order {
  id: number;
  restaurant_id: number;
  created_at: string;
  Name: string | null;
  Order: string | null;
  Amount: number | null;
  Status: OrderStatus | string | null;
  payment_status: string | null;
  table_number: string | number | null;
  public_code: string | null;
}

export interface PendingOrder {
  id: number;
  restaurant_id: number;
  created_at: string;
  customer_name: string | null;
  order_summary: string | null;
  amount: number | null;
  status: string | null;
  table_number: string | number | null;
  public_code: string | null;
  payment_status: string | null;
  minutes_waiting: number | null;
}

export interface MenuItem {
  id: number;
  restaurant_id: number;
  name: string | null;
  price: number | null;
  category: string | null;
  emoji: string | null;
  image_url: string | null;
  is_available: boolean | null;
}

export interface Category {
  id: number;
  restaurant_id: number;
  name: string;
  display_order: number;
}

export interface StaffProfile {
  id: string;
  restaurant_id: number;
  role: "staff" | "manager" | "platform_admin";
}

// Resolves the logged-in user's staff row (restaurant_id + role).
// Every route uses this to decide what to show and to gate access.
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("staff")
    .select("id, restaurant_id, role")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return data as StaffProfile;
}
