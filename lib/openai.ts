import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DashboardAIData {
  totalRecoverableRevenue: number;
  outstandingClaims: number;
  outstandingClaimRevenue: number;
  treatmentPlans: number;
  treatmentRevenue: number;
  overdueRecallPatients: number;
  recallRevenue: number;
}

export async function generateAIInsights(
  data: DashboardAIData
): Promise<string> {
  const prompt = `
You are an elite dental practice consultant.

Analyze the following practice metrics.

Recoverable Revenue:
$${data.totalRecoverableRevenue}

Outstanding Claims:
${data.outstandingClaims}

Outstanding Claim Revenue:
$${data.outstandingClaimRevenue}

Treatment Opportunities:
${data.treatmentPlans}

Treatment Revenue:
$${data.treatmentRevenue}

Recall Patients:
${data.overdueRecallPatients}

Recall Revenue:
$${data.recallRevenue}

Provide:

• Overall assessment
• Biggest opportunity
• Immediate actions
• Revenue recommendation

Keep the response under 200 words.
`;

  const response = await client.responses.create({
    model: "gpt-5.5",
    input: prompt,
  });

  return response.output_text;
}

export async function generatePracticeResponse(
  practiceContext: string,
  userQuestion: string
): Promise<string> {
  const systemPrompt = `
You are Dental Revenue AI.

You are the AI practice manager for a dental office.

Your goals are to maximize:

• Production
• Collections
• Scheduling
• Patient retention
• Practice efficiency

Rules:

- ONLY use the supplied practice data.
- Never invent patients.
- Never invent revenue.
- Never invent claims.
- If information is unavailable, say so.
- Give concise, actionable recommendations.
- Prioritize the highest revenue opportunities.
- Speak like an experienced dental practice consultant.
`;


  const response = await client.responses.create({
    model: "gpt-5.5",
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `
Practice Data

${practiceContext}

User Question

${userQuestion}
`,
      },
    ],
  });

  return response.output_text;
}

export async function generateClaimNarrative(
  patientName: string,
  procedureName: string,
  procedureCode: string,
  insuranceEstimate: number
): Promise<string> {
  const response = await client.responses.create({
    model: "gpt-5.5",
    input: [
      {
        role: "system",
        content: `
You are an expert dental insurance consultant.

Write a professional insurance narrative that helps justify
medical necessity for reimbursement.

Keep it concise and professional.
        `,
      },
      {
        role: "user",
        content: `
Patient:
${patientName}

Procedure:
${procedureName}

Procedure Code:
${procedureCode}

Insurance Estimate:
$${insuranceEstimate}
        `,
      },
    ],
  });

  return response.output_text;
}