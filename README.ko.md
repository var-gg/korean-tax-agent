# Korean Tax Agent

**언어:** [English](README.md) | [한국어](README.ko.md)

한국의 **종합소득세 신고 준비**를 위한 오픈소스, 에이전트 네이티브 워크플로우입니다.

이 저장소는 **한국 종합소득세 workflow용 host-agnostic MCP core**와, 여러 agent runtime에서 선택적으로 붙일 수 있는 integration/example 레이어를 함께 만드는 프로젝트입니다.
즉 OpenClaw, Codex 계열 앱, Claude 계열 agent workspace 등 **어떤 호스트를 쓰더라도 붙일 수 있는 구조**를 지향합니다.

## 제품 메시지

이 프로젝트는 다음을 목표로 하지 않습니다.
- 글로벌 범용 세무 엔진
- 모든 것을 대신하는 범용 에이전트 플랫폼
- 사용자 모르게 끝까지 진행되는 완전 자동 세무 신고

이 프로젝트는 다음을 목표로 합니다.
- 한국 종합소득세 신고 준비 workflow
- agent-guided 수집 / 검토 / 초안 생성 / HomeTax 보조 입력
- consent-gated / checkpoint-driven 운영
- 여러 agent runtime이 채택할 수 있는 portable MCP surface

한 줄로 정리하면:
- **제품 범위:** 한국 종합소득세 workflow
- **핵심 인터페이스:** host-agnostic MCP contract + state model
- **런타임 자세:** 특정 브릿지/메신저 종속이 아니라 여러 agent runtime에서 사용 가능
- **제출 자세:** silent automation이 아니라 assisted / explicit flow

## 왜 이 프로젝트가 필요한가

한국 세무 신고는 단순 계산 문제가 아니라 **워크플로우 문제**입니다.

사용자는 실제로 다음을 해야 합니다.
- 여러 소스에서 자료를 모으고,
- 누락되거나 애매한 근거를 해소하고,
- 위험한 분류 항목을 검토하고,
- API처럼 다루기 어려운 정부-facing 단계를 직접 통과해야 합니다.

그래서 이 프로젝트는 세무 신고를 하나의 계산기나 폼이 아니라,
**에이전트가 이어주는 workflow**로 다룹니다.

## 현재 상태

현재 이 저장소는 **실행 가능한 프로토타입(executable prototype)** 단계입니다.

즉:
- 핵심 workflow contract 문서가 정리되어 있고,
- in-memory MCP runtime으로 end-to-end 흐름을 실행해볼 수 있으며,
- 분류부터 HomeTax 준비까지 주요 checkpoint가 프로토타입 코드로 연결되어 있습니다.

현재 포함된 프로토타입 범위:
- filing path 판별
- review queue 생성/해결
- readiness metadata를 포함한 draft 계산
- official data refresh
- HomeTax 비교
- mismatch를 review item으로 승격
- mismatch 해결 결과를 draft에 반영
- HomeTax 준비 및 browser assist handoff

최소 real-browser bridge는 `SystemBrowserRuntimeAdapter`로 제공되고, 그 위에 host-agnostic browser-host runtime seam과 첫 concrete `OpenClawBrowserHostExecutor` adapter가 추가되었습니다.
현재 범위는 stable한 open/status/checkpoint handoff까지만이며, DOM 자동화나 HomeTax field-level interaction은 아직 범위 밖입니다.

## 시작 경로

### 한국어로 읽고 싶다면
아래 순서로 시작하면 됩니다.
1. [README.ko.md](./README.ko.md)
2. [docs/README.ko.md](./docs/README.ko.md)
3. [docs/00-overview.ko.md](./docs/00-overview.ko.md)
4. [docs/16-v1-prd.ko.md](./docs/16-v1-prd.ko.md)
5. [docs/17-data-collection-strategy.ko.md](./docs/17-data-collection-strategy.ko.md)
6. [docs/21-first-agentic-scenario.ko.md](./docs/21-first-agentic-scenario.ko.md)

### 영어로 읽고 싶다면
영어 경로는 여기서 시작합니다.
1. [README.md](./README.md) (EN)
2. [docs/README.md](./docs/README.md) (EN)

원칙은 단순합니다.
- 한국어 companion이 있으면 **ko -> ko**로 읽을 수 있게 하고,
- 없을 때만 **명시적으로 (EN)** 문서로 넘어갑니다.

## 현재 프로토타입 워크플로우 요약

지금 프로토타입의 대표 흐름은 아래와 같습니다.
1. `tax.profile.detect_filing_path`
2. `tax.classify.run`
3. `tax.classify.list_review_items`
4. `tax.filing.compute_draft`
5. `tax.classify.resolve_review_item`
6. `tax.filing.compute_draft` 재계산
7. `tax.filing.refresh_official_data`
8. `tax.filing.compare_with_hometax`
9. mismatch가 있으면 review item 생성 및 해결
10. `tax.filing.prepare_hometax`
11. `tax.browser.start_hometax_assist`

실행 예시:
- `npm run smoke:workflow`

## 저장소 구성

- `docs/` — 제품, 아키텍처, workflow, 로드맵 문서
- `packages/` — core logic, MCP server, browser assist 구현 패키지
- `skills/` — OpenClaw용 tax workflow skill
- `examples/` — 예제 config / import 샘플
- `templates/` — 사용자 동의 / 입력 템플릿

## 핵심 원칙

- 중요한 단계에서만 사람 승인
- 가능하면 agentic collection 우선, 수동 업로드는 fallback
- 민감 데이터는 가능한 로컬 우선 처리
- 자동 분류와 초안 계산에는 audit trail 유지
- 숨겨진 자동화보다 checkpoint 기반 자동화
- 공개 아키텍처, 비공개 사용자 데이터
- docs-first implementation

## 문서 언어와 탐독 규칙

기술적 source of truth 문서는 현재 **영문이 기준**입니다.
이건 유지합니다.

하지만 읽기 경험은 별개로 다룹니다.

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
