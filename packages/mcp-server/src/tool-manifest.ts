import type { KoreanTaxMCPContracts } from './contracts.js';
import type { SupportedRuntimeToolName } from './runtime.js';

export type ToolCategory =
  | 'setup'
  | 'sources'
  | 'imports'
  | 'ledger'
  | 'profile'
  | 'classification'
  | 'filing'
  | 'browser'
  | 'workspace';

export type ToolManifestEntry = {
  implemented: boolean;
  category: ToolCategory;
  note?: string;
};

export const CANONICAL_TOOL_MANIFEST = {
  'tax.setup.inspect_environment': { implemented: true, category: 'setup' },
  'tax.setup.init_config': { implemented: true, category: 'setup' },
  'tax.sources.plan_collection': { implemented: true, category: 'sources' },
  'tax.sources.get_collection_status': { implemented: true, category: 'sources' },
  'tax.workspace.get_status': { implemented: true, category: 'workspace' },
  'tax.filing.get_summary': { implemented: true, category: 'filing' },
  'tax.sources.connect': { implemented: true, category: 'sources' },
  'tax.sources.list': { implemented: true, category: 'sources' },
  'tax.sources.disconnect': { implemented: true, category: 'sources' },
  'tax.import.upload_transactions': { implemented: true, category: 'imports' },
  'tax.import.upload_documents': { implemented: true, category: 'imports' },
  'tax.import.submit_extracted_receipt_fields': { implemented: true, category: 'imports' },
  'tax.import.import_hometax_materials': { implemented: true, category: 'imports' },
  'tax.sources.sync': { implemented: true, category: 'sources' },
  'tax.sources.resume_sync': { implemented: true, category: 'sources' },
  'tax.ledger.normalize': { implemented: true, category: 'ledger' },
  'tax.ledger.list_transactions': { implemented: true, category: 'ledger' },
  'tax.ledger.link_evidence': { implemented: true, category: 'ledger' },
  'tax.profile.detect_filing_path': { implemented: true, category: 'profile' },
  'tax.classify.run': { implemented: true, category: 'classification' },
  'tax.classify.list_review_items': { implemented: true, category: 'classification' },
  'tax.classify.resolve_review_item': { implemented: true, category: 'classification' },
  'tax.filing.compute_draft': { implemented: true, category: 'filing' },
  'tax.filing.compare_with_hometax': { implemented: true, category: 'filing' },
  'tax.filing.refresh_official_data': { implemented: true, category: 'filing' },
  'tax.filing.prepare_hometax': { implemented: true, category: 'filing' },
  'tax.browser.start_hometax_assist': { implemented: true, category: 'browser' },
  'tax.browser.resume_hometax_assist': { implemented: true, category: 'browser' },
  'tax.browser.get_checkpoint': { implemented: true, category: 'browser' },
  'tax.browser.stop_hometax_assist': { implemented: true, category: 'browser' },
  'tax.filing.export_package': { implemented: false, category: 'filing', note: 'documented future/pending surface; not exposed by runtime/facade yet' },
} as const satisfies Record<string, ToolManifestEntry>;

export type CanonicalToolName = keyof typeof CANONICAL_TOOL_MANIFEST;
export type ImplementedCanonicalToolName = {
  [K in CanonicalToolName]: (typeof CANONICAL_TOOL_MANIFEST)[K]['implemented'] extends true ? K : never;
}[CanonicalToolName];

export const IMPLEMENTED_TOOL_NAMES = Object.entries(CANONICAL_TOOL_MANIFEST)
  .filter(([, entry]) => entry.implemented)
  .map(([name]) => name)
  .sort() as ImplementedCanonicalToolName[];

export const FUTURE_TOOL_NAMES = Object.entries(CANONICAL_TOOL_MANIFEST)
  .filter(([, entry]) => !entry.implemented)
  .map(([name]) => name)
  .sort() as Exclude<CanonicalToolName, ImplementedCanonicalToolName>[];

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type _ManifestMatchesContracts = Assert<IsEqual<ImplementedCanonicalToolName, keyof KoreanTaxMCPContracts>>;
type _ManifestMatchesRuntime = Assert<IsEqual<ImplementedCanonicalToolName, SupportedRuntimeToolName>>;
