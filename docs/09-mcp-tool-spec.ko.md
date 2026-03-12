# MCP Tool Spec

- 상태: companion
- 기준 원문: [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
  - [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
  - [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
- 다음 읽기:
  - [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
  - [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)

## 목적
MCP surface는 agent가 쓰기 좋은 compact workflow API를 제공해야 합니다.

대상 영역:
- 환경 설정
- 데이터 import
- normalization
- classification
- review 처리
- draft generation
- HomeTax-assisted submission

핵심은 내부 함수를 전부 노출하는 것이 아니라,
**consent / audit / pause-resume semantics가 분명한 workflow API**를 주는 것입니다.

## tool 설계 규칙
- 모든 민감한 action은 consent state를 드러내야 함
- 모든 mutation은 audit metadata를 남겨야 함
- review item resolution은 명시적이고 attribution 가능해야 함
- tool 응답은 prose-only가 아니라 구조화되어야 함
- long-running step은 progress / pause / resume semantics를 가져야 함

## 공통 response envelope
권장 응답 형태:

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "requiresConsent": false,
  "requiresAuth": false,
  "status": "completed",
  "checkpointType": null,
  "checkpointId": null,
  "blockingReason": null,
  "pendingUserAction": null,
  "resumeToken": null,
  "nextRecommendedAction": "tax.classify.run",
  "fallbackOptions": [],
  "progress": {
    "phase": "classification",
    "step": "apply_rules",
    "percent": 100
  },
  "audit": {
    "eventType": "import_completed",
    "eventId": "evt_123"
  }
}
```

해석 규칙:
- `status`: tool/runtime 진행 상태
- `checkpointType`: 어떤 종류의 user checkpoint인지
- `blockingReason`: 왜 진행이 멈췄는지
- `pendingUserAction`: agent가 사용자에게 무엇을 요청해야 하는지
- `resumeToken` 또는 session id: 재개 가능한 action인지 알려줌

## 권장 status 값
- `completed`
- `in_progress`
- `paused`
- `awaiting_consent`
- `awaiting_auth`
- `awaiting_user_action`
- `blocked`
- `failed`

## 표준 checkpoint type
- `source_consent`
- `authentication`
- `collection_blocker`
- `review_judgment`
- `final_submission`

## 권장 blocking reason
- `missing_consent`
- `missing_auth`
- `ui_changed`
- `blocked_by_provider`
- `export_required`
- `insufficient_metadata`
- `unsupported_source`
- `unsupported_filing_path`
- `missing_material_coverage`
- `awaiting_review_decision`
- `awaiting_final_approval`
- `draft_not_ready`
- `submission_not_ready`
- `comparison_incomplete`
- `official_data_refresh_required`
- `unsupported_hometax_state`

## progress / resume semantics
long-running 또는 checkpoint-driven tool은, agent가 추측 없이 pause / 설명 / resume 할 수 있을 정도의 상태를 반환해야 합니다.

권장 필드:
- `status`
- `checkpointType`
- `checkpointId`
- `blockingReason`
- `pendingUserAction`
- `resumeToken` 또는 resumable session id
- `progress.phase`
- `progress.step`
- `progress.percent`
- `fallbackOptions[]`

핵심 규칙:
- tool이 사용자를 기다리는 상태면 generic error보다 resumable response를 우선
- `awaiting_consent`, `awaiting_auth`, `awaiting_user_action`에는 보통 `checkpointType`이 함께 있어야 함
- `blocked`는 fallback / retry / human review 중 무엇이 최선인지 설명해야 함

## 제안 tool group
### 1. setup
#### `tax.setup.inspect_environment`
목적:
- storage readiness, supported connector, browser-assist capability, missing prerequisite 탐지

#### `tax.setup.init_config`
목적:
- 로컬 filing workspace/config 초기화

#### `tax.setup.list_connectors`
목적:
- 사용 가능한 source connector/import mode와 consent/auth 요구조건 표시

### 2. source planning
#### `tax.sources.plan_collection`
목적:
- workspace 기준으로 다음 최적 source connection / collection action 추천

출력 예:
- recommended next sources
- expected value by source
- likely user checkpoints
- fallback path suggestions

#### `tax.sources.get_collection_status`
목적:
- current coverage, gaps, blocked source, next action 요약

### 3. sources
#### `tax.sources.connect`
목적:
- source 등록 및 연결 시작

핵심 규칙:
- 민감한 auth를 대신 조용히 완료하면 안 됨
- workflow가 resumable이면 vague failure보다 `awaiting_*` 상태를 반환해야 함

#### `tax.sources.list`
목적:
- workspace의 connected / available source 목록 표시

#### `tax.sources.sync`
목적:
- 승인된 source에서 데이터 pull/refresh

출력 예:
- imported artifact count
- changed item summary
- warning
- progress state
- blocked checkpoint detail
- fallback suggestion

#### `tax.sources.resume_sync`
목적:
- 사용자가 필요한 action을 완료한 뒤 paused/blocked sync 재개

#### `tax.sources.disconnect`
목적:
- 향후 sync를 위해 source connection 비활성화

주의:
- 별도 요청/승인 없이 과거 imported record를 자동 삭제하면 안 됨

### 4. imports
#### `tax.import.upload_transactions`
목적:
- user-provided transaction file ingestion

#### `tax.import.upload_documents`
목적:
- receipt, invoice, tax statement 등 evidence file ingestion

#### `tax.import.scan_receipts`
목적:
- receipt 유사 입력에서 OCR/extract 수행

#### `tax.import.import_hometax_materials`
목적:
- HomeTax export 또는 획득 자료 ingestion

### 5. ledger
#### `tax.ledger.normalize`
목적:
- source artifact를 canonical transaction/document로 정규화

#### `tax.ledger.list_transactions`
목적:
- normalized transaction query

#### `tax.ledger.link_evidence`
목적:
- evidence document를 transaction에 수동/반자동 연결

### 6. classification
#### `tax.classify.run`
목적:
- normalized record를 세무 관련 category/treatment로 분류

#### `tax.classify.list_review_items`
목적:
- unresolved review item 조회

#### `tax.classify.resolve_review_item`
목적:
- review item을 명시적으로 해소
- HomeTax comparison mismatch review의 경우 승인된 결론을 draft 상태에 반영

설명:
- `hometax_material_mismatch` 같은 review item은 단순히 닫는 것에서 끝나지 않고,
  runtime 구현에서 draft field/value/comparison state를 함께 갱신할 수 있습니다.

### 7. filing
#### `tax.filing.compute_draft`
목적:
- current normalized/reviewed state에서 filing draft 계산
- downstream tool이 재사용할 수 있는 filing-state snapshot을 함께 남김

출력 예:
- `draftId`
- income / expense / deduction / withholding summary
- warnings
- unresolved blocker
- material unknowns
- persisted readiness metadata
  - `supportTier`
  - `filingPathKind`
  - `estimateReadiness`
  - `draftReadiness`
  - `submissionReadiness`
  - `comparisonSummaryState`
  - `freshnessState`
  - `majorUnknowns`
  - `blockerCodes`
  - `fieldValues`

#### `tax.filing.compare_with_hometax`
목적:
- 현재 filing draft 값과 HomeTax 관측값을 비교
- filing field comparison state와 submission readiness gate를 갱신

출력 예:
- section별 comparison result
- material mismatch 목록
- comparison state가 반영된 field value
- comparison 이후 readiness summary

설명:
- material mismatch가 남아 있으면 바로 prepare로 가지 않고 review resolution로 보내는 것이 자연스럽습니다.
- runtime 구현에서는 material mismatch로부터 `hometax_material_mismatch` review item을 생성할 수 있습니다.

#### `tax.filing.refresh_official_data`
목적:
- comparison 또는 prepare 전에 official data를 refresh

출력 예:
- refreshed source 목록과 change summary
- recomputed / superseded draft id
- readiness downgrade 여부
- refresh 이후 readiness summary

설명:
- runtime 구현에서는 freshness state를 draft metadata에 다시 저장할 수 있습니다.

#### `tax.filing.prepare_hometax`
목적:
- draft를 HomeTax-ready mapping으로 준비
- persisted filing-path/readiness state를 기준으로 prepare 가능 여부 판단

출력 예:
- section mapping
- required manual fields
- blocked / unsupported fields
- comparison readiness
- browser assist readiness
- refresh requirement / freshness note

설명:
- comparison이 불완전하거나,
- review가 아직 unresolved이거나,
- official data freshness가 부족하면
  prepare는 계속 blocked 상태일 수 있습니다.

#### `tax.filing.list_blockers`
목적:
- draft / submission blocker 요약

### 8. browser assist
#### `tax.browser.start_hometax_assist`
목적:
- HomeTax browser assist session 시작

#### `tax.browser.resume_hometax_assist`
목적:
- paused assist session 재개

#### `tax.browser.get_assist_status`
목적:
- assist session checkpoint / blocking / next action 조회

## 권장 워크플로우 순서
1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.setup.list_connectors`
4. `tax.sources.connect` / import 업로드
5. `tax.ledger.normalize`
6. `tax.profile.detect_filing_path`
7. `tax.classify.run`
8. `tax.classify.list_review_items`
9. `tax.filing.compute_draft`
10. `tax.classify.resolve_review_item` (classification/review blocker 해소)
11. `tax.filing.compute_draft` 재계산
12. `tax.filing.refresh_official_data`
13. `tax.filing.compare_with_hometax`
14. material mismatch가 있으면 `tax.classify.list_review_items` → `tax.classify.resolve_review_item`
15. `tax.filing.prepare_hometax`
16. `tax.browser.start_hometax_assist`

실제 프로토타입 루프 요약:
- path 판별
- classify
- draft 계산
- open review 해소
- draft 재계산
- official data refresh
- HomeTax 비교
- mismatch review 해소
- HomeTax prepare
- browser assist handoff

## 한 줄 핵심
좋은 MCP spec은 단순 CRUD 목록이 아닙니다.
이 프로젝트에서 중요한 것은
**agent가 중간 상태를 honest하게 설명하고, 사용자 checkpoint를 존중하며, 다시 이어서 진행할 수 있게 해주는 workflow contract**입니다.
