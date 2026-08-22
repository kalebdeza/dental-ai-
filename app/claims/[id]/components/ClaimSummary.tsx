interface Props {
  claim: any;
}

export default function ClaimSummary({ claim }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">

      <h2 className="mb-6 text-xl font-bold">
        Claim Summary
      </h2>

      <div className="space-y-4">

        <div className="flex justify-between">
          <span className="text-slate-500">Procedure</span>
          <span className="font-medium">{claim.procedure.procedure_name}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Amount</span>
          <span className="font-bold text-green-600">
            ${Number(claim.insurance_estimate).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <span>{claim.status}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Submitted</span>
          <span>{new Date(claim.created_at).toLocaleDateString()}</span>
        </div>

      </div>

    </div>
  );
}