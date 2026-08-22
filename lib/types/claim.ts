export interface Claim {
  id: string;

  patient_id: string;

  procedure_id: string;

  claim_number: string;

  status: string;

  insurance_estimate: number;

  insurance_paid: number;

  created_at: string;
}

export interface ClaimWithDetails extends Claim {
  patient: {
    id: string;

    first_name: string;

    last_name: string;

    patient_number: string;
  };

  procedure: {
    id: string;

    procedure_name: string;

    procedure_code: string;

    fee: number;
  };
}