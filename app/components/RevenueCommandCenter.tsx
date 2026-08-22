interface RevenueCommandCenterProps {
  recoverableRevenue: number;
  treatmentCount: number;
  recallCount: number;
  claimCount: number;
  highPriorityCount: number;
}

export default function RevenueCommandCenter({
  recoverableRevenue,
  treatmentCount,
  recallCount,
  claimCount,
  highPriorityCount,
}: RevenueCommandCenterProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold mb-6">
        Revenue Command Center
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        <div className="rounded-lg bg-green-50 p-4">
          <p className="text-sm text-gray-500">
            Recoverable Revenue
          </p>

          <p className="text-3xl font-bold text-green-700">
            ${recoverableRevenue.toLocaleString()}
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-gray-500">
            Treatment Plans
          </p>

          <p className="text-3xl font-bold text-blue-700">
            {treatmentCount}
          </p>
        </div>

        <div className="rounded-lg bg-orange-50 p-4">
          <p className="text-sm text-gray-500">
            Overdue Recalls
          </p>

          <p className="text-3xl font-bold text-orange-700">
            {recallCount}
          </p>
        </div>

        <div className="rounded-lg bg-purple-50 p-4">
          <p className="text-sm text-gray-500">
            Claims
          </p>

          <p className="text-3xl font-bold text-purple-700">
            {claimCount}
          </p>
        </div>

        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-gray-500">
            High Priority
          </p>

          <p className="text-3xl font-bold text-red-700">
            {highPriorityCount}
          </p>
        </div>

      </div>
    </div>
  );
}