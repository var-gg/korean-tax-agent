import type { MCPResponseEnvelope } from './contracts.js';
import {
  InMemoryKoreanTaxMCPRuntime,
  type CreateRuntimeOptions,
  type SupportedRuntimeToolName,
} from './runtime.js';

export type InvokeToolRequest = {
  name: string;
  input?: Record<string, unknown>;
};

export const SUPPORTED_RUNTIME_TOOLS: SupportedRuntimeToolName[] = [
  'tax.sources.get_collection_status',
  'tax.workspace.get_status',
  'tax.sources.connect',
  'tax.sources.sync',
  'tax.sources.resume_sync',
  'tax.profile.detect_filing_path',
  'tax.classify.run',
  'tax.classify.list_review_items',
  'tax.classify.resolve_review_item',
  'tax.filing.compute_draft',
  'tax.filing.compare_with_hometax',
  'tax.filing.refresh_official_data',
  'tax.filing.prepare_hometax',
  'tax.browser.start_hometax_assist',
];

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
}

function getMissingRequiredFields(name: SupportedRuntimeToolName, input: Record<string, unknown>): string[] {
  const requiredFieldsByTool: Partial<Record<SupportedRuntimeToolName, string[]>> = {
    'tax.sources.get_collection_status': ['workspaceId'],
    'tax.workspace.get_status': ['workspaceId'],
    'tax.sources.connect': ['workspaceId', 'sourceType', 'requestedScope'],
    'tax.sources.sync': ['sourceId', 'syncMode'],
    'tax.sources.resume_sync': [],
    'tax.profile.detect_filing_path': ['workspaceId'],
    'tax.classify.run': ['workspaceId'],
    'tax.classify.list_review_items': ['workspaceId'],
    'tax.classify.resolve_review_item': ['reviewItemIds', 'selectedOption', 'rationale', 'approverIdentity'],
    'tax.filing.compute_draft': ['workspaceId'],
    'tax.filing.compare_with_hometax': ['workspaceId', 'draftId'],
    'tax.filing.refresh_official_data': ['workspaceId'],
    'tax.filing.prepare_hometax': ['workspaceId', 'draftId'],
    'tax.browser.start_hometax_assist': ['workspaceId', 'draftId', 'mode'],
  };

  const requiredFields = requiredFieldsByTool[name] ?? [];
  return requiredFields.filter((field) => input[field] === undefined);
}
