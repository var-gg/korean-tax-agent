# Workspace 상태 모델

- 상태: companion
- 기준 원문: [20-workspace-state-model.md](./20-workspace-state-model.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
- 다음 읽기:
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)

## 목적
agentic, checkpoint-driven 세금 신고 workflow에 필요한 **최소 persistent state**를 정의합니다.

workspace는 단순히 import된 파일 묶음이 아니라,
수집 / review / draft 생성 / 제출 보조의 진행 상태를 보존해서 agent가 pause/resume해도 맥락을 잃지 않게 해야 합니다.

## 설계 목표
- collection progress를 durable하게 유지
- consent와 auth 경계를 명시적으로 보존
- 여러 source에서 partial success 지원
- 무엇이 missing / blocked / unresolved인지 추적
- audit 가능한 state transition 생성
- 초기 오픈소스 구현에 맞게 지나치게 무겁지 않게 유지

## Workspace identity
workspace는 한 납세자의 한 신고 연도 맥락을 의미합니다.

최소 필드:
- `workspaceId`
- `filingYear`
- `taxpayerProfileRef`
- `status`
- `createdAt`
- `updatedAt`

권장 status:
- `initialized`
- `collecting_sources`
- `normalizing`
- `review_pending`
- `draft_ready_for_review`
- `ready_for_hometax_assist`
- `submission_in_progress`
- `submitted`
- `archived`

## 핵심 state 영역
### 1. Taxpayer profile state
목적:
- 신고 로직과 source planning에 영향을 주는 구조화 사실 유지

예:
- taxpayer type hint
- residency / filing context
- business category
- deduction 관련 profile facts
- unsupported edge-case note

왜 중요한가:
- agent가 같은 core fact를 반복해서 묻지 않기 위해
- source planning이 user profile 맥락에 의존하기 때문에

### 2. Source registry
목적:
- 알려진 모든 source 연결 또는 시도된 연결을 표현

최소 필드:
- `sourceId`
- `workspaceId`
- `sourceType`
- `sourceLabel`
- `collectionMode`
- `state`
- `scopeGranted`
- `lastSyncAt`
- `lastSuccessfulSyncAt`
- `lastBlockingReason`
- `createdAt`
- `updatedAt`

권장 source state:
- `planned`
- `awaiting_consent`
- `awaiting_auth`
- `ready`
- `syncing`
- `paused`
- `blocked`
- `completed`
- `disabled`

핵심 해석:
- source state는 이 source relationship의 durable status를 뜻함
- sync attempt state는 현재/최근 collection run에서 무슨 일이 일어나는지를 뜻함
- 둘을 한 필드에 과적하지 말아야 함

### 3. Consent records
목적:
- 승인 이벤트를 auth state와 별도로 기록

최소 필드:
- `consentId`
- `workspaceId`
- `consentType`
- `scope`
- `status`
- `grantedBy`
- `grantedAt`
- `revokedAt`
- `note`

### 4. Auth checkpoints
목적:
- 진행을 막는 identity step을 model화하되 blanket permission처럼 취급하지 않기 위함

최소 필드:
- `authCheckpointId`
- `workspaceId`
- `sourceId`
- `provider`
- `authMethod`
- `state`
- `startedAt`
- `completedAt`
- `expiresAt`
- `sessionBinding`

### 5. Sync attempts
목적:
- 각 source별 collection run 또는 refresh attempt 기록

최소 필드:
- `syncAttemptId`
- `workspaceId`
- `sourceId`
- `mode`
- `state`
- `startedAt`
- `endedAt`
- `checkpointType`
- `checkpointId`
- `blockingReason`
- `pendingUserAction`
- `attemptSummary`
- `fallbackOptions[]`

### 6. Imported artifacts
목적:
- 정규화 이전/도중에 수집한 raw material 추적

예:
- CSV
- downloaded statement
- PDF tax document
- receipt image
- HTML snapshot
- browser-collected bundle

### 7. Normalized ledger state
목적:
- downstream classification과 draft computation이 사용할 canonical transaction/document 표현

핵심 영역:
- transactions
- normalized documents
- evidence links
- duplicate groups
- reconciliation markers

### 8. Coverage gaps
목적:
- workspace에서 아직 무엇이 빠졌는지 명시적으로 표현

예:
- 아직 수집되지 않은 은행 내역
- 중요한 deduction에 필요한 증빙 부족
- withholding evidence 부재
- 세무 판단에 필요한 taxpayer fact 부족

### 9. Review queue state
목적:
- 해결되지 않은 judgment call과 high-impact ambiguity 유지

## 한 줄 결론
workspace는 파일 저장소가 아니라,
**collection lifecycle + review lifecycle + draft/submission lifecycle를 끊기지 않게 이어주는 운영 상태 모델**이어야 합니다.
