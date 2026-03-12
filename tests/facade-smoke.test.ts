import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { KoreanTaxMCPFacade, SUPPORTED_RUNTIME_TOOLS } from '../packages/mcp-server/src/facade.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

describe('mcp facade', () => {
  it('exposes supported runtime tools through invokeTool', () => {
    const facade = new KoreanTaxMCPFacade({
      consentRecords: demo.consentRecords,
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
    });

    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.sources.connect');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.compute_draft');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.compare_with_hometax');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.refresh_official_data');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.profile.detect_filing_path');

    const statusResult = facade.invokeTool({
      name: 'tax.sources.get_collection_status',
      input: { workspaceId: demo.workspaceId },
    });

    expect(statusResult.ok).toBe(true);
    expect(Array.isArray(statusResult.data.connectedSources)).toBe(true);

    const pathResult = facade.invokeTool({
      name: 'tax.profile.detect_filing_path',
      input: { workspaceId: demo.workspaceId },
    });

    expect(pathResult.ok).toBe(true);
    expect(pathResult.data.workspaceId).toBe(demo.workspaceId);
    expect(typeof pathResult.data.supportTier).toBe('string');
    expect(pathResult.readiness).toBeTruthy();

    const compareInvalid = facade.invokeTool({
      name: 'tax.filing.compare_with_hometax',
      input: { workspaceId: demo.workspaceId },
    });

    expect(compareInvalid.ok).toBe(false);
    expect(compareInvalid.errorCode).toBe('invalid_input');

    const refreshResult = facade.invokeTool({
      name: 'tax.filing.refresh_official_data',
      input: { workspaceId: demo.workspaceId },
    });

    expect(refreshResult.ok).toBe(true);
    expect(Array.isArray(refreshResult.data.refreshedSources)).toBe(true);

    const unsupported = facade.invokeTool({
      name: 'tax.not_real.tool',
      input: {},
    });

    expect(unsupported.ok).toBe(false);
    expect(unsupported.status).toBe('failed');
    expect(unsupported.errorCode).toBe('unsupported_tool');
  });

  it('returns failure envelope for invalid input instead of throwing', () => {
    const facade = new KoreanTaxMCPFacade();

    const result = facade.invokeTool({
      name: 'tax.classify.resolve_review_item',
      input: {
        selectedOption: 'exclude_from_expense',
        rationale: 'bad input test',
        approverIdentity: 'test_user',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('invalid_input');
  });
});
