# Korean Tax Agent

**언어:** [English](README.md) | [한국어](README.ko.md)

한국의 **종합소득세 신고를 자료 준비부터 제출까지 보조하는 오픈소스, agent-native workflow**입니다.

이 저장소는 **한국 종합소득세 workflow용 host-agnostic MCP core**와, 여러 agent runtime에서 선택적으로 붙일 수 있는 integration/example 레이어를 함께 만드는 프로젝트입니다.
즉 OpenClaw, Codex 계열 앱, Claude 계열 agent workspace 등 **어떤 호스트를 쓰더라도 붙일 수 있는 구조**를 지향합니다.

## MCP와 외부 AI agent의 경계

이 저장소는 **MCP를 workflow server**로 다룹니다. MCP가 곧 전체 agent는 아닙니다.

**MCP가 맡는 일:**
- workspace 상태와 checkpoint
- collection planning / coverage gaps
- artifact ingestion by reference
- normalization, classification, review, draft, comparison, readiness, blockers, audit
- HomeTax assist handoff state
- submission approval / result / receipt records
- read-only export package 생성

**외부 AI agent가 맡는 일:**
- browser 제어와 실제 포털 조작
- 로컬 파일 선택 / 업로드 전 준비
- OCR 또는 추출 후 structured payload 생성
- 사용자 설명, 대화, 체크포인트 안내
- 실제 final submit click

핵심 원칙:
- MCP는 **domain/workflow/control-plane layer**
- 외부 AI agent는 **browser/file/OCR/user-interaction layer**
- 사용자는 **login / consent / judgment** 상황에서만 개입

참고:
- [docs/09-mcp-tool-spec.md](./docs/09-mcp-tool-spec.md) (EN)
- [docs/27-v1-supported-paths-and-stop-conditions.md](./docs/27-v1-supported-paths-and-stop-conditions.md) (EN)
- [docs/38-mcp-agent-boundary-and-contract-gaps.md](./docs/38-mcp-agent-boundary-and-contract-gaps.md) (EN)
- [docs/39-agent-operator-quickstart.md](./docs/39-agent-operator-quickstart.md) (EN)

## 제품 메시지

이 프로젝트는 다음을 목표로 하지 않습니다.
- 글로벌 범용 세무 엔진
- 모든 것을 대신하는 범용 에이전트 플랫폼
- 사용자 모르게 끝까지 진행되는 완전 자동 세무 신고

이 프로젝트는 다음을 목표로 합니다.
- 한국 종합소득세 workflow
- 자료 준비 → 검토 → 초안 → HomeTax 비교/준비/보조 입력 → 승인/결과/내보내기 흐름
- consent-gated / checkpoint-driven 운영
- 여러 agent runtime이 채택할 수 있는 portable MCP surface

한 줄로 정리하면:
- **제품 범위:** 한국 종합소득세를 자료 준비부터 제출까지 보조하는 workflow
- **핵심 인터페이스:** host-agnostic MCP contract + state model
- **런타임 자세:** 특정 브릿지 종속이 아니라 여러 agent runtime에서 사용 가능
- **제출 자세:** silent automation이 아니라 assisted / explicit flow

## 왜 이 프로젝트가 필요한가

한국 세무 신고는 단순 계산 문제가 아니라 **워크플로우 문제**입니다.

사용자는 실제로 다음을 해야 합니다.
- 여러 소스에서 자료를 모으고,
- 누락되거나 애매한 근거를 해소하고,
- 위험한 분류 항목을 검토하고,
- HomeTax와 비교한 뒤,
- 명시적 승인 후 제출 결과와 영수증까지 확인해야 합니다.

그래서 이 프로젝트는 세무 신고를 하나의 계산기나 폼이 아니라,
**에이전트가 이어주는 workflow**로 다룹니다.

## 현재 상태

현재 이 저장소는 **실행 가능한 프로토타입(executable prototype)** 단계입니다.

즉:
- 핵심 workflow contract 문서가 정리되어 있고,
- in-memory MCP runtime으로 end-to-end 흐름을 실행해볼 수 있으며,
- setup → sources → imports → normalize → facts → review → draft → compare → prepare → assist → approval/result → export 흐름의 주요 checkpoint가 프로토타입 코드로 연결되어 있습니다.

현재 포함된 프로토타입 범위:
- setup / source planning / collection status
- imports / normalization / evidence linking
- taxpayer facts / missing facts / filing-path detection
- review queue 생성/해결
- readiness metadata를 포함한 draft 계산
- official data refresh
- HomeTax 비교 및 mismatch review 생성
- filing adjustment candidate / withholding record modeling
- HomeTax 준비 및 browser assist handoff
- final approval / submission result / receipt capture
- read-only export package

## 빠른 workflow 요약

영문 canonical README와 같은 수준의 최소 workflow는 아래와 같습니다.

1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.sources.plan_collection`
4. `tax.sources.connect` / `tax.import.*`
5. `tax.ledger.normalize`
6. `tax.profile.detect_filing_path`
7. `tax.profile.upsert_facts` / `tax.profile.list_missing_facts`
8. `tax.classify.run`
9. `tax.classify.list_review_items`
10. `tax.classify.resolve_review_item`
11. `tax.filing.compute_draft`
12. `tax.filing.refresh_official_data`
13. `tax.filing.compare_with_hometax`
14. `tax.filing.prepare_hometax`
15. `tax.browser.start_hometax_assist`
16. `tax.browser.resume_hometax_assist`
17. `tax.filing.record_submission_approval`
18. 외부 browser agent가 실제 final submit click 수행
19. `tax.browser.record_submission_result`
20. `tax.filing.export_package`

## 사용자가 개입해야 하는 순간

사용자는 아래 상황에서만 개입하면 됩니다.
- **login**
- **consent**
- **judgment**

예시:
- 로그인 / 인증
- source consent / 권한 승인
- review 판단 / mismatch 판단
- 최종 제출 승인

즉 사용자가 직접 해야 하는 일은 많지 않지만,
반대로 에이전트가 이 경계를 넘어서는 안 됩니다.

## 중요한 stop reason 예시

외부 AI agent는 아래 코드가 나오면 진행을 멈추고 사용자 또는 operator 입력을 받아야 합니다.
- `missing_consent`
- `missing_auth`
- `awaiting_review_decision`
- `awaiting_final_approval`
- `comparison_incomplete`
- `unsupported_filing_path`
- `missing_withholding_record`
- `missing_deduction_fact`
- `severe_mismatch`
- `unsupported_adjustment`
- `tier_c_stop`

## 시작 경로

### 한국어로 읽고 싶다면
1. [README.ko.md](./README.ko.md)
2. [docs/README.ko.md](./docs/README.ko.md)

### 영어 canonical을 따라가고 싶다면
1. [README.md](./README.md)
2. [docs/README.md](./docs/README.md)
3. [docs/39-agent-operator-quickstart.md](./docs/39-agent-operator-quickstart.md)

원칙은 단순합니다.
- 한국어 companion이 있으면 **ko → ko**로 읽을 수 있게 하고,
- 없을 때만 **명시적으로 (EN)** 문서로 넘어갑니다.
- 영문 기준 문서와 한국어 문서가 다르면 **영문이 canonical**입니다.

## 저장소 구성

- `docs/` — 제품, 아키텍처, workflow, 로드맵 문서
- `packages/` — core logic, MCP server, browser assist 구현 패키지
- `skills/` — OpenClaw용 tax workflow skill
- `examples/` — 예제 config / import 샘플
- `templates/` — 사용자 동의 / 입력 템플릿

## 핵심 원칙

- 중요한 단계에서만 사람 승인
- agentic collection 우선, 수동 업로드는 fallback
- 민감 데이터는 가능한 로컬 우선 처리
- 자동 분류와 초안 계산에는 audit trail 유지
- 숨겨진 자동화보다 checkpoint 기반 자동화
- 공개 아키텍처, 비공개 사용자 데이터
- docs-first implementation

## 문서 언어와 탐독 규칙

기술적 source of truth 문서는 현재 **영문이 기준**입니다.

읽기 언어 규칙:
- 영어로 읽기 시작한 사람은 영어 경로로 계속 읽을 수 있어야 합니다.
- 한국어로 읽기 시작한 사람은 한국어 companion이 있는 동안 한국어 경로로 계속 읽을 수 있어야 합니다.
- 한국어 companion이 없는 경우에만 영어 원문으로 이동합니다.
- 영문 기준 문서와 한국어 문서가 다르면 **영문이 canonical**입니다.

참고:
- [docs/README.ko.md](./docs/README.ko.md)
- [docs/README.md](./docs/README.md) (EN)
- [docs/23-documentation-language-policy.md](./docs/23-documentation-language-policy.md) (EN)

## v1에서 하지 않는 것

- 완전 무인, 무검토 세무 신고
- 세무/법률 전문가를 대체한다고 주장하는 것
- 모든 납세자 유형을 첫 버전부터 지원하는 것
- 모든 데이터 소스에 안정적 API가 있다고 가정하는 것
- 범용 “무엇이든 처리하는” 에이전트 플랫폼이 되는 것
