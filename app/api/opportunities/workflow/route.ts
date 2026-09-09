import { NextRequest } from "next/server";

import { ApiResponse } from "@/lib/api/response";
import { ApiErrorHandler } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { requirePractice } from "@/lib/auth/requirePractice";
import {
  OpportunityWorkflowError,
  applyOfficeWorkflowMutation,
  getOpportunity,
  getOpportunityActivities,
} from "@/lib/data/opportunityWorkflow";
import { parseOfficeWorkflowRequest } from "@/lib/data/opportunityWorkflowRequest";

function workflowErrorResponse(error: OpportunityWorkflowError) {
  if (error.code === "unauthenticated") {
    return ApiResponse.unauthorized();
  }

  if (error.code === "forbidden" || error.code === "not_found") {
    return ApiResponse.notFound(error.message);
  }

  return ApiResponse.badRequest(error.message);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return ApiResponse.badRequest("Workflow request is required.");
    }

    const parsed = parseOfficeWorkflowRequest(body);

    if (!parsed) {
      return ApiResponse.badRequest("Workflow request is invalid.");
    }

    const result = await applyOfficeWorkflowMutation(
      supabase,
      practice.id,
      parsed
    );
    const activities = await getOpportunityActivities(supabase, {
      practiceId: practice.id,
      opportunityId: parsed.opportunityId,
    });

    return ApiResponse.ok({
      opportunity: result.opportunity,
      activity: result.activity,
      activities,
    });
  } catch (error) {
    if (error instanceof OpportunityWorkflowError) {
      return workflowErrorResponse(error);
    }

    logger.error("Opportunity workflow mutation failed", error);
    return ApiErrorHandler.handle(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePractice();

    if (!auth.success) {
      return auth.response;
    }

    const { supabase, practice } = auth;
    const opportunityId = req.nextUrl.searchParams.get("id")?.trim();

    if (!opportunityId) {
      return ApiResponse.badRequest("Opportunity id is required.");
    }

    const opportunity = await getOpportunity(supabase, {
      practiceId: practice.id,
      opportunityId,
    });

    if (!opportunity) {
      return ApiResponse.notFound("Opportunity not found.");
    }

    const activities = await getOpportunityActivities(supabase, {
      practiceId: practice.id,
      opportunityId,
    });

    return ApiResponse.ok({ opportunity, activities });
  } catch (error) {
    if (error instanceof OpportunityWorkflowError) {
      return workflowErrorResponse(error);
    }

    logger.error("Opportunity workflow read failed", error);
    return ApiErrorHandler.handle(error);
  }
}
