"use client";

export type PMSProvider =
  | "opendental"
  | "practiceweb"
  | "dentrix"
  | "eaglesoft"
  | "curve";

interface PMSSelectorProps {
  selected: PMSProvider;
  onSelect: (provider: PMSProvider) => void;
}

const providers = [
  {
    id: "opendental",
    name: "Open Dental",
    status: "Available",
    enabled: true,
  },
  {
    id: "practiceweb",
    name: "Practice-Web",
    status: "Coming Soon",
    enabled: false,
  },
  {
    id: "dentrix",
    name: "Dentrix",
    status: "Coming Soon",
    enabled: false,
  },
  {
    id: "eaglesoft",
    name: "Eaglesoft",
    status: "Coming Soon",
    enabled: false,
  },
  {
    id: "curve",
    name: "Curve Hero",
    status: "Coming Soon",
    enabled: false,
  },
] as const;

export default function PMSSelector({
  selected,
  onSelect,
}: PMSSelectorProps) {
  return (
    <div className="space-y-4">

      <h2 className="text-xl font-semibold">
        Choose Your Practice Management Software
      </h2>

      <div className="grid gap-4 md:grid-cols-2">

        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={!provider.enabled}
            onClick={() =>
              provider.enabled &&
              onSelect(provider.id as PMSProvider)
            }
            className={`rounded-2xl border p-5 text-left transition-all ${
              selected === provider.id
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 bg-white"
            } ${
              !provider.enabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-blue-400 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">

              <div>
                <h3 className="text-lg font-semibold">
                  {provider.name}
                </h3>

                <p className="text-sm text-slate-500">
                  {provider.status}
                </p>
              </div>

              {selected === provider.id && (
                <div className="text-2xl">
                  ✅
                </div>
              )}

            </div>
          </button>
        ))}

      </div>

    </div>
  );
}