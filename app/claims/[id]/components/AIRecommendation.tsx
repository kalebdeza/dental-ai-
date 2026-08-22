import { Brain } from "lucide-react";

export default function AIRecommendation() {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">

      <div className="mb-5 flex items-center gap-3">

        <Brain className="h-6 w-6 text-blue-600" />

        <h2 className="text-xl font-bold">
          AI Recommendation
        </h2>

      </div>

      <p className="text-slate-600">
        This claim appears recoverable.
      </p>

      <ul className="mt-5 space-y-2 text-slate-700">

        <li>✓ Attach missing X-rays</li>

        <li>✓ Include narrative</li>

        <li>✓ Appeal within 14 days</li>

      </ul>

      <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700">
        Generate Appeal
      </button>

    </div>
  );
}