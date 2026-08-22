import { Bell, Search } from "lucide-react";

export default function PageHeader() {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Patient Workspace
        </p>

        <h1 className="text-2xl font-bold">
          Patient Intelligence
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-xl border p-3 hover:bg-slate-50">
          <Search className="h-5 w-5" />
        </button>

        <button className="rounded-xl border p-3 hover:bg-slate-50">
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
          K
        </div>
      </div>
    </div>
  );
}