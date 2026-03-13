# Workflow 상태 머신

- 상태: companion
- Doc role: companion
- Locale: ko
- 기준 원문: [24-workflow-state-machine.md](./24-workflow-state-machine.md) (EN)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md)
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
- 다음 읽기:
  - [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
  - [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)

## 목적
collection, checkpoint, review, draft generation, HomeTax assistance 사이에서 workflow가 어떻게 이동하는지 압축된 참조 모델로 제공합니다.

이 문서는 상세 state model을 대체하지는 않습니다.
대신 여러 문서와 구현이 같은 운영 언어를 쓰도록 vocabulary를 표준화합니다.

## 핵심 모델링 규칙
항상 아래 레이어를 분리해야 합니다.
1. `workspace status` — workflow의 큰 단계
2. `source state` — source relationship의 durable status
3. `sync attempt state` — 특정 collection run의 runtime state
4. `checkpoint type` — 현재 왜 사용자를 기다리는지
5. `blocking reason` — 진행이 멈춘 구조화된 이유
6. `pending user action` — 재개를 위해 필요한 정확한 다음 행동

이 여섯 가지를 한 필드에 몰아넣으면 구현이 빠르게 혼탁해집니다.

## 핵심 상태 예시
### Workspace status
- `initialized`
- `collecting_sources`
- `normalizing`
- `review_pending`
- `draft_ready_for_review`
- `ready_for_hometax_assist`
- `submission_in_progress`
- `submitted`
- `archived`

### Source state
- `planned`
- `awaiting_consent`
- `awaiting_auth`
- `ready`
- `syncing`
- `paused`
- `blocked`
- `completed`
- `disabled`

### Sync attempt state
- `queued`
- `running`
- `paused`
- `awaiting_user_action`
- `blocked`
- `completed`
- `failed`

### Checkpoint type
- `source_consent`
- `authentication`
- `collection_blocker`
- `review_judgment`
- `final_submission`

### Blocking reason
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
- `submission_not_ready`
- `comparison_incomplete`
- `official_data_refresh_required`

## canonical transition 예시
전형적인 happy path는 대략 이렇게 보입니다.
1. workspace `initialized`
2. workspace `collecting_sources`
3. source `planned`
4. source `awaiting_consent`
5. checkpoint `source_consent`
6. source `awaiting_auth`
7. checkpoint `authentication`
8. source `ready`
9. sync attempt `running`
10. artifact import 완료
11. workspace `normalizing`
12. coverage gap / review item 생성
13. workspace `review_pending` 또는 `draft_ready_for_review`
14. workspace `ready_for_hometax_assist`
15. assist session 시작
16. checkpoint `final_submission`
17. workspace `submission_in_progress`
18. workspace `submitted`

## readiness layer
상태 머신은 broad workflow status만으로 충분하지 않습니다.
최소한 아래 readiness 레벨을 함께 다뤄야 합니다.
- `estimate-ready`
- `draft-ready`
- `submission-assist-ready`

같은 `draft_ready_for_review` 상태에 있어도,
어떤 workspace는 submission assist 직전일 수 있고,
어떤 workspace는 아직 중요한 coverage gap 때문에 draft 수준에 머물 수 있습니다.

## partial progress 규칙
### Case A. 하나의 source만 막히고 나머지는 계속 진행
예:
- HomeTax 완료
- 카드 export는 막힘
- local folder ingestion은 계속 가능

의미:
- 전체 workspace를 generic failed state로 뭉개면 안 됨
- source-level / sync-level blockage를 가능한 국소화해야 함

### Case B. 모든 source 완료 전에도 draft 존재 가능
예:
- HomeTax + local evidence로 첫 draft 생성
- bank export가 나중에 도착

의미:
- workflow 전체를 초기화하지 않고 draft recomputation 허용
- 이전 draft 버전과 delta 설명 필요

### Case C. HomeTax assist 시작 후 중단
예:
- 인증 완료
- section navigation 시작
- 브라우저 세션 종료

의미:
- assist session state를 collection state와 별도로 보존해야 함

## collection loop와 assist loop는 구분해야 함
### Loop A. Collection loop
- source 계획
- consent 획득
- auth 완료
- sync 실행
- artifact ingestion
- normalize
- gap 식별

### Loop B. Assist loop
- draft readiness 확인
- HomeTax assist session 시작
- 필요시 auth 재확인
- section navigation
- field fill 또는 guide
- mismatch / manual confirmation에서 pause
- 최종 submission approval 요청

설계 규칙:
HomeTax assist semantics를 generic collection state에 억지로 밀어 넣지 말고,
전용 assist session 모델이 더 명확하면 분리하는 것이 좋습니다.

## 제품 테스트
이 상태 머신이 잘 작동한다는 말은 시스템이 항상 아래를 설명할 수 있다는 뜻입니다.
- 지금 workflow가 어떤 phase에 있는가
- 어떤 source 또는 assist step이 활성인가
- 왜 block되어 있는가
- 사용자가 다음에 무엇을 해야 하는가
- 그 행동 후 무엇이 이어질 것인가

이 다섯 가지를 설명하지 못하면, 아직 충분히 agentic하지 않은 것입니다.
