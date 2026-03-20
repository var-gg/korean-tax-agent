import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_RUNTIME_TOOLS } from '../packages/mcp-server/src/facade.js';
import { CANONICAL_TOOL_MANIFEST, FUTURE_TOOL_NAMES, IMPLEMENTED_TOOL_NAMES } from '../packages/mcp-server/src/tool-manifest.js';

const repoRoot = join(import.meta.dirname, '..');
const toolSpecPath = join(repoRoot, 'docs', '09-mcp-tool-spec.md');
const runtimeSourcePath = join(repoRoot, 'packages', 'mcp-server', 'src', 'runtime.ts');

function sorted(values: string[]): string[] {
  return [...values].sort();
}

describe('tool manifest drift checks', () => {
  it('keeps facade supported tools aligned with canonical implemented manifest', () => {
    expect(sorted(SUPPORTED_RUNTIME_TOOLS)).toEqual(sorted(IMPLEMENTED_TOOL_NAMES));
  });

  it('keeps runtime supported-tool union aligned with canonical implemented manifest', () => {
    const runtimeSource = readFileSync(runtimeSourcePath, 'utf8');
    const matches = [...runtimeSource.matchAll(/\| '([^']+)'/g)].map((match) => match[1]!).filter((name) => name.startsWith('tax.'));
    const supportedRuntimeUnion = Array.from(new Set(matches));
    expect(sorted(supportedRuntimeUnion)).toEqual(sorted(IMPLEMENTED_TOOL_NAMES));
  });

  it('keeps docs implemented/future tool mentions aligned with manifest', () => {
    const spec = readFileSync(toolSpecPath, 'utf8');

    for (const toolName of IMPLEMENTED_TOOL_NAMES) {
      expect(spec).toContain(toolName);
    }

    for (const toolName of FUTURE_TOOL_NAMES) {
      expect(spec).toContain(toolName);
    }

    expect(spec).toContain('Implemented tools are tracked in the canonical tool manifest');
    expect(spec).toContain('Future/pending tools are tracked separately from implemented ones');
    expect(spec).not.toContain('treat it as a contract gap or backlog item rather than as an already-supported capability');
    expect(spec).not.toContain('already-supported capability.');
    expect(spec).not.toContain('og item rather than as an already-supported capability.');
  });

  it('ensures every manifest entry has a category and implemented flag', () => {
    for (const [toolName, entry] of Object.entries(CANONICAL_TOOL_MANIFEST)) {
      expect(toolName.startsWith('tax.')).toBe(true);
      expect(typeof entry.implemented).toBe('boolean');
      expect(typeof entry.category).toBe('string');
    }
  });
});
