import type { AuthCheckpoint, BlockingReason, BrowserAssistSession, FilingWorkspace, ReviewItem, TaxpayerFact } from '../../../core/src/types.js';
import type { ComputeDraftData, FilingWindowAwareness, ListAdjacentTaxObligationsData, CompareWithHomeTaxData, PrepareHomeTaxData, RuntimeSnapshot } from '../contracts.js';

function getRuntimeComparisonState(workspace?: FilingWorkspace) { return workspace?.comparisonSummaryState; }
function getRuntimeSubmissionReadiness(workspace?: FilingWorkspace) { return workspace?.submissionReadiness; }
function dedupeBlockingReasons(values: Array<string | undefined>) { return values.filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index); }
function getPrimaryBlockingReason(workspace?: FilingWorkspace) { return workspace?.lastBlockingReason; }
function isBlockingReason(value: string): value is BlockingReason { return ['missing_consent','missing_auth','missing_material_coverage','awaiting_review_decision','comparison_incomplete','official_data_refresh_required','unsupported_filing_path','missing_withholding_record','missing_deduction_fact','conflicting_withholding_record','unresolved_duplicate','severe_mismatch','unsupported_adjustment','tier_c_stop','draft_not_ready','submission_not_ready','unsupported_hometax_state'].includes(value); }

export function deriveAdjacentTaxObligations(facts: TaxpayerFact[]): ListAdjacentTaxObligationsData['items'] {
  const factText = JSON.stringify(facts.map((fact) => ({ factKey: fact.factKey, value: fact.value, status: fact.status }))).toLowerCase();
  const hasForeignStock = facts.some((fact) => fact.factKey === 'foreign_income') || factText.includes('foreign_stock') || factText.includes('overseas_stock') || factText.includes('foreign stock') || factText.includes('해외주식');
  const hasDomesticLargeShareholder = facts.some((fact) => fact.factKey === 'special_tax_treatment_choice' && JSON.stringify(fact.value ?? '').toLowerCase().includes('large_shareholder')) || factText.includes('domestic_stock_large_shareholder') || factText.includes('large_shareholder') || factText.includes('대주주');
  const items: ListAdjacentTaxObligationsData['items'] = [];
  if (hasForeignStock) { items.push({ obligationCode: 'foreign_stock_capital_gains', taxType: 'capital_gains', triggerFacts: facts.filter((fact) => JSON.stringify(fact.value ?? '').toLowerCase().includes('foreign') || JSON.stringify(fact.value ?? '').includes('해외')).map((fact) => fact.factKey), appliesNow: true, filingWindowHint: 'Foreign stock capital-gains filing/review should be checked in its separate filing window; do not assume it is included in comprehensive income tax workflow.', notPartOfThisWorkflow: true, whySeparated: 'Foreign stock capital gains are a separate lane and must not be auto-mixed into the comprehensive income tax draft or estimate.', evidenceNeeded: ['foreign broker trade history', 'realized gain/loss detail', 'FX/conversion evidence if needed'], nextRecommendedAction: 'collect foreign stock capital-gains materials in a separate specialist lane' }); items.push({ obligationCode: 'local_income_followup_note', taxType: 'local_income', triggerFacts: ['foreign_stock_capital_gains'], appliesNow: true, filingWindowHint: 'Check whether local-income follow-up applies after the separate capital-gains lane is confirmed.', notPartOfThisWorkflow: true, whySeparated: 'Local-income follow-up may depend on the adjacent capital-gains outcome rather than this comprehensive income tax workflow.', evidenceNeeded: ['capital-gains filing result or advisor confirmation'], nextRecommendedAction: 'carry a local-tax follow-up note with the adjacent capital-gains lane' }); }
  if (hasDomesticLargeShareholder) items.push({ obligationCode: 'domestic_stock_large_shareholder_if_applicable', taxType: 'capital_gains', triggerFacts: facts.filter((fact) => JSON.stringify(fact.value ?? '').toLowerCase().includes('large_shareholder') || JSON.stringify(fact.value ?? '').includes('대주주')).map((fact) => fact.factKey), appliesNow: true, filingWindowHint: 'Confirm domestic large-shareholder capital-gains obligation separately if the taxpayer meets the threshold.', notPartOfThisWorkflow: true, whySeparated: 'Potential domestic-stock large-shareholder capital gains should remain outside the comprehensive income tax computation lane until separately confirmed.', evidenceNeeded: ['shareholding threshold evidence', 'broker trade history', 'sale detail'], nextRecommendedAction: 'confirm large-shareholder applicability in a separate capital-gains review lane' });
  return items;
}

export function deriveAdjacentTaxObligationsNextAction(facts: TaxpayerFact[], items: ListAdjacentTaxObligationsData['items']): 'tax.profile.upsert_facts' | 'tax.workspace.get_status' | undefined {
  if (items.length === 0) return undefined;
  const hasUnknownForeignScope = facts.some((fact) => fact.status === 'missing' && fact.factKey === 'foreign_income');
  const hasUnknownLargeShareholderScope = facts.some((fact) => fact.status === 'missing' && fact.factKey === 'special_tax_treatment_choice');
  if (hasUnknownForeignScope || hasUnknownLargeShareholderScope) return 'tax.profile.upsert_facts';
  return items.some((item) => item.appliesNow) ? 'tax.workspace.get_status' : undefined;
}

export function deriveFilingWindowAwareness(filingYear?: number, now = new Date()): FilingWindowAwareness {
  if (!filingYear) {
    return { filingWindowState: 'unknown', filingWindowHint: 'Filing year is missing, so submission seasonality cannot be determined yet.', submissionAttemptAllowed: false };
  }
  const openAt = new Date(Date.UTC(filingYear + 1, 0, 1, 0, 0, 0));
  const closeAt = new Date(Date.UTC(filingYear + 1, 4, 31, 23, 59, 59));
  const closingSoonAt = new Date(Date.UTC(filingYear + 1, 4, 25, 0, 0, 0));
  if (now < openAt) {
    return { filingWindowState: 'preseason_preview', filingWindowHint: `Submission lane is preview-only before ${filingYear + 1}-05-01; collection, normalize, draft, and compare are still allowed.`, seasonalityWarningCode: 'preseason_preview_only', submissionAttemptAllowed: false };
  }
  if (now > closeAt) {
    return { filingWindowState: 'closed', filingWindowHint: `The main comprehensive-income-tax submission window for filing year ${filingYear} is closed; continue evidence/draft work but do not treat portal submission issues as generic auth/UI failures.`, seasonalityWarningCode: 'filing_window_closed', submissionAttemptAllowed: false };
  }
  if (now >= closingSoonAt) {
    return { filingWindowState: 'closing_soon', filingWindowHint: 'Submission window is currently open but close to deadline; re-check final portal state immediately before final submit.', submissionAttemptAllowed: true };
  }
  return { filingWindowState: 'open', filingWindowHint: 'Submission window is open for live filing actions.', submissionAttemptAllowed: true };
}

export function deriveWorkspaceNextRecommendedAction(workspace: FilingWorkspace): string | undefined {
  const comparisonState = getRuntimeComparisonState(workspace);
  const primaryBlockingReason = getPrimaryBlockingReason(workspace);
  if (workspace.submissionApproval && !workspace.submissionResult) return 'tax.browser.record_submission_result';
  if (workspace.status === 'submission_in_progress') return 'tax.browser.resume_hometax_assist';
  if (workspace.lastCollectionStatus === 'awaiting_user_action' || workspace.lastCollectionStatus === 'blocked') return 'tax.sources.resume_sync';
  if (primaryBlockingReason === 'official_data_refresh_required') return 'tax.filing.refresh_official_data';
  if (primaryBlockingReason === 'missing_material_coverage' || primaryBlockingReason === 'awaiting_review_decision') return 'tax.classify.list_review_items';
  if (workspace.unresolvedReviewCount > 0) return 'tax.classify.list_review_items';
  if (primaryBlockingReason === 'comparison_incomplete') return 'tax.filing.compare_with_hometax';
  if (!workspace.currentDraftId) return 'tax.filing.compute_draft';
  if (workspace.freshnessState === 'refresh_required' || workspace.freshnessState === 'stale_unknown') return 'tax.filing.refresh_official_data';
  if (comparisonState !== 'matched_enough' && comparisonState !== 'manual_only') return 'tax.filing.compare_with_hometax';
  if (workspace.submissionReadiness === 'submission_assist_ready') return 'tax.filing.prepare_hometax';
  if (workspace.submissionReadiness === 'not_ready') return 'tax.classify.list_review_items';
  return undefined;
}

export function deriveOperatorTrustState(params: { draft?: ComputeDraftData; workspace?: FilingWorkspace; reviewItems?: ReviewItem[]; runtimeSnapshot?: RuntimeSnapshot; authCheckpoints?: AuthCheckpoint[]; assistSession?: BrowserAssistSession; }) {
  const runtimeBlockers = params.runtimeSnapshot?.blockerCodes ?? [];
  const draftBlockers = params.draft?.stopReasonCodes ?? [];
  const latestAuthCheckpoint = [...(params.authCheckpoints ?? [])].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
  const assistBlockers: BlockingReason[] = [];
  if (params.workspace?.status === 'submission_uncertain') assistBlockers.push('awaiting_review_decision');
  else if (params.workspace?.status !== 'submitted' && params.workspace?.status !== 'submission_failed') {
    if (params.assistSession && !params.assistSession.endedAt && params.assistSession.authState !== 'completed') assistBlockers.push('missing_auth');
    if (latestAuthCheckpoint && latestAuthCheckpoint.state !== 'completed' && latestAuthCheckpoint.workspaceId === params.workspace?.workspaceId) assistBlockers.push('missing_auth');
  }
  const stopReasonCodes = dedupeBlockingReasons([...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : runtimeBlockers), ...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : draftBlockers), ...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : assistBlockers), params.workspace?.status === 'submission_uncertain' ? 'awaiting_review_decision' : undefined, params.workspace?.status === 'submission_in_progress' && params.workspace?.lastBlockingReason === 'comparison_incomplete' ? 'comparison_incomplete' : undefined, params.workspace?.status !== 'submitted' && params.workspace?.status !== 'submission_failed' ? params.workspace?.lastBlockingReason : undefined]).filter(isBlockingReason);
  const warningCodes = [...(params.draft?.warningCodes ?? [])].filter((value, index, array) => array.indexOf(value) === index);
  const escalationReason = params.workspace?.status === 'submission_uncertain' ? 'Submission result is ambiguous and requires verification before claiming success.' : params.draft?.escalationReason;
  const operatorExplanation = stopReasonCodes.length > 0 ? `현재 진행을 멈추게 하는 활성 blocker: ${stopReasonCodes.join(', ')}. 가정이 포함된 경우 반드시 명시적으로 공개해야 합니다.` : warningCodes.length > 0 ? `현재 경고/다운그레이드 이유: ${warningCodes.join(', ')}. 가정이 포함된 경우 반드시 명시적으로 공개해야 합니다.` : params.workspace?.status === 'submitted' ? '제출 성공 상태로 수렴했으며 활성 blocker는 없습니다. 가정이 있었다면 함께 공개해야 합니다.' : params.workspace?.status === 'submission_failed' ? '제출 실패 상태가 기록되었고 추가 활성 blocker는 없습니다. 실패 원인과 재시도 여부를 검토해야 합니다.' : '현재 활성 blocker는 없습니다. 다만 가정이 있다면 공개해야 합니다.';
  const reviewBatchId = params.draft?.reviewBatchId ?? ((params.reviewItems?.length ?? 0) > 0 ? `review_batch_${params.workspace?.workspaceId ?? 'workspace'}_${params.reviewItems?.length ?? 0}` : undefined);
  return { stopReasonCodes, warningCodes, escalationReason, operatorExplanation, reviewBatchId };
}

export function getDraftHomeTaxPreparation(draft?: ComputeDraftData): PrepareHomeTaxData | undefined { return (draft as ComputeDraftData & { hometaxPreparation?: PrepareHomeTaxData } | undefined)?.hometaxPreparation; }
export function deriveExternalSubmitState(workspace?: FilingWorkspace, session?: BrowserAssistSession): { workflowState: 'active' | 'stopped' | 'awaiting_external_submit_click' | 'submitted' | 'submission_uncertain' | 'submission_failed'; externalSubmitRequired: boolean } { const awaitingExternalSubmitClick = Boolean(workspace?.submissionApproval && !workspace?.submissionResult && (!session || !session.endedAt)); const workflowState: 'active' | 'stopped' | 'awaiting_external_submit_click' | 'submitted' | 'submission_uncertain' | 'submission_failed' = workspace?.status === 'submitted' ? 'submitted' : workspace?.status === 'submission_uncertain' ? 'submission_uncertain' : workspace?.status === 'submission_failed' ? 'submission_failed' : awaitingExternalSubmitClick ? 'awaiting_external_submit_click' : session?.endedAt ? 'stopped' : 'active'; return { workflowState, externalSubmitRequired: awaitingExternalSubmitClick }; }
export function deriveAssistCheckpointContract(params: { draft?: ComputeDraftData; session?: BrowserAssistSession; prepared?: PrepareHomeTaxData; reviewItems?: ReviewItem[]; }) { const entryPlan = (params.prepared?.handoff ?? params.session?.handoff) as PrepareHomeTaxData['handoff'] | undefined; const hasHighSeverityReview = (params.reviewItems ?? []).some((item) => item.resolutionState !== 'resolved' && (item.severity === 'high' || item.severity === 'critical')); const hasMismatch = Boolean(entryPlan?.mismatchSummary.hasUnresolvedMismatch); const staleAfterRefresh = Boolean(entryPlan?.staleAfterRefresh || params.draft?.stopReasonCodes?.includes('official_data_refresh_required')); const draftChanged = Boolean(params.session?.draftId && params.draft?.draftId && params.session.draftId !== params.draft.draftId); const blockedReason: BlockingReason | undefined = draftChanged ? 'official_data_refresh_required' : staleAfterRefresh ? 'official_data_refresh_required' : hasMismatch ? 'comparison_incomplete' : hasHighSeverityReview ? 'awaiting_review_decision' : undefined; return { blockedReason, checkpointKey: entryPlan?.orderedSections[0]?.checkpointKey, screenKey: entryPlan?.orderedSections[0]?.screenKey, allowedNextActions: blockedReason ? ['pause_and_return_to_mcp', 'resolve_blockers'] : ['resume_hometax_assist', 'continue_to_next_section'], resumePreconditions: [...(draftChanged ? ['draft version changed; restart from refreshed prepare_hometax output'] : []), ...(staleAfterRefresh ? ['official data must be refreshed before browser progression'] : []), ...(hasMismatch ? ['material mismatch batch must be resolved first'] : []), ...(hasHighSeverityReview ? ['high-severity review items must be resolved first'] : [])], retryPolicy: (blockedReason ? 'refresh_prepare_then_restart' : (params.session?.authState !== 'completed' ? 'reauth_then_resume' : 'manual_confirmation_then_resume')) as 'reauth_then_resume' | 'refresh_prepare_then_restart' | 'manual_confirmation_then_resume' | 'stop_and_recompute' }; }
