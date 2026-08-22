export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-8">
      <div>
        <h2 className="text-xl font-bold">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-300" />

        <div>
          <div className="font-semibold">
            Kaleb
          </div>

          <div className="text-sm text-slate-500">
            Administrator
          </div>
        </div>
      </div>
    </header>
  );
}