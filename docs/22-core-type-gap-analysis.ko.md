# Core type 갭 분석

- 상태: companion
- 기준 원문: [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
  - [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- 다음 읽기:
  - [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
  - [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)

## 목적
현재 `packages/core/src/types.ts` 모델을 문서에서 의도한 제품/워크플로우 상태와 비교합니다.

이 문서는 현재 코드를 비판하려는 것이 아니라,
- 이미 있는 것
- 아직 약한 것
- agentic collection model을 제대로 지원하려면 추가해야 하는 것
을 구조적으로 보여주는 지도입니다.

## 현재 강점
이미 중요한 downstream entity는 꽤 갖춰져 있습니다.
- taxpayer profile
- filing workspace
- source connection
- source artifact
- ledger transaction
- evidence document
- classification decision
- review item
- filing draft
- audit event
- consent record
- browser assist session

즉 현재 모델은 이미 다음에는 충분히 쓸 만합니다.
- normalization output
- classification output
- review queue generation
- draft computation
- 기본 consent 기록
- 기본 HomeTax assist session 추적

## 핵심 갭 요약
현재 타입은 다음 쪽에 더 최적화되어 있습니다.
- imported data
- classification
- review
- draft generation

반면 아직 충분히 최적화되지 않은 것은:
- source planning
- resumable collection workflow
- explicit auth lifecycle tracking
- sync attempt history
- coverage-gap modeling
- richer audit traceability

즉 한 줄로 말하면,
**downstream tax workflow가 upstream collection workflow보다 더 잘 모델링되어 있었다**는 뜻입니다.

## 핵심 갭
### 1. FilingWorkspace
문제:
- status enum에 과거 흐름이 일부 남아 있었음
- 새 workflow 문서 언어와 완전히 정렬되지 않았음
- coverage gap / blocked summary 같은 운영 신호가 약했음

필요 방향:
- 상태명 정렬
- `taxpayerProfileRef`
- `openCoverageGapCount`
- `lastBlockingReason`
- `lastCollectionStatus`

우선순위:
- 높음

### 2. SourceConnection
문제:
- `consentState`, `connectionStatus`가 느슨한 string 중심
- `collectionMode`, `sourceLabel`, `lastSuccessfulSyncAt`, `lastBlockingReason`, timestamp가 부족했음

왜 중요한가:
source connection은 agentic workflow의 중심이기 때문입니다.
stringly typed 상태는 빠르게 brittle해집니다.

우선순위:
- 매우 높음

### 3. ConsentRecord
문제:
- workspace 중심 추적이 약했음

필요 방향:
- `workspaceId`
- 필요하면 `sourceId`

우선순위:
- 높음

### 4. Auth checkpoint 모델
문제:
- source login checkpoint를 일반화한 first-class type이 없었음

필요 방향:
- `AuthCheckpoint`

우선순위:
- 매우 높음

### 5. Sync attempt 모델
문제:
- resumable collection attempt를 source 자체와 분리해 저장할 수 없었음
- `blockingReason`, `checkpointId`, `fallbackOptions`, `attemptSummary`를 둘 안정적 위치가 없었음

필요 방향:
- `SyncAttempt`

우선순위:
- 매우 높음

### 6. SourceArtifact
문제:
- state-model 문서와 필드명/개념 정렬이 약했음
- `workspaceId`, `ingestedAt`, `parseSummary`, `duplicateCandidateOf` 같은 축이 부족했음

우선순위:
- 높음

### 7. CoverageGap
문제:
- missing evidence / missing source / missing fact가 durable entity로 없었음

필요 방향:
- `CoverageGap`

우선순위:
- 매우 높음

### 8. BrowserAssistSession / AuditEvent 등
문제:
- provider / endedAt / typed checkpoint / richer audit event가 약했음

우선순위:
- 중~높음

## MCP 계약 측면 갭
문서가 이미 더 풍부한 MCP semantics를 설명하고 있었지만,
contracts는 한동안 그 수준까지 못 따라왔습니다.

부족하거나 약했던 것:
- `status`
- `checkpointType`
- 넓은 `blockingReason`
- `pendingUserAction`
- `fallbackOptions`
- `progress`
- `checkpointId`
- resume token / resumable session handle
- source-level vs sync-level state 구분
- source-planning tool
- collection-status tool
- resume-sync tool contract

## 권장 구현 순서
### Phase A. 고우선 타입 추가
1. `AuthCheckpoint`
2. `SyncAttempt`
3. `CoverageGap`
4. `SourceConnection` 강화
5. `ConsentRecord`, `SourceArtifact`에 `workspaceId`

### Phase B. Enum tightening
1. loose string 상태를 typed enum으로 축소
2. workspace status naming 정렬
3. browser assist / artifact parse state 정리

### Phase C. MCP 계약 정렬
1. response envelope 업데이트
2. checkpoint / pending action / resumable semantics 추가
3. source planning / resume sync 계약 추가
4. progress / blocking / fallback 필드 추가
5. source state와 sync attempt state 분리

## 한 줄 결론
현재 core model은 분류와 draft 생성에는 좋은 기반입니다.
다음 단계는 전면 재작성보다,
**collection lifecycle도 tax computation lifecycle만큼 first-class로 끌어올리는 확장**입니다.
