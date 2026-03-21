export type SourceMethodRegistryEntry = {
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
    sourceCategory: 'hometax',
    targetArtifactType: 'withholding_receipt',
    preferredMethod: 'browser_assist_official_pdf_print',
    fallbackMethods: ['export_ingestion_official_pdf_bundle', 'fact_capture_income_scope_confirmation'],
    knownInvalidMethods: [
      { method: 'hometax_list_xls_only', invalidAsOf: '2026-03-22', reason: 'List XLS alone is insufficient without the official printable receipt/PDF.' },
    ],
    rationale: 'Official withholding receipt print/PDF is the highest-authority source for prepaid tax reconciliation.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 30,
    reviewAfter: '2026-04-21',
    jurisdiction: 'KR',
    notes: 'Do not treat table-list export alone as equivalent to the official print/PDF.',
  },
  {
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
    sourceCategory: 'hometax',
    targetArtifactType: 'year_end_tax_bundle',
    preferredMethod: 'export_ingestion_simplified_pdf_bundle',
    fallbackMethods: ['browser_assist_bundle_download_guide', 'fact_capture_deduction_scope_questions'],
    knownInvalidMethods: [],
    rationale: 'Simplified bundle gives broad deduction coverage with less fragile live navigation.',
    verifiedAt: '2026-03-22',
    freshnessWindowDays: 45,
    reviewAfter: '2026-05-06',
    jurisdiction: 'KR',
  },
  {
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

export function getRegistryFreshness(entry: SourceMethodRegistryEntry, nowIso = new Date().toISOString()): { reverifyRecommended: boolean; expiresAt: string } {
  const base = new Date(entry.verifiedAt + 'T00:00:00.000Z');
  const expires = new Date(base);
  expires.setUTCDate(expires.getUTCDate() + entry.freshnessWindowDays);
  return {
    reverifyRecommended: new Date(nowIso) > expires,
    expiresAt: expires.toISOString(),
  };
}
