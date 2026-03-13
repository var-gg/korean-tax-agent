# 문서 인덱스 (한국어)

**언어:** [English](./README.md) | [한국어](./README.ko.md)

- 상태: active
- Doc role: router
- Locale: ko
- Canonical docs index: [README.md](./README.md) (EN)
- Parent: [../README.ko.md](../README.ko.md)
- Related: [23-documentation-language-policy.md](./23-documentation-language-policy.md) (EN)

이 문서는 **한국어 기준으로 repo를 읽고 이해하기 위한 공식 진입점**입니다.
기술 정본(spec)은 영어 문서이지만, 한국어 독자가 GitHub에서 길을 잃지 않도록 **한국어 reading path**를 닫힌 그래프로 제공합니다.

## 제품 포지셔닝 요약

Korean Tax Agent는:
- **한국 종합소득세 workflow 제품**을 만들고,
- 그 중심에 **host-agnostic MCP core**를 두며,
- 그 위에 런타임별 integration/example을 선택적으로 얹는 구조를 지향합니다.

즉 OpenClaw 전용이 아니라,
여러 agent runtime에서 이해하고 붙일 수 있는 형태를 목표로 합니다.

## 읽기 원칙

- 영어 문서가 기준(spec)입니다.
- 한국어 문서는 companion / router 역할을 가집니다.
- 한국어 companion이 있으면 **한국어 문서를 우선** 링크합니다.
- 한국어 companion이 없을 때만 영어 원문으로 이동합니다.
- 영어 문서로 넘어갈 때는 반드시 **(EN)** 또는 **원문**으로 표시합니다.
- 사용자가 한국어로 읽기 시작했다면, 가능한 한 **ko -> ko** 흐름이 유지되어야 합니다.

## 한국어 추천 읽기 순서

### 처음 보는 경우
1. [00-overview.ko.md](./00-overview.ko.md)
2. [16-v1-prd.ko.md](./16-v1-prd.ko.md)
3. [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
4. [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
5. [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
6. [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
7. [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

### 아키텍처 / 상태 모델을 보고 싶다면
다음 순서를 권장합니다.
1. [05-architecture.ko.md](./05-architecture.ko.md)
2. [06-data-model.ko.md](./06-data-model.ko.md)
3. [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
4. [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
5. [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
6. [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
7. [10-skill-design.md](./10-skill-design.md) (EN)

### 수집 / 신뢰 경계를 보고 싶다면
1. [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
2. [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md)
3. [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
4. [07-consent-model.md](./07-consent-model.md) (EN)
5. [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)

### 리뷰 / 리스크 / 거버넌스를 보고 싶다면
1. [11-review-queue.md](./11-review-queue.md) (EN)
2. [04-risk-and-compliance.md](./04-risk-and-compliance.md) (EN)
3. [12-security-storage.md](./12-security-storage.md) (EN)
4. [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
5. [14-open-source-strategy.md](./14-open-source-strategy.md) (EN)

### 구현 계획을 보고 싶다면
1. [13-implementation-roadmap.md](./13-implementation-roadmap.md) (EN)
2. [15-backlog.md](./15-backlog.md) (EN)
3. [06-data-model.ko.md](./06-data-model.ko.md)

## 문서 계층

### 1) 제품 개요 / 범위
- [00-overview.ko.md](./00-overview.ko.md) — 제품 개요 (한국어)
- [01-product-principles.md](./01-product-principles.md) (EN) — 제품 원칙
- [02-user-journey.md](./02-user-journey.md) (EN) — 사용자 여정
- [03-scope-and-non-goals.md](./03-scope-and-non-goals.md) (EN) — 범위와 비목표
- [16-v1-prd.ko.md](./16-v1-prd.ko.md) — V1 PRD (한국어)
- [16-v1-prd.md](./16-v1-prd.md) (EN) — V1 PRD 원문

### 2) 리스크 / 신뢰 / 리뷰
- [04-risk-and-compliance.md](./04-risk-and-compliance.md) (EN) — 리스크와 컴플라이언스
- [07-consent-model.md](./07-consent-model.md) (EN) — 동의 모델
- [11-review-queue.md](./11-review-queue.md) (EN) — review queue
- [12-security-storage.md](./12-security-storage.md) (EN) — 보안/저장

### 3) 아키텍처 / 상태 모델 / 계약
- [05-architecture.ko.md](./05-architecture.ko.md) — 상위 아키텍처 (한국어)
- [05-architecture.md](./05-architecture.md) (EN) — 상위 아키텍처 원문
- [06-data-model.ko.md](./06-data-model.ko.md) — 데이터 모델 (한국어)
- [06-data-model.md](./06-data-model.md) (EN) — 데이터 모델 원문
- [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md) — MCP tool spec (한국어)
- [09-mcp-tool-spec.md](./09-mcp-tool-spec.md) (EN) — MCP tool spec 원문
- [10-skill-design.md](./10-skill-design.md) (EN) — skill 설계
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md) — workspace 상태 모델 (한국어)
- [20-workspace-state-model.md](./20-workspace-state-model.md) (EN) — workspace 상태 모델 원문
- [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md) — core type 갭 분석 (한국어)
- [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md) (EN) — core type 갭 분석 원문
- [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md) — workflow state machine (한국어)
- [24-workflow-state-machine.md](./24-workflow-state-machine.md) (EN) — workflow state machine 원문

### 4) 수집 / 홈택스 / 실행 흐름
- [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md) — HomeTax 제출 보조 흐름 (한국어)
- [08-hometax-submission-flow.md](./08-hometax-submission-flow.md) (EN) — HomeTax 제출 보조 흐름 원문
- [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md) — 데이터 수집 전략 (한국어)
- [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md) — 소스별 실현 가능성 매트릭스 (한국어)
- [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md) (EN) — 소스별 실현 가능성 매트릭스 원문
- [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md) — 인증/동의 흐름 (한국어)
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md) — 첫 agentic 시나리오 (한국어)

### 5) 도메인 리서치 / 최근 추가 문서
- [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md) — 실제 종소세 입력 데이터 관점 정리 (한국어)
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md) — 코드/모델 갭 분석 (한국어)
- [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md) — V1 지원 경로와 중단 조건 (한국어)
- [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md) (EN) — 영문 원문
- [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md) (EN) — 영문 원문
- [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md) (EN) — 영문 원문
- [28-three-party-happy-path.md](./28-three-party-happy-path.md) (EN) — 사용자 / 에이전트 / MCP 3자 happy path와 단계별 노티 및 설계 공백 점검
- [29-source-strategy-for-real-tax-work.md](./29-source-strategy-for-real-tax-work.md) (EN) — 실제 종소세 업무에서 무엇이 anchor 자료이고 무엇이 enrichment 자료인지, source planning을 어떻게 봐야 하는지 정리
- [30-source-planning-conversation.md](./30-source-planning-conversation.md) (EN) — HomeTax-first / local-first / export-first 등 source planning 대화를 사용자 / 에이전트 / MCP 관점에서 구체화
- [31-source-collection-blocked-path.md](./31-source-collection-blocked-path.md) (EN) — UI 변경, export_required, provider block, readiness downgrade 등 blocked path를 사용자 / 에이전트 / MCP 관점에서 구체화
- [32-readiness-calibration-by-input-coverage.md](./32-readiness-calibration-by-input-coverage.md) (EN) — 파일 개수나 draft 존재 여부가 아니라 도메인 coverage 기준으로 estimate / draft / submission readiness를 어떻게 보정할지 정리
- [33-runtime-and-mcp-fields-for-readiness-and-coverage.md](./33-runtime-and-mcp-fields-for-readiness-and-coverage.md) (EN) — readiness / coverage / blocker / major unknowns를 runtime과 MCP 응답 필드로 어떻게 구체화할지 정리
- [34-proposed-type-shapes-for-runtime-coverage-and-readiness.md](./34-proposed-type-shapes-for-runtime-coverage-and-readiness.md) (EN) — workspace readiness, coverage, blocker, gap, draft calibration, MCP readiness state를 위한 TypeScript 친화 타입 제안

### 6) 운영 / 로드맵 / 프로젝트 관리
- [13-implementation-roadmap.md](./13-implementation-roadmap.md) (EN) — 구현 로드맵
- [14-open-source-strategy.md](./14-open-source-strategy.md) (EN) — 오픈소스 전략
- [15-backlog.md](./15-backlog.md) (EN) — backlog
- [23-documentation-language-policy.md](./23-documentation-language-policy.md) (EN) — 문서 언어 정책

## 현재 한국어 문서 상태

### 이미 존재
- [../README.ko.md](../README.ko.md)
- [00-overview.ko.md](./00-overview.ko.md)
- [05-architecture.ko.md](./05-architecture.ko.md)
- [06-data-model.ko.md](./06-data-model.ko.md)
- [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
- [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
- [16-v1-prd.ko.md](./16-v1-prd.ko.md)
- [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
- [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md)
- [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
- [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
- [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
- [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

### 다음 한국어 보강 우선순위
1. [01-product-principles.md](./01-product-principles.md) (EN)
2. [02-user-journey.md](./02-user-journey.md) (EN)
3. [07-consent-model.md](./07-consent-model.md) (EN)
4. [04-risk-and-compliance.md](./04-risk-and-compliance.md) (EN)
5. [11-review-queue.md](./11-review-queue.md) (EN)

## 문서 메타 규칙
앞으로 핵심 문서 상단에는 가능하면 아래 정보를 추가합니다.
- Status
- Doc role
- Locale
- Canonical
- Parent
- Related
- Read next

목표는 단순 번역이 아니라,
**한국어 기준으로도 논리 흐름이 이어지는 문서 시스템**을 만드는 것입니다.
