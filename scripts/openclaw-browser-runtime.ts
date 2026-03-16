import { createOpenClawBrowserControlServerClientFromEnv, runOpenClawBrowserRuntimeCommand } from '../packages/browser-assist/src/index.js';

async function main() {
  await runOpenClawBrowserRuntimeCommand({
    client: createOpenClawBrowserControlServerClientFromEnv(process.env),
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null | undefined)?.code;
  process.stdout.write(JSON.stringify({
    ok: false,
    error: {
      message,
      code: typeof code === 'string' ? code : 'OPENCLAW_BROWSER_UNAVAILABLE',
    },
  }));
  process.exitCode = 1;
});
