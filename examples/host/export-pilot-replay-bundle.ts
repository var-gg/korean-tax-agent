import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type PilotReplayBundle = JsonObject & {
  runId: string;
  repoCommit: string;
  workspaceId: string;
  filingYear: number;
  hostRuntime: JsonObject;
  startedAt: string;
  endedAt: string;
  userIntent: string;
  toolCallTrace: JsonValue[];
  collectionObservations: JsonValue[];
  statusSnapshots: JsonValue[];
  browserCheckpointSummaries: JsonValue[];
  operatorQuestions: JsonValue[];
  artifactsCollected: JsonValue[];
  exportPackageRefs: JsonValue[];
  finalOutcome: JsonObject;
  unresolvedBlockers: JsonValue[];
  improvementHypotheses: JsonValue[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, 'pilot-replay-bundle-schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as { examples?: PilotReplayBundle[] };

function redactValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value
      .replace(/\b\d{6}-?\d{7}\b/g, '[REDACTED_SSN]')
      .replace(/(account|acct|bank)\s*[:=]\s*[^\s]+/gi, '$1=[REDACTED_ACCOUNT]')
      .replace(/password\s*[:=]\s*[^\s]+/gi, 'password=[REDACTED_PASSWORD]')
      .replace(/token\s*[:=]\s*[^\s]+/gi, 'token=[REDACTED_TOKEN]');
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value)) out[key] = redactValue(child as JsonValue);
    return out;
  }
  return value;
}

function toMarkdown(bundle: PilotReplayBundle): string {
  const unresolved = Array.isArray(bundle.unresolvedBlockers) && bundle.unresolvedBlockers.length > 0
    ? (bundle.unresolvedBlockers as string[]).map((item) => `- ${item}`).join('\n')
    : '- none';
  const hypotheses = Array.isArray(bundle.improvementHypotheses) && bundle.improvementHypotheses.length > 0
    ? (bundle.improvementHypotheses as JsonObject[]).map((item) => `- ${String(item.hypothesis ?? 'unknown hypothesis')}`).join('\n')
    : '- none';
  const snapshots = Array.isArray(bundle.statusSnapshots)
    ? (bundle.statusSnapshots as JsonObject[]).map((item) => `- ${String(item.label ?? 'snapshot')} (${String(item.snapshotKind ?? 'unknown')}) @ ${String(item.capturedAt ?? '')}`).join('\n')
    : '- none';
  return `# Pilot Replay Bundle - ${bundle.runId}\n\n## Run\n- repoCommit: ${bundle.repoCommit}\n- workspaceId: ${bundle.workspaceId}\n- filingYear: ${bundle.filingYear}\n- startedAt: ${bundle.startedAt}\n- endedAt: ${bundle.endedAt}\n\n## Intent\n${bundle.userIntent}\n\n## Final outcome\n- status: ${String((bundle.finalOutcome as JsonObject)?.status ?? 'unknown')}\n- summary: ${String((bundle.finalOutcome as JsonObject)?.summary ?? '')}\n\n## Status snapshots\n${snapshots}\n\n## Unresolved blockers\n${unresolved}\n\n## Improvement hypotheses\n${hypotheses}\n`;
}

function getExample(which: 'success' | 'failure'): PilotReplayBundle {
  const example = schema.examples?.find((item) => String((item.finalOutcome as JsonObject)?.status) === which);
  if (!example) throw new Error(`No ${which} example found in schema examples.`);
  return example;
}

function main() {
  const mode = (process.argv[2] ?? 'success') as 'success' | 'failure';
  const outDir = resolve(process.argv[3] ?? join(__dirname, 'out'));
  const rawInput = process.argv[4] ? JSON.parse(readFileSync(resolve(process.argv[4]), 'utf8')) as PilotReplayBundle : getExample(mode);
  const bundle = redactValue(rawInput) as PilotReplayBundle;

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `pilot-replay-${bundle.runId}.json`);
  const mdPath = join(outDir, `pilot-replay-${bundle.runId}.md`);

  writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, toMarkdown(bundle), 'utf8');

  process.stdout.write(`Wrote:\n- ${jsonPath}\n- ${mdPath}\n`);
}

main();
