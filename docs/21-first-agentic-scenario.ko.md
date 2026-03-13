# First Agentic Scenario (Korean Companion)

- 상태: companion
- Doc role: companion
- Locale: ko
- 기준 원문: [21-first-agentic-scenario.md](./21-first-agentic-scenario.md) (EN)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
- 다음 읽기:
  - [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
  - [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

## 목적
이 프로젝트가 가장 먼저 최적화해야 할 **첫 end-to-end 시나리오**를 설명합니다.

이 시나리오는 의도된 V1 지원 경계 안에 있어야 합니다.
모든 신고 경로를 다 지원할 수 있음을 증명하려는 문서는 아닙니다.
참고:
- [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

이 문서는 가장 넓은 범위의 워크플로우를 설명하려는 것이 아닙니다.
오히려, 제품이 정말로 **agentic**하게 느껴지는지를 검증할 수 있는 가장 좁고 현실적인 경로를 정의합니다.

즉:
- 사용자는 에이전트와 대화하고,
- 사용자는 신뢰/인증 checkpoint만 통과하고,
- 에이전트는 반복적인 수집/정리 작업을 수행하고,
- 시스템은 관리 가능한 review queue가 붙은 draft를 만든다,
라는 감각을 증명해야 합니다.

## 시나리오 정의
### 대상 사용자
- AI 도구를 사용할 수 있는 한국 종합소득세 신고 대상자
- HomeTax 접근이 가능함
- 최소한 일부 금융자료 export 또는 로컬 증빙 파일에 접근 가능함
- 필요한 follow-up 질문에는 답할 의향이 있음

### 목표 결과
- filing workspace가 생성됨
- HomeTax 자료가 수집되거나 부분 수집됨
- 필요 시 추가 export 증빙이 ingest됨
- 애매한 항목은 review queue로 표면화됨
- 첫 draft summary가 생성됨
- workflow가 `HomeTax-assist-ready` 상태 또는 명확한 blocked 상태와 다음 단계 안내에 도달함

지원 경계 가정:
- 이 첫 시나리오는 Tier A 또는 Tier A에 가까운 경로를 대표해야 함
- bookkeeping-heavy하거나 명확히 범위 밖인 케이스를 대표 시나리오로 삼지 않음

## 서사 흐름

### Step 1. 사용자가 신고 워크플로우를 시작함
사용자는 특정 연도 신고 준비를 원한다고 말합니다.

에이전트는:
- workspace를 만들거나 선택하고
- 꼭 필요한 프로필 질문만 하고
- 데이터를 점진적으로 모아보겠다고 설명합니다.

기대 효과:
- workspace는 `initialized` 이후 `collecting_sources` 방향으로 이동
- 초기 taxpayer facts가 기록됨

### Step 2. 에이전트가 첫 수집 경로를 계획함
에이전트는 다음으로 가장 가치 높은 source를 식별합니다.
첫 시나리오에서는 보통 HomeTax가 우선입니다.

에이전트는 대략 이렇게 말합니다:
- 신고 자료와 cross-check 측면에서 가치가 가장 높기 때문에 먼저 HomeTax를 연결하려고 합니다.

기대 효과:
- source planning output이 기록됨
- HomeTax source가 `planned` 또는 `awaiting_consent` 상태로 들어감

### Step 3. 사용자가 범위가 명확한 동의를 부여함
에이전트는 source scope를 명확하게 요청합니다.

예:
- 2025 신고 workspace를 위해 HomeTax 자료 접근을 허용해 주세요.

기대 효과:
- consent record가 기록됨
- source가 auth 준비 상태가 됨

### Step 4. 사용자가 인증을 완료함
시스템이 HomeTax 경로를 열고,
사용자는 로그인 및 필요한 보안 단계를 완료합니다.

이 구간에서 에이전트는 말을 과하게 하지 않습니다.
사용자가 무엇을 하면 되는지, 그리고 다음에 무슨 일이 일어나는지만 설명합니다.

기대 효과:
- auth checkpoint 기록
- source가 `ready`가 되거나 즉시 sync 시작

### Step 5. 에이전트가 수집을 수행함
로그인 후 에이전트는 다시 이어서 진행합니다.
보이는 신고 관련 정보를 탐색하고, 수집 가능한 다운로드 자료를 ingest합니다.

가능한 결과:
- 완전 성공
- 일부 화면 막힘이 있는 부분 성공
- export-required checkpoint
- provider/UI blockage

기대 효과:
- sync attempt에 진행상황과 결과가 기록됨
- artifact가 생성됨
- 막힌 경로도 vague failure가 아니라 구조화된 fallback suggestion으로 남음

### Step 6. 에이전트가 정규화와 coverage 평가를 수행함
에이전트는 raw artifact를 normalized transaction, document, evidence link로 변환합니다.
또한 무엇이 아직 비어 있는지도 점검합니다.

예시:
- 의미 있는 비용인데 증빙이 없음
- reconciliation을 위해 bank/card history가 더 필요함
- deduction 판단에 필요한 taxpayer fact가 빠져 있음

기대 효과:
- normalized ledger가 업데이트됨
- 필요한 경우 coverage gap 생성
- 다음 수집 추천이 가능해짐

### Step 7. 에이전트는 정말 필요한 범위에서만 수집을 확장함
중요한 coverage gap이 남아 있으면, 에이전트는 다음 최적 행동을 제안합니다.

예:
- 내려받은 명세서가 있는 폴더를 ingest하게 해 주세요
- 이 비용들을 reconcile하려면 카드 명세서 export 하나가 필요합니다
- 이 비용이 개인/사업 혼합 사용인지 질문 하나가 필요합니다

에이전트는 “전부 업로드해 주세요” 같은 넓은 요청보다,
**정밀한 후속 요청**을 선호해야 합니다.

기대 효과:
- second-wave collection 또는 fact capture가 high-value gap 중심으로만 일어남

### Step 8. 에이전트가 분류를 실행하고 review queue를 생성함
시스템은 정규화된 데이터를 분류하고 compact한 review queue를 만듭니다.

사용자에게 보여야 하는 것은 진짜 중요한 항목만이어야 합니다.
예:
- low-confidence classification
- 의미 있는 비용인데 missing evidence
- source conflict 또는 duplicate
- high-risk tax judgment call

기대 효과:
- review item 생성
- 안전한 경우 review batch 생성

### Step 9. 사용자가 타겟된 질문만 해결함
에이전트는 더 적고 더 날카로운 질문을 합니다.
사용자는 confidence나 tax risk를 실질적으로 바꾸는 항목에만 답합니다.

기대 효과:
- review item 해결
- 승인된 override는 durable decision이 됨
- 새 draft 계산 가능

### Step 10. 에이전트가 첫 draft를 계산함
시스템은 assumption, warning, unresolved blocker, 그리고 명시적인 readiness level을 포함한 draft summary를 만듭니다.

에이전트는 다음을 설명합니다.
- 무엇을 수집했는지
- 무엇이 아직 불확실한지
- 결과가 `estimate-ready`, `draft-ready`, `submission-assist-ready` 중 어디인지
- 실제로 HomeTax assist로 넘어갈 준비가 되었는지

기대 효과:
- draft version 생성
- readiness level 기록
- workspace가 `draft_ready_for_review`로 이동하거나, 명확한 이유와 함께 blocked 상태 유지

### Step 11. 에이전트가 HomeTax assist를 준비하거나 솔직하게 멈춤
draft가 `submission-assist-ready`이고, 케이스가 여전히 지원 경계 안에 있다면 HomeTax assist preparation 단계로 갈 수 있습니다.
그렇지 않다면, 시스템은 다음 행동을 명시한 채 솔직하게 멈춰야 합니다.

첫 시나리오에서 허용 가능한 결과:
- HomeTax assist 준비 완료
- 마지막 source 또는 review decision 하나 때문에 blocked
- 한계가 명확히 보이는 partial draft 생성
- `draft-ready`까지만 가능하고 submission assist는 아직 시작할 수 없다는 점을 명시적으로 설명

## 이 시나리오의 성공 기준
사용자가 다음처럼 느끼면 성공입니다.
- 내가 직접 workflow를 조율할 필요가 없었다
- consent, login, 실제 판단이 필요한 순간에만 개입했다
- checkpoint 사이에서는 에이전트가 계속 진전했다
- 남은 gap이 명확하게 설명되었다

## 실패 기준
다음처럼 느껴지면 제품 실패로 봐야 합니다.
- 그냥 그럴듯한 upload wizard 같다
- vague한 질문을 반복한다
- blocked state가 숨겨져 있거나 혼란스럽다
- 무엇을 수집했고 무엇을 못 모았는지 사용자가 알 수 없다

## 왜 이 시나리오가 중요한가
이 시나리오는 제품의 진실성 테스트입니다.

이게 동작하면 프로젝트에는 진짜 agentic core가 있는 것입니다.
이게 동작하지 않으면, 나중에 connector나 automation을 더 붙여도 결국 더 복잡한 비-agentic workflow만 만들어질 가능성이 큽니다.
