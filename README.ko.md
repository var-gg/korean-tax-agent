# Korean Tax Agent

> 한국어 문서 읽기 인덱스: [docs/README.ko.md](./docs/README.ko.md)


**언어:** [English](README.md) | [한국어](README.ko.md)

한국의 **종합소득세 신고 준비**를 위한 오픈소스, 에이전트 네이티브 워크플로우입니다.

> 참고:
> - 기술 정본 문서는 현재 **영문**이 기준입니다.
> - 이 문서는 공개 소개와 온보딩을 위한 한국어 companion 문서입니다.
> - 영문 문서와 차이가 있을 경우 영문 문서가 우선합니다.
>
> See also:
> - [README.md](./README.md)
> - [docs/23-documentation-language-policy.md](./docs/23-documentation-language-policy.md)

## 이 프로젝트는 무엇인가

이 프로젝트는 한국 종합소득세 신고 대상자 중에서,
**AGENT AI 도구를 실제로 사용할 수 있는 사람들**을 위한 워크플로우를 만듭니다.

핵심은 다음과 같습니다.
- 세무 준비 과정의 반복 작업을 줄이고,
- 필요한 시점에만 사용자 승인/로그인/확인을 요청하고,
- 애매하거나 위험한 항목만 리뷰 큐로 올리고,
- 신고 초안을 만들고,
- 필요하면 HomeTax 입력까지 브라우저 보조 형태로 이어주는 것.

즉, “자료를 전부 먼저 업로드하세요”가 아니라,
**“필요할 때 로그인하고 승인하면 에이전트가 흐름을 계속 진행하는 구조”**를 목표로 합니다.

## 이 프로젝트가 지향하는 경계

이 프로젝트는 **범용 글로벌 세무 엔진**을 목표로 하지 않습니다.

우리는 우선적으로 다음 문제에 집중합니다.
- 한국 종합소득세 신고 준비
- 한국 사용자의 실제 자료수집 흐름
- HomeTax 보조 입력과 검토 중심 자동화
- 사람 승인 기반의 세무 워크플로우

다만 구현 과정에서 나오는 일부 패턴은 다른 규제성 워크플로우에도 참고될 수 있습니다.
예를 들면:
- consent checkpoint
- review queue
- resumable sync
- workspace state model
- audit trail

즉,
- **제품 범위는 한국 종합소득세에 집중**하고,
- **일부 워크플로우 primitive는 재사용 가능하게 설계**하는 방향입니다.

## 현재 상태

현재 이 저장소는 **실행 가능한 프로토타입(executable prototype)** 단계로 올라와 있습니다.

즉:
- 핵심 workflow contract 문서가 정리되어 있고,
- in-memory MCP runtime으로 end-to-end 흐름을 실제 실행해볼 수 있으며,
- 종소세 준비 흐름의 주요 체크포인트가 프로토타입 코드로 연결되어 있습니다.

현재 프로토타입 범위에는 다음이 포함됩니다.
- 신고 경로(filing path) 판별
- 리뷰 큐 생성과 해결
- readiness metadata를 포함한 draft 계산
- official data refresh
- HomeTax 비교
- mismatch를 review item으로 승격
- mismatch 해결 결과를 draft에 반영
- HomeTax 준비 및 browser assist handoff

## 먼저 읽으면 좋은 문서

처음 보는 경우 아래 순서를 추천합니다.
1. [README.md](./README.md)
2. [docs/00-overview.md](./docs/00-overview.md)
3. [docs/16-v1-prd.md](./docs/16-v1-prd.md)
4. [docs/17-data-collection-strategy.md](./docs/17-data-collection-strategy.md)
5. [docs/21-first-agentic-scenario.md](./docs/21-first-agentic-scenario.md)

전체 문서 인덱스는 [docs/README.md](./docs/README.md)를 보면 됩니다.

## 현재 프로토타입 워크플로우 요약

지금 프로토타입에서 이어지는 대표 흐름은 아래와 같습니다.
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

실행 예시는 아래로 확인할 수 있습니다.
- `npm run smoke:workflow`

## 저장소 구성

- `docs/` — 제품, 아키텍처, 워크플로우, 로드맵 문서
- `packages/` — core logic, MCP server, browser assist 구현 패키지
- `skills/` — OpenClaw용 tax workflow skill
- `examples/` — 예제 fixture / import 샘플
- `templates/` — 사용자 동의 / 입력 템플릿

## 핵심 원칙

- 중요한 단계에서만 사람 승인
- 가능하면 agentic collection 우선, 수동 업로드는 fallback
- 민감 데이터는 가능한 로컬 우선 처리
- 자동 분류와 초안 계산에는 audit trail 유지
- 숨겨진 자동화보다 checkpoint 기반 자동화
- 공개 아키텍처, 비공개 사용자 데이터

## v1에서 하지 않는 것

- 완전 무인, 무검토 세무 신고
- 세무/법률 전문가를 대체한다고 주장하는 것
- 모든 납세자 유형을 첫 버전부터 지원하는 것
- 모든 데이터 소스에 안정적 API가 있다고 가정하는 것
- 범용 “무엇이든 처리하는” 에이전트 플랫폼이 되는 것
