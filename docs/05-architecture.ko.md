# 아키텍처

- 상태: companion
- 기준 원문: [05-architecture.md](./05-architecture.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [06-data-model.ko.md](./06-data-model.ko.md)
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
- 다음 읽기:
  - [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
  - [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)

## 목적
이 문서는 한국 종합소득세 신고를 위한 agentic workflow를
어떤 구성요소로 나누고, 어떤 순서로 데이터를 흘려보낼지 설명합니다.

핵심 관점은 단순 업로드 도구가 아니라,
**수집 → 정규화 → 검토 → draft 생성 → HomeTax 제출 보조**까지 이어지는
checkpoint-driven 시스템을 만든다는 점입니다.

## 상위 구성요소

### 1. Core domain package
역할:
- canonical transaction / document schema 정의
- normalization pipeline 수행
- classification engine 제공
- review queue 생성
- filing draft 조립
- audit trail 모델 유지

의미:
- 세무 workflow의 중심 로직은 여기에 있습니다.
- 특정 UI나 특정 agent 프레임워크에 종속되지 않는 핵심 계층입니다.

### 2. MCP server package
역할:
- agent가 호출할 수 있는 tool 표면 제공
- tool 입력값 검증
- import / classification / review / draft 생성 orchestration
- consent가 필요한 액션을 명확히 노출

의미:
- core domain의 기능을 agent가 안전하게 호출할 수 있게 하는 실행 계층입니다.
- “무엇을 할 수 있는가”뿐 아니라 “어떤 조건에서 멈춰야 하는가”도 드러내야 합니다.

### 3. Browser assist package
역할:
- HomeTax 탐색 및 입력 보조 지원
- 인증과 최종 승인 같은 사용자 checkpoint에서 pause
- 사용자가 모르게 제출되는 hidden automation 방지

의미:
- 이 계층은 완전 자동 제출기가 아니라 assisted filing layer입니다.
- 인증, 확인, 제출은 사용자 통제권이 보이는 형태여야 합니다.

### 4. OpenClaw skill
역할:
- agent에게 시스템 사용 시점과 방법을 알려줌
- safety / consent 규칙 강제
- setup 및 filing workflow 순서 안내

의미:
- 같은 백엔드라도 agent가 잘못 쓰면 위험해질 수 있으므로,
  skill은 운영 playbook 역할을 합니다.

## 데이터 흐름
권장 흐름은 아래와 같습니다.

1. source planning 및 source state 설정
2. consent 및 auth checkpoint 처리
3. source intake와 sync 시도
4. normalization
5. coverage gap 탐지
6. classification
7. review queue 생성
8. filing draft 생성
9. browser-assisted filing 또는 export

## 흐름 해석
### 1. Source planning / source state
- 어떤 데이터를 어디서 수집할지 먼저 계획합니다.
- 납세자 유형, 보유 자료, 접근 가능한 source에 따라 수집 전략이 달라집니다.

### 2. Consent / auth checkpoint
- source 접근 승인과 실제 인증 단계를 분리해서 다룹니다.
- agent는 사용자가 승인하지 않은 접근을 진행하면 안 됩니다.

### 3. Intake / sync attempts
- source 연결은 한 번에 완벽히 끝나지 않을 수 있습니다.
- partial success, blocked state, user action required 상태를 durable하게 남겨야 합니다.

### 4. Normalization
- CSV, PDF, 수기 입력, 스크린 기반 수집처럼 서로 다른 형식을
  공통 ledger / evidence 표현으로 변환합니다.

### 5. Coverage gap detection
- 시스템이 아는 것뿐 아니라,
  **원래 있어야 하는데 아직 없는 정보**를 모델링해야 합니다.
- 예: 누락된 원천징수 자료, 증빙 없는 비용, 미확인 납세자 사실관계

### 6. Classification
- raw fact 위에 세무적 해석을 얹습니다.
- 이 단계는 자동화될 수 있지만, review 가능한 구조여야 합니다.

### 7. Review queue
- low confidence, mixed-use expense, duplicate conflict 같은 항목은
  사용자의 명시적 판단 또는 override를 기다려야 합니다.

### 8. Filing draft generation
- 수집 데이터와 review 결과를 바탕으로 draft를 계산합니다.
- draft는 파생 산출물이며, source와 rules로부터 재현 가능해야 합니다.

### 9. Browser-assisted filing / export
- 최종 단계에서는 HomeTax 입력 보조 또는 export를 지원합니다.
- 이때도 제출 전 명시적 승인과 mismatch 노출 원칙이 유지되어야 합니다.

## Persistent state backbone
이 아키텍처는 pause / resume 가능한 명시적 workspace state를 전제로 합니다.
최소한 아래 상태가 보존되어야 합니다.

- taxpayer profile state
- source registry
- consent records
- auth checkpoints
- sync attempts
- imported artifacts
- normalized ledger entities
- coverage gaps
- review items
- draft versions
- browser assist sessions
- audit events

참고:
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)

## 왜 persistent state가 중요한가
- agent 세션이 끊겨도 workflow를 이어갈 수 있어야 합니다.
- 어떤 source가 막혔는지, 어떤 인증이 끝났는지, 어떤 review가 남았는지
  매번 대화로 재구성하면 신뢰성이 떨어집니다.
- 제출 직전에는 특히 draft version, unresolved issue, consent 상태를
  정확히 복원할 수 있어야 합니다.

## 저장소 구조 rationale
- `docs/`:
  신뢰 형성과 온보딩을 위해 공개적으로 읽을 수 있는 설계 문서 유지
- `packages/`:
  구현 관심사를 분리
- `skills/`:
  agent instructions를 명시적이고 이식 가능하게 유지
- `examples/`, `templates/`:
  setup ambiguity 감소

## 요약
이 아키텍처의 핵심은 세 가지입니다.

- 세무 도메인 로직을 core에 고정한다.
- agent 호출과 사용자 승인 경계를 MCP / skill에서 명확히 한다.
- HomeTax 단계도 완전 자동화가 아니라 checkpoint-driven assist로 설계한다.

즉, 이 시스템은 “파일 몇 개 올려서 끝나는 앱”이 아니라,
사용자와 agent가 함께 진행하는 **resumable tax workflow system**을 목표로 합니다.
