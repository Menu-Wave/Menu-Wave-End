export function AppLoadingSkeleton({ dark = false }: { dark?: boolean }) {
  const base = dark ? "bg-slate-800" : "bg-slate-200";
  return <div className={`min-h-screen ${dark ? "bg-slate-900" : "bg-[#F8FAFC]"}`}>
    <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#0F172A] p-5 lg:block"><div className="flex gap-3"><div className="h-10 w-10 animate-pulse rounded-xl bg-slate-700"/><div className="space-y-2 pt-1"><div className="h-3 w-28 animate-pulse rounded bg-slate-700"/><div className="h-2 w-20 animate-pulse rounded bg-slate-800"/></div></div><div className="mt-10 space-y-3">{[1,2,3,4].map(x=><div key={x} className="h-11 animate-pulse rounded-xl bg-slate-800"/>)}</div></aside>
    <div className="lg:pl-64"><div className={`flex h-[76px] items-center gap-3 border-b px-5 ${dark ? "border-slate-700" : "border-slate-200 bg-white"}`}><div className={`h-5 w-40 animate-pulse rounded ${base}`}/></div><main className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(x=><div key={x} className={`h-40 animate-pulse rounded-2xl ${base}`}/>)}</main></div>
  </div>;
}
