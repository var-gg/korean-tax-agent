export type SourceMethodRegistryEntry = {
  entryId: string;
  sourceCategory: string;
  targetArtifactType: string;
  preferredMethod: string;
  fallbackMethods: string[];
  knownInvalidMethods: Array<{
    method: string;
    invalidAsOf: string;
    reason: string;
  }>;
  rationale: string;
  verifiedAt: string;
  freshnessWindowDays: number;
  reviewAfter: string;
  jurisdiction: string;
  notes?: string;
};

export const SOURCE_METHOD_REGISTRY: SourceMethodRegistryEntry[] = [
  {
    entryId: 'registry_hometax_withholding_receipt',
    sourceCategory: 'hometax',
    targetArtifactType: 'withholding_receipt',
    preferredMethod: 'browser_assist_official_pdf_print',
    fallbackMethods: ['export_ingestion_official_pdf_bundle', 'fact_capture_income_scope_confirmation'],
    knownInvalidMethods: [
      { method: 'hometax_list_xls_only', invalidAsOf: '2026-03-22', reason: 'List XLS alone is insufficient without the official printable receipt/PDF.' },
      { method: 'hometax_summary_only', invalidAsOf: '2026-03-22', reason: 'Summary-only HomeTax view is not enough evidence for withholding truth.' },
    ],
    rationale: 'Official withholding receipt print/PDF is the highest-authority source for prepaid tax reconciliation.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 30,
    reviewAfter: '2026-04-21',
    jurisdiction: 'KR',
    notes: 'HomeTax withholding is sufficient only when the official PDF/print or equivalent official printable certificate is captured.',
  },
  {
    entryId: 'registry_hometax_filing_guidance_notice',
    sourceCategory: 'hometax',
    targetArtifactType: 'filing_guidance_notice',
    preferredMethod: 'browser_assist_notice_print_pdf',
    fallbackMethods: ['export_ingestion_notice_pdf'],
    knownInvalidMethods: [],
    rationale: 'Official filing guidance notice helps confirm scope and prefilled assumptions early.',
    verifiedAt: '2025-01-01',
    freshnessWindowDays: 21,
    reviewAfter: '2025-01-22',
    jurisdiction: 'KR',
    notes: 'Re-verify when HomeTax seasonal UI changes are suspected.',
  },
  {
    entryId: 'registry_hometax_year_end_tax_bundle',
    sourceCategory: 'hometax',
    targetArtifactType: 'year_end_tax_bundle',
    preferredMethod: 'export_ingestion_simplified_pdf_bundle',
    fallbackMethods: ['browser_assist_bundle_download_guide', 'fact_capture_deduction_scope_questions'],
    knownInvalidMethods: [
      { method: 'year_end_tax_bundle_summary_only', invalidAsOf: '2026-03-22', reason: 'Summary-only bundle cannot replace detailed business expense evidence.' },
    ],
    rationale: 'Simplified bundle gives broad deduction coverage with less fragile live navigation, but does not replace itemized expense proof.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 45,
    reviewAfter: '2026-05-06',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_government_record_resident_register',
    sourceCategory: 'government_record',
    targetArtifactType: 'resident_register',
    preferredMethod: 'export_ingestion_official_resident_register_pdf',
    fallbackMethods: ['fact_capture_household_context_then_request_register'],
    knownInvalidMethods: [],
    rationale: 'Resident register is conditional proof for address/household-linked deductions and should be requested narrowly.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 60,
    reviewAfter: '2026-05-21',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_health_insurance_payment_history',
    sourceCategory: 'health_insurance',
    targetArtifactType: 'health_insurance_payment_history',
    preferredMethod: 'export_ingestion_official_payment_history_pdf',
    fallbackMethods: ['secure_mail_attachment_download', 'fact_capture_payment_period_confirmation'],
    knownInvalidMethods: [],
    rationale: 'Official payment history can support deduction and reconciliation when relevant.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 60,
    reviewAfter: '2026-05-21',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_telecom_payment_history',
    sourceCategory: 'telecom',
    targetArtifactType: 'telecom_payment_history',
    preferredMethod: 'export_ingestion_itemized_statement_pdf',
    fallbackMethods: ['secure_mail_attachment_download', 'fact_capture_business_use_explanation'],
    knownInvalidMethods: [],
    rationale: 'Telecom evidence is useful only when the statement is itemized enough for business-use review.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 60,
    reviewAfter: '2026-05-21',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_card_statement_itemized_detail',
    sourceCategory: 'card_statement',
    targetArtifactType: 'card_itemized_detail',
    preferredMethod: 'export_ingestion_itemized_card_statement',
    fallbackMethods: ['browser_assist_card_detail_download', 'fact_capture_targeted_expense_question'],
    knownInvalidMethods: [
      { method: 'card_bundle_summary_only', invalidAsOf: '2026-03-22', reason: 'Summary-only card bundle cannot support business expense line-item review.' },
    ],
    rationale: 'Itemized card detail is needed for business-expense evidence; summary totals are not enough.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 45,
    reviewAfter: '2026-05-06',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_housing_rent_contract',
    sourceCategory: 'housing',
    targetArtifactType: 'rent_contract',
    preferredMethod: 'export_ingestion_signed_contract_pdf',
    fallbackMethods: ['fact_capture_landlord_payment_context'],
    knownInvalidMethods: [],
    rationale: 'Rent contract is conditional evidence when rent-related deduction or business-use review matters.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 90,
    reviewAfter: '2026-06-20',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_local_documents_petty_receipts_bundle',
    sourceCategory: 'local_documents',
    targetArtifactType: 'petty_receipts_bundle',
    preferredMethod: 'upload_curated_receipts_bundle',
    fallbackMethods: ['card_itemized_detail_request', 'fact_capture_expense_scope_confirmation'],
    knownInvalidMethods: [],
    rationale: 'Petty receipts bundle can support small expenses, but should be curated and scoped rather than dumped wholesale.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 90,
    reviewAfter: '2026-06-20',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_payroll_payment_detail',
    sourceCategory: 'payroll',
    targetArtifactType: 'payroll_payment_detail',
    preferredMethod: 'export_ingestion_payroll_detail_pdf',
    fallbackMethods: ['secure_mail_attachment_download', 'fact_capture_salary_period_confirmation'],
    knownInvalidMethods: [],
    rationale: 'Payroll payment detail is useful when salary-side reconciliation needs more than a high-level withholding receipt.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 60,
    reviewAfter: '2026-05-21',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_secure_mail_attachment',
    sourceCategory: 'secure_mail',
    targetArtifactType: 'secure_mail_attachment',
    preferredMethod: 'attachment_download_then_upload',
    fallbackMethods: ['password_checkpoint_then_attachment_download'],
    knownInvalidMethods: [
      { method: 'password_gated_secure_mail_html_only', invalidAsOf: '2026-03-22', reason: 'Password-gated secure mail HTML alone is not importable evidence; the attachment itself must be retrieved.' },
    ],
    rationale: 'Secure-mail HTML is usually only a shell; the actual attachment or password checkpoint is what matters.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 30,
    reviewAfter: '2026-04-21',
    jurisdiction: 'KR',
  },
  {
    entryId: 'registry_conditional_deduction_support',
    sourceCategory: 'conditional_supporting_documents',
    targetArtifactType: 'conditional_deduction_support',
    preferredMethod: 'fact_capture_then_targeted_upload',
    fallbackMethods: ['export_ingestion_targeted_official_document'],
    knownInvalidMethods: [],
    rationale: 'Ask the narrow deduction question first, then request only the exact official proof if needed.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 60,
    reviewAfter: '2026-05-21',
    jurisdiction: 'KR',
  },
];

export function getSourceMethodRegistryEntry(sourceCategory: string, targetArtifactType: string): SourceMethodRegistryEntry | undefined {
  return SOURCE_METHOD_REGISTRY.find((entry) => entry.sourceCategory === sourceCategory && entry.targetArtifactType === targetArtifactType);
}

export function validateRegistryEntryDates(entry: SourceMethodRegistryEntry, nowIso = new Date().toISOString()): string[] {
  const now = new Date(nowIso);
  const warnings: string[] = [];
  for (const dateText of [entry.verifiedAt, entry.reviewAfter, ...entry.knownInvalidMethods.map((item) => item.invalidAsOf)]) {
    const parsed = new Date(`${dateText}T00:00:00.000Z`);
    if (parsed > now) warnings.push(`future_date:${dateText}`);
  }
  return warnings;
}

export function getRegistryFreshness(entry: SourceMethodRegistryEntry, nowIso = new Date().toISOString()): { reverifyRecommended: boolean; expiresAt: string } {
  const base = new Date(entry.verifiedAt + 'T00:00:00.000Z');
  const expires = new Date(base);
  expires.setUTCDate(expires.getUTCDate() + entry.freshnessWindowDays);
  return {
    reverifyRecommended: new Date(nowIso) > expires,
    expiresAt: expires.toISOString(),
  };
}

