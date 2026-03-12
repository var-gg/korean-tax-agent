import { deriveComparisonSummaryStateFromDraft } from './readiness.js';
import type { FilingComparisonSummaryState, FilingDraft, FilingFieldValue, ReviewSeverity } from './types.js';

export type CompareWithHomeTaxInput = {
  draftId: string;
  fieldValues: FilingFieldValue[];
  sectionKeys?: string[];
  comparisonMode?: 'visible_portal' | 'imported_portal' | 'manual_entry';
};

export type HomeTaxObservedField = {
  sectionKey: string;
  fieldKey: string;
  portalObservedValue: string | number | boolean | null;
};

export type CompareSectionResult = {
  sectionKey: string;
  comparisonState: FilingComparisonSummaryState;
  matchedFields: number;
  mismatchFields: number;
  manualOnlyFields: number;
};

export type MaterialMismatch = {
  sectionKey: string;
  fieldKey: string;
  draftValue: FilingFieldValue['value'];
  portalObservedValue: FilingFieldValue['portalObservedValue'];
  severity: ReviewSeverity;
};

export type CompareWithHomeTaxResult = {
  draftId: string;
  fieldValues: FilingFieldValue[];
  sectionResults: CompareSectionResult[];
  materialMismatches: MaterialMismatch[];
  comparisonSummaryState: FilingComparisonSummaryState;
};

export function compareWithHomeTax(
  input: CompareWithHomeTaxInput,
  observedFields: HomeTaxObservedField[],
): CompareWithHomeTaxResult {
  const sectionFilter = new Set(input.sectionKeys ?? []);
  const targetFields = input.fieldValues.filter((field) => sectionFilter.size === 0 || sectionFilter.has(field.sectionKey));
  const observedMap = new Map(observedFields.map((field) => [`${field.sectionKey}:${field.fieldKey}`, field]));

  const updatedFieldValues = targetFields.map((field) => {
    if (field.requiresManualEntry) {
      return {
        ...field,
        comparisonState: 'manual_only' as const,
      };
    }

    const observed = observedMap.get(`${field.sectionKey}:${field.fieldKey}`);
    if (!observed) {
      return {
        ...field,
        comparisonState: 'not_compared' as const,
      };
    }

    const matched = valuesMatch(field.value, observed.portalObservedValue);
    return {
      ...field,
      portalObservedValue: observed.portalObservedValue,
      comparisonState: matched ? 'matched' as const : 'mismatch' as const,
      mismatchSeverity: matched ? undefined : deriveMismatchSeverity(field.value, observed.portalObservedValue),
    };
  });

  const materialMismatches: MaterialMismatch[] = updatedFieldValues
    .filter((field) => field.comparisonState === 'mismatch')
    .map((field) => ({
      sectionKey: field.sectionKey,
      fieldKey: field.fieldKey,
      draftValue: field.value,
      portalObservedValue: field.portalObservedValue,
      severity: field.mismatchSeverity ?? 'medium',
    }));

  const sectionKeys = [...new Set(updatedFieldValues.map((field) => field.sectionKey))];
  const sectionResults = sectionKeys.map((sectionKey) => {
    const sectionFields = updatedFieldValues.filter((field) => field.sectionKey === sectionKey);
    const matchedFields = sectionFields.filter((field) => field.comparisonState === 'matched').length;
    const mismatchFields = sectionFields.filter((field) => field.comparisonState === 'mismatch').length;
    const manualOnlyFields = sectionFields.filter((field) => field.comparisonState === 'manual_only').length;

    return {
      sectionKey,
      comparisonState: deriveComparisonSummaryStateFromDraft(sectionFields),
      matchedFields,
      mismatchFields,
      manualOnlyFields,
    };
  });

  return {
    draftId: input.draftId,
    fieldValues: mergeFieldUpdates(input.fieldValues, updatedFieldValues),
    sectionResults,
    materialMismatches,
    comparisonSummaryState: deriveComparisonSummaryStateFromDraft(updatedFieldValues),
  };
}

function mergeFieldUpdates(original: FilingFieldValue[], updated: FilingFieldValue[]): FilingFieldValue[] {
  const updatedMap = new Map(updated.map((field) => [field.filingFieldValueId, field]));
  return original.map((field) => updatedMap.get(field.filingFieldValueId) ?? field);
}

function valuesMatch(a: FilingFieldValue['value'], b: FilingFieldValue['portalObservedValue']): boolean {
  return normalizeValue(a) === normalizeValue(b);
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function deriveMismatchSeverity(draftValue: FilingFieldValue['value'], portalObservedValue: FilingFieldValue['portalObservedValue']): ReviewSeverity {
  if (typeof draftValue === 'number' && typeof portalObservedValue === 'number') {
    const delta = Math.abs(draftValue - portalObservedValue);
    if (delta >= 100000) return 'high';
    if (delta >= 10000) return 'medium';
    return 'low';
  }
  return 'medium';
}
