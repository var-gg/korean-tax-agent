# Overview (Korean Companion)

> 참고:
> - 이 문서는 `00-overview.md`의 한국어 companion 문서입니다.
> - 기술 정본은 영문 문서입니다.
> - 차이가 있을 경우 영문 문서가 우선합니다.
>
> See also:
> - `00-overview.md`
> - `23-documentation-language-policy.md`

## 제품 정의

Korean Tax Agent는 **한국 종합소득세 신고 준비** 대상자 중,
AGENT AI 도구를 실제로 활용할 수 있는 사람들을 위한 오픈소스, 에이전트 네이티브 워크플로우입니다.

이 프로젝트는 다음을 결합합니다.
- setup guidance
- consent-aware data collection
- transaction normalization
- tax review workflows
- filing draft generation
- optional HomeTax browser assistance

## 사용자 약속

저장소를 checkout하고 setup을 마친 뒤에는,
에이전트가 가능한 한 신고 준비 흐름을 이어가되 사용자에게는 꼭 필요한 순간에만 다음을 요청해야 합니다.
- 명시적 데이터 접근 동의
- 필요한 본인확인/인증 단계
- 애매한 세무 항목에 대한 확인
- 제출 직전 최종 승인

## 제품의 형태

이 프로젝트는 단순한 MCP server 하나가 아닙니다.
다음이 결합된 시스템입니다.
- docs
- skill instructions
- MCP tools
- browser-assist flows
- templates and examples

제품 자체는 의도적으로 **한국 특화**입니다.
즉, 한국 종합소득세 워크플로우와 HomeTax 인접 보조 흐름에 중심을 둡니다.

다만 일부 workflow building block은 다른 곳에도 참고 가능하도록 설계할 수 있습니다.
예를 들면:
- consent checkpoints
- review queues
- resumable sync flows
- workspace state models
- audit trails

하지만 이것이 곧 이 프로젝트가 전 세계 모든 나라의 세무 엔진이 되겠다는 뜻은 아닙니다.
재사용 가능한 층은 **좁고 workflow-oriented한 수준**으로 유지하는 것이 목적입니다.

## 핵심 가치

- 반복적인 세무 준비 작업을 줄인다
- 누락된 증빙과 빠진 문서를 줄인다
- 애매한 항목을 숨기지 않고 review 가능하게 만든다
- 에이전트 사용자에게 self-host 가능하고 inspect 가능한 실제 신고 준비 워크플로우를 제공한다
