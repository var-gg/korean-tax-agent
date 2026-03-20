import type { GetFilingSummaryData, MCPResponseEnvelope } from './contracts.js';
import { formatFilingSummaryForDiscord, formatFilingSummaryForReply, type ReplySurface } from './reply-formatters.js';
import {
  InMemoryKoreanTaxMCPRuntime,
  type CreateRuntimeOptions,
  type SupportedRuntimeToolName,
} from './runtime.js';
import { IMPLEMENTED_TOOL_NAMES } from './tool-manifest.js';

export type InvokeToolRequest = {
  name: string;
  input?: Record<string, unknown>;
};

export const SUPPORTED_RUNTIME_TOOLS: SupportedRuntimeToolName[] = [...IMPLEMENTED_TOOL_NAMES];

export function isSupportedRuntimeToolName(name: string): name is SupportedRuntimeToolName {
  return SUPPORTED_RUNTIME_TOOLS.includes(name as SupportedRuntimeToolName);
}

export function createUnsupportedToolResponse(name: string): MCPResponseEnvelope<Record<string, never>> {
  return {
    ok: false,
    status: 'failed',
    data: {},
    errorCode: 'unsupported_tool',
    errorMessage: `Unsupported tool: ${name}`,
    warnings: [
      {
        code: 'unsupported_tool',
        message: `Tool is not registered in the in-memory runtime facade: ${name}`,
        severity: 'medium',
      },
    ],
  };
}

export function createInvalidInputResponse(name: string, missingFields: string[]): MCPResponseEnvelope<Record<string, never>> {
  return {
    ok: false,
    status: 'failed',
    data: {},
    errorCode: 'invalid_input',
    errorMessage: `Invalid input for ${name}. Missing required fields: ${missingFields.join(', ')}`,
    warnings: [
      {
        code: 'invalid_input',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        severity: 'high',
      },
    ],
  };
}

export function createToolInvocationErrorResponse(name: string, error: unknown): MCPResponseEnvelope<Record<string, never>> {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    status: 'failed',
    data: {},
    errorCode: 'tool_invocation_failed',
    errorMessage: `Tool invocation failed for ${name}: ${message}`,
    warnings: [
      {
        code: 'tool_invocation_failed',
        message,
        severity: 'high',
      },
    ],
  };
}

/**
 * Thin façade over the in-memory runtime.
 *
 * Consumer guidance:
 * - Use `response.readinessState` for canonical readiness decisions.
 * - Use `response.data.runtimeSnapshot` for current runtime/UI state when available.
 * - Use `response.readiness` only for compact compatibility summaries.
 */
export class KoreanTaxMCPFacade {
  readonly runtime: InMemoryKoreanTaxMCPRuntime;

  constructor(options: CreateRuntimeOptions = {}) {
    this.runtime = new InMemoryKoreanTaxMCPRuntime(options);
  }

  invokeTool(request: InvokeToolRequest): MCPResponseEnvelope<Record<string, unknown>> {
    if (!isSupportedRuntimeToolName(request.name)) {
      return createUnsupportedToolResponse(request.name);
    }

    const input = (request.input ?? {}) as Record<string, unknown>;
    const missingFields = getMissingRequiredFields(request.name, input);
    if (missingFields.length > 0) {
      return createInvalidInputResponse(request.name, missingFields);
    }

    try {
      return (this.runtime as { invoke: (name: string, input: Record<string, unknown>) => MCPResponseEnvelope<Record<string, unknown>> }).invoke(
        request.name,
        input,
      );
    } catch (error) {
      return createToolInvocationErrorResponse(request.name, error);
    }
  }

  invokeAndFormatFilingSummary(
    input: Record<string, unknown>,
    surface: ReplySurface = 'generic',
  ): { response: MCPResponseEnvelope<GetFilingSummaryData>; message: string } {
    const response = this.invokeTool({
      name: 'tax.filing.get_summary',
      input,
    }) as MCPResponseEnvelope<GetFilingSummaryData>;

    return {
      response,
      message: formatFilingSummaryForReply(response, surface),
    };
  }

  invokeAndFormatFilingSummaryForDiscord(
    input: Record<string, unknown>,
  ): { response: MCPResponseEnvelope<GetFilingSummaryData>; message: string } {
    const response = this.invokeTool({
      name: 'tax.filing.get_summary',
      input,
    }) as MCPResponseEnvelope<GetFilingSummaryData>;

    return {
      response,
      message: formatFilingSummaryForDiscord(response),
    };
  }
}

function getMissingRequiredFields(name: SupportedRuntimeToolName, input: Record<string, unknown>): string[] {
  const requiredFieldsByTool: Partial<Record<SupportedRuntimeToolName, string[]>> = {
    'tax.setup.inspect_environment': [],
    'tax.setup.init_config': ['filingYear', 'storageMode'],
    'tax.sources.plan_collection': ['workspaceId', 'filingYear'],
    'tax.sources.get_collection_status': ['workspaceId'],
    'tax.workspace.get_status': ['workspaceId'],
    'tax.filing.get_summary': ['workspaceId'],
    'tax.sources.connect': ['workspaceId', 'sourceType', 'requestedScope'],
    'tax.sources.list': ['workspaceId'],
    'tax.sources.disconnect': ['workspaceId', 'sourceId'],
    'tax.import.upload_transactions': ['workspaceId', 'refs'],
    'tax.import.upload_documents': ['workspaceId', 'refs'],
    'tax.import.submit_extracted_receipt_fields': ['workspaceId', 'submissions', 'extractorMetadata'],
    'tax.import.import_hometax_materials': ['workspaceId', 'refs'],
    'tax.sources.sync': ['sourceId', 'syncMode'],
    'tax.sources.resume_sync': [],
    'tax.ledger.normalize': ['workspaceId'],
    'tax.ledger.list_transactions': ['workspaceId'],
    'tax.ledger.link_evidence': ['workspaceId', 'transactionIds', 'documentIds', 'linkMode'],
    'tax.profile.detect_filing_path': ['workspaceId'],
    'tax.classify.run': ['workspaceId'],
    'tax.classify.list_review_items': ['workspaceId'],
    'tax.classify.resolve_review_item': ['reviewItemIds', 'selectedOption', 'rationale', 'approverIdentity'],
    'tax.filing.compute_draft': ['workspaceId'],
    'tax.filing.compare_with_hometax': ['workspaceId', 'draftId'],
    'tax.filing.refresh_official_data': ['workspaceId'],
    'tax.filing.prepare_hometax': ['workspaceId', 'draftId'],
    'tax.browser.start_hometax_assist': ['workspaceId', 'draftId', 'mode'],
    'tax.browser.resume_hometax_assist': ['workspaceId'],
    'tax.browser.get_checkpoint': ['assistSessionId'],
    'tax.browser.stop_hometax_assist': ['assistSessionId'],
  };

  const requiredFields = requiredFieldsByTool[name] ?? [];
  return requiredFields.filter((field) => input[field] === undefined);
}
