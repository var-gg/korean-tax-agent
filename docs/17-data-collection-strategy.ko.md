# Data Collection Strategy (Korean Companion)

> 참고:
> - 이 문서는 `17-data-collection-strategy.md`의 한국어 companion 문서입니다.
> - 기술 정본은 영문 문서입니다.
> - 차이가 있을 경우 영문 문서가 우선합니다.
>
> See also:
> - `17-data-collection-strategy.md`
> - `23-documentation-language-policy.md`

## 목적
이 시스템은 에이전트가 **신고 관련 데이터를 가능한 한 많이 스스로 수집**하되,
사용자는 다음처럼 진짜 의미 있는 checkpoint에서만 개입하도록 설계되어야 합니다.
- 동의(consent)
- 인증(authentication)
- 애매한 항목 해소
- 최종 제출 승인

이 문서는 이상적인 완전 자동화를 말하는 것이 아니라,
**현실적인 수집 posture**를 정의합니다.

## 운영 원칙
선호되는 수집 순서는 다음과 같습니다.
1. agent-led connector discovery
2. scoped consent
3. browser-mediated 또는 provider-mediated authentication by the user
4. agent-driven extraction, normalization, and reconciliation
5. gap 또는 risk-changing ambiguity에 대해서만 targeted follow-up questions

시스템은 manual-upload 관점에서 시작하면 안 됩니다.
manual upload는 여전히 필요할 수 있지만,
그것은 **fallback이지 1차적인 제품 정체성은 아닙니다.**

## 수집 모드

### 1. Direct connector mode
provider가 안정적이고 허용 가능하며 실용적인 integration 경로를 제공할 때 사용합니다.

전형적인 흐름:
- agent가 사용 가능한 connector를 나열함
- user가 source scope를 승인함
- user가 인증함
- agent가 records와 documents를 sync함
- 허용되는 경우 이후 refresh는 기존 consent scope 안에서 진행됨

적합한 사용처:
- 안정적인 operator-controlled connector
- durable session 또는 token semantics를 가진 source
- repeat sync 시나리오

주요 리스크:
- provider policy 변경
- token/session 만료
- access pattern을 둘러싼 법적/상업적 제약

### 2. Browser-assisted collection mode
stable public API는 없지만,
일반적인 사용자 웹 플로우를 통해 source 접근이 가능할 때 사용합니다.

전형적인 흐름:
- agent가 visible browser path를 엶
- user가 login, identity confirmation, one-time security step을 수행함
- agent가 navigation과 extraction을 다시 이어서 수행함
- 또 다른 실제 user checkpoint가 필요할 때만 다시 멈춤

적합한 사용처:
- HomeTax와 유사한 포털
- human-first login flow를 가진 규제 포털
- 데이터는 있지만 API 지원이 약하거나 없는 download 페이지

주요 리스크:
- UI drift
- anti-bot friction
- security keyboard, captcha, unexpected interstitial
- brittle selector 또는 일관성 없는 document label

### 3. Export-ingestion mode
가장 현실적인 경로가 source 자체에서 파일이나 statement를 export하고,
그 결과물을 agent가 ingest하는 방식일 때 사용합니다.

전형적인 흐름:
- agent가 user를 올바른 export 화면으로 안내함
- user가 export를 실행하거나 download를 확인함
- 접근 가능하면 agent가 생성된 artifact를 자동 ingest함
- agent가 imported artifact를 normalize하고 filing workspace에 연결함

적합한 사용처:
- bank/card statements
- brokerage transaction exports
- tax portal bulk materials
- evidence bundles

주요 리스크:
- format drift
- 일관되지 않은 naming convention
- missing metadata
- 반복 export 사이클에서 duplicate import 발생

### 4. Targeted fact capture mode
접근 가능한 기록에서 데이터를 안정적으로 수집하거나 추론할 수 없을 때만 사용합니다.

전형적인 흐름:
- agent가 분류나 신고를 막는 missing fact를 탐지함
- agent가 focused question을 던짐
- user가 한 번 답함
- 답변은 단순 chat text가 아니라 structured workspace state가 됨

적합한 사용처:
- taxpayer profile details
- business-use ratio 또는 mixed-use clarification
- unsupported tax treatment
- unusual transaction explanation

주요 리스크:
- 과도하게 쓰면 신뢰도 저하
- broad/vague question이 많으면 user fatigue 발생

## source 카테고리

### Tax authority portals
예:
- HomeTax
- 관련 국세 workflow 및 다운로드 자료

선호 모드:
- browser-assisted collection 우선
- bulk document가 가능하면 export-ingestion 병행

이유:
- 많은 신고 관련 자료에서 가장 authoritative한 source이기 때문
- 동시에 direct user authentication과 visible control이 필요한 경우가 많기 때문

### Financial institutions
예:
- banks
- card issuers
- brokerages
- payment services

선호 모드:
- truly stable and allowed 하면 direct connector
- 아니면 export-ingestion 또는 browser-assisted collection

이유:
- financial record는 reconciliation과 evidence에 중요함
- 많은 provider가 강한 anti-automation 정책과 불안정한 export 품질을 가짐

### Evidence/document sources
예:
- local folders
- synced drives
- email attachments
- messaging-delivered receipts

선호 모드:
- connector 또는 local-access ingestion
- transaction gap 기반 targeted retrieval

이유:
- 보조 증빙은 정식 세무 시스템 밖에 있는 경우가 많음
- agent는 필요한 범위 안에서만 증빙을 찾아야지, 스코프 없이 모든 걸 훑어서는 안 됨

### User-provided facts
예:
- taxpayer type
- household 또는 deduction 관련 사실
- mixed-use explanation
- missing counterparty context

선호 모드:
- targeted fact capture

이유:
- 어떤 신고 판단은 record만으로는 해결할 수 없음

## 현실 기반 설계 규칙

### Rule 1. 이상적인 API가 아니라 현실적으로 접근 가능한 시스템에서 출발할 것
많은 한국 세무 인접 시스템에서는,
깔끔한 public API보다 visible browser workflow와 exported artifact가 더 현실적인 접근 경로일 수 있습니다.

### Rule 2. 인증은 user action, 추출은 agent action
제품은 사용자에게 다음 기대를 학습시켜야 합니다.
- 사용자가 로그인하거나 보안 challenge를 통과한다
- 그 checkpoint 전후의 반복적인 navigation, extraction, linking, reconciliation은 agent가 수행한다

### Rule 3. fallback은 first-class여야 함
모든 타겟 source에는 문서화된 fallback path가 있어야 합니다.
현실적인 제품은 모든 connector 성공을 가정하는 제품이 아니라,
**실패하거나 막혀도 우아하게 degrade하는 제품**입니다.

### Rule 4. 시스템은 한 번에 전부 모으지 말고 점진적으로 수집해야 함
에이전트는 모든 source가 연결되기 전까지 가치를 못 주는 구조가 되어선 안 됩니다.
partial workspace를 만들고,
missing coverage를 식별하고,
새 source가 연결될수록 draft를 점진적으로 개선해야 합니다.

### Rule 5. missing data 자체가 구조화된 state여야 함
데이터를 수집할 수 없었다면 시스템은 다음을 기록해야 합니다.
- 무엇을 시도했는지
- 왜 실패했는지
- 신고의 어떤 영역이 영향을 받는지
- 다음 최선의 행동이 무엇인지

## v1에서 바람직한 제품 posture
V1은 스스로를 다음처럼 보여야 합니다.
- agentic
- checkpoint-driven
- browser-capable
- consent-aware
- partial collection success에도 resilient함

V1은 다음처럼 보이면 안 됩니다.
- fully silent automation
- 모든 기관에 대한 universal live integration
- 모든 filing source를 API 기반으로 보장하는 시스템

## 추천 v1 source 전략

### Tier 1. 반드시 설계해야 할 것
- HomeTax browser-assisted access and document gathering
- filing workspace fact intake
- local and operator-approved evidence/document ingestion
- exported statement와 tax material의 repeatable ingestion

### Tier 2. 부분 구현이어도 인터페이스는 설계해야 할 것
- bank/card/brokerage connector abstraction
- source sync lifecycle과 re-auth semantics
- provider capability discovery

### Tier 3. 이후 확장
- broad institution coverage
- provider-specific optimization
- 여러 기관에 걸친 recurring refresh
- communication tool 또는 cloud storage에서의 richer automatic evidence retrieval

## workspace 시사점
filing workspace는 단순 raw file만 추적하면 안 되고,
**collection state 자체를 추적**해야 합니다.

최소 상태 영역:
- source registry
- consent records
- auth checkpoints
- sync attempts
- imported artifacts
- normalized transactions/documents
- unresolved coverage gaps
- review items
- draft versions
- audit events

## 사용자 경험 목표
좋은 실행은 다음처럼 느껴져야 합니다.
- agent가 어떤 데이터를 왜 원하는지 설명한다
- user는 필요할 때만 scope를 승인하고 로그인한다
- agent는 지속적인 prompting 없이도 계속 진행한다
- 막히면 sharp하고 high-value한 질문만 한다
- 새로운 source가 연결될수록 draft가 점점 완성된다

## 제품 테스트
워크플로우가 여전히 대부분 “파일 좀 더 업로드해 주세요”처럼 느껴진다면,
제품은 아직 충분히 agentic하지 않습니다.

반대로,
“필요할 때 로그인만 하면 되고, 정말 나를 필요로 할 때 전까지는 agent가 나머지를 처리한다”처럼 느껴진다면,
설계 방향은 맞게 가고 있는 것입니다.
