interface ConnectionStatusProps {
  connected: boolean;
}

export default function ConnectionStatus({
  connected,
}: ConnectionStatusProps) {
  if (!connected) return null;

  return (
    <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-8">

      <h2 className="text-2xl font-bold text-green-700">
        ✅ Connection Successful
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">

        <div>
          <p className="text-sm text-slate-500">
            Practice
          </p>

          <p className="font-semibold">
            Smile Dental
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">
            Open Dental Version
          </p>

          <p className="font-semibold">
            Detecting...
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">
            Patients
          </p>

          <p className="font-semibold">
            --
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">
            Providers
          </p>

          <p className="font-semibold">
            --
          </p>
        </div>

      </div>

      <button className="mt-8 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">
        Start Initial Sync
      </button>

    </div>
  );
}