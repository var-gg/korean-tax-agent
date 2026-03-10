import type { ConsentRecord } from './types.js';

export type ConsentRequirement = {
  consentType: ConsentRecord['consentType'];
  sourceType?: string;
  filingYear?: number;
  requiredActions?: string[];
};

export type ConsentEvaluation = {
  allowed: boolean;
  requiresConsent: boolean;
  matchedConsentId?: string;
  reason?: 'missing_consent' | 'expired_consent' | 'revoked_consent' | 'insufficient_scope';
};

function includesAll(granted: string[] | undefined, required: string[] | undefined): boolean {
  if (!required || required.length === 0) return true;
  const grantedSet = new Set(granted ?? []);
  return required.every((item) => grantedSet.has(item));
}

export function evaluateConsent(records: ConsentRecord[], requirement: ConsentRequirement, now = new Date().toISOString()): ConsentEvaluation {
  const candidates = records.filter((record) => {
    if (record.consentType !== requirement.consentType) return false;
    if (typeof requirement.filingYear === 'number' && record.scope.filingYear !== requirement.filingYear) return false;
    if (requirement.sourceType && record.scope.sourceType !== requirement.sourceType) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { allowed: false, requiresConsent: true, reason: 'missing_consent' };
  }

  for (const record of candidates) {
    if (record.status === 'revoked') {
      continue;
    }
    if (record.expiresAt && record.expiresAt < now) {
      continue;
    }
    if (!includesAll(record.scope.actions, requirement.requiredActions)) {
      continue;
    }

    return {
      allowed: true,
      requiresConsent: false,
      matchedConsentId: record.consentId,
    };
  }

  const revoked = candidates.find((record) => record.status === 'revoked');
  if (revoked) {
    return { allowed: false, requiresConsent: true, reason: 'revoked_consent' };
  }

  const expired = candidates.find((record) => record.expiresAt && record.expiresAt < now);
  if (expired) {
    return { allowed: false, requiresConsent: true, reason: 'expired_consent' };
  }

  return { allowed: false, requiresConsent: true, reason: 'insufficient_scope' };
}

export function buildConsentPrompt(requirement: ConsentRequirement): string {
  const actionText = requirement.requiredActions?.length ? requirement.requiredActions.join(', ') : 'requested action';
  const sourceText = requirement.sourceType ? ` on ${requirement.sourceType}` : '';
  const yearText = typeof requirement.filingYear === 'number' ? ` for filing year ${requirement.filingYear}` : '';
  return `Consent required for ${requirement.consentType}${sourceText}${yearText}: ${actionText}`;
}
