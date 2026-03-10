import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent';
import { buildDraft, evaluateDraftReadiness } from '../../core/src/draft';
import { buildReviewQueue, summarizeReviewQueue } from '../../core/src/review';
import type { ConsentRecord, ReviewItem } from '../../core/src/types';
import type {
  ComputeDraftInput,
  ConnectSourceInput,
  MCPResponseEnvelope,
  PrepareHomeTaxInput,
  ResolveReviewItemInput,
  RunClassificationInput,
  StartHomeTaxAssistInput,
} from './contracts';

export function taxSourcesConnect(
  input: ConnectSourceInput,
  consentRecords: ConsentRecord[],
): MCPResponseEnvelope<{
  sourceId: string;
  connectionState: string;
  consentRequired: boolean;
  authRequired: boolean;
  nextStep?: string;
}> {
  const requirement: ConsentRequirement = {
    consentType: 'source_access',
    sourceType: input.sourceType,
    requiredActions: input.requestedScope,
  };

  const evaluation = evaluateConsent(consentRecords, requirement);
  if (!evaluation.allowed) {
    return {
      ok: false,
      data: {
        sourceId: `pending_${input.sourceType}`,
        connectionState: 'awaiting_consent',
        consentRequired: true,
        authRequired: false,
        nextStep: buildConsentPrompt(requirement),
      },
      requiresConsent: true,
      blockingReason: 'missing_consent',
      warnings: [
        {
          code: evaluation.reason ?? 'missing_consent',
          message: buildConsentPrompt(requirement),
          severity: 'high',
        },
      ],
    };
  }

  return {
    ok: true,
    data: {
      sourceId: `source_${input.sourceType}_${input.workspaceId}`,
      connectionState: 'connected',
      consentRequired: false,
      authRequired: input.sourceType === 'hometax',
      nextStep: input.sourceType === 'hometax' ? 'Proceed to authentication checkpoint' : 'Ready to sync',
    },
    requiresAuth: input.sourceType === 'hometax',
    nextRecommendedAction: input.sourceType === 'hometax' ? 'tax.browser.start_hometax_assist' : 'tax.sources.sync',
    audit: {
      eventType: 'source_connected',
      eventId: `evt_connect_${input.workspaceId}_${input.sourceType}`,
    },
  };
}

export function taxClassifyRun(input: RunClassificationInput): MCPResponseEnvelope<{
  classifiedCount: number;
  lowConfidenceCount: number;
  generatedReviewItemCount: number;
  summaryByCategory: Record<string, number>;
}> {
  void input;
  return {
    ok: true,
    data: {
      classifiedCount: 0,
      lowConfidenceCount: 0,
      generatedReviewItemCount: 0,
      summaryByCategory: {},
    },
    warnings: [
      {
        code: 'stub_not_connected',
        message: 'Classification engine is not connected yet; returning skeleton response.',
        severity: 'medium',
      },
    ],
    audit: {
      eventType: 'classification_run',
      eventId: `evt_classify_${Date.now()}`,
    },
  };
}

export function taxClassifyListReviewItems(workspaceId: string, items: ReviewItem[]): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof summarizeReviewQueue> }> {
  return {
    ok: true,
    data: {
      items: items.filter((item) => item.workspaceId === workspaceId),
      summary: summarizeReviewQueue(items.filter((item) => item.workspaceId === workspaceId)),
    },
  };
}

export function taxClassifyResolveReviewItem(input: ResolveReviewItemInput, items: ReviewItem[]): MCPResponseEnvelope<{ resolvedCount: number; affectedDraftIds?: string[] }> {
  const targetIds = new Set(input.reviewItemIds);
  const resolvedCount = items.filter((item) => targetIds.has(item.reviewItemId)).length;

  return {
    ok: true,
    data: {
      resolvedCount,
      affectedDraftIds: [],
    },
    audit: {
      eventType: 'review_resolved',
      eventId: `evt_review_${Date.now()}`,
    },
  };
}

export function taxFilingComputeDraft(
  input: ComputeDraftInput,
  reviewItems: ReviewItem[],
): MCPResponseEnvelope<{
  draftId: string;
  unresolvedBlockerCount: number;
  warnings: string[];
  incomeSummary: Record<string, unknown>;
  expenseSummary: Record<string, unknown>;
  deductionsSummary: Record<string, unknown>;
  withholdingSummary: Record<string, unknown>;
}> {
  const readiness = evaluateDraftReadiness(reviewItems);
  const draft = buildDraft({
    workspaceId: input.workspaceId,
    filingYear: new Date().getFullYear(),
    draftVersion: input.draftMode === 'new_version' ? 2 : 1,
    assumptions: input.includeAssumptions ? ['Initial draft assumptions placeholder'] : [],
    warnings: readiness.blockerReasons,
  });

  return {
    ok: true,
    data: {
      draftId: draft.draftId,
      unresolvedBlockerCount: readiness.blockerReasons.length,
      warnings: draft.warnings,
      incomeSummary: draft.incomeSummary,
      expenseSummary: draft.expenseSummary,
      deductionsSummary: draft.deductionsSummary,
      withholdingSummary: draft.withholdingSummary,
    },
    blockingReason: readiness.readyForSubmission ? undefined : 'unresolved_high_risk_review',
    audit: {
      eventType: 'draft_computed',
      eventId: `evt_draft_${Date.now()}`,
    },
  };
}

export function taxFilingPrepareHomeTax(input: PrepareHomeTaxInput, reviewItems: ReviewItem[]): MCPResponseEnvelope<{
  sectionMapping: Record<string, unknown>;
  requiredManualFields: string[];
  blockedFields: string[];
  browserAssistReady: boolean;
}> {
  const readiness = evaluateDraftReadiness(reviewItems);
  return {
    ok: readiness.readyForSubmission,
    data: {
      sectionMapping: {
        income: 'mapped_placeholder',
        expenses: 'mapped_placeholder',
      },
      requiredManualFields: [],
      blockedFields: readiness.blockerReasons,
      browserAssistReady: readiness.readyForSubmission,
    },
    blockingReason: readiness.readyForSubmission ? undefined : 'unresolved_high_risk_review',
    nextRecommendedAction: readiness.readyForSubmission ? 'tax.browser.start_hometax_assist' : 'tax.classify.list_review_items',
    audit: {
      eventType: 'draft_computed',
      eventId: `evt_prepare_${input.draftId}`,
    },
  };
}

export function taxBrowserStartHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<{
  assistSessionId: string;
  checkpoint: string;
  authRequired: boolean;
}> {
  return {
    ok: true,
    data: {
      assistSessionId: `assist_${input.workspaceId}_${input.draftId}`,
      checkpoint: 'auth_checkpoint',
      authRequired: true,
    },
    requiresAuth: true,
    nextRecommendedAction: 'Complete HomeTax authentication and resume assist flow',
    audit: {
      eventType: 'browser_assist_started',
      eventId: `evt_browser_${Date.now()}`,
    },
  };
}

export function demoBuildReviewQueue() {
  return buildReviewQueue({
    workspaceId: 'demo_workspace',
    transactions: [],
    decisions: [],
  });
}
