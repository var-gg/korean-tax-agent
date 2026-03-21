import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

const fixturePath = join(process.cwd(), 'examples', 'acceptance-fixtures', 'no-prep-wrong-artifact-then-recovery.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as any;

const runtime = new InMemoryKoreanTaxMCPRuntime();
const init = runtime.invoke('tax.setup.init_config', { filingYear: fixture.filingYear, storageMode: 'local', taxpayerTypeHint: fixture.taxpayerTypeHint });
const workspaceId = init.data.workspaceId;

console.log('init ->', init.nextRecommendedAction);
console.log('plan ->', runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear }).data.collectionTasks?.map((task: any) => ({ targetArtifactType: task.targetArtifactType, next: task.nextRecommendedAction })));

const connect = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents', 'prepare_import'] });
if (fixture.wrongObservation) {
  console.log('record observation ->', runtime.invoke('tax.sources.record_collection_observation', { workspaceId, sourceId: connect.data.sourceId, ...fixture.wrongObservation }).data);
}

console.log('replanned ->', runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear }).nextRecommendedAction);
console.log('import ->', runtime.invoke('tax.import.import_hometax_materials', { workspaceId, refs: fixture.hometaxMaterials.map((item: any) => ({ ref: item.ref })), materialMetadata: fixture.hometaxMaterials }).nextRecommendedAction);
console.log('normalize ->', runtime.invoke('tax.ledger.normalize', {
  workspaceId,
  extractedPayloads: [{ sourceType: 'hometax', transactions: fixture.transactions, documents: fixture.documents, withholdingRecords: fixture.withholdingRecords }],
}).nextRecommendedAction);
console.log('status ->', runtime.invoke('tax.workspace.get_status', { workspaceId }).data.nextRecommendedAction);
