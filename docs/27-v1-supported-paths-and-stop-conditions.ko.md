# V1 지원 경로와 중단 조건

- 상태: companion
- 기준 원문: [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [16-v1-prd.ko.md](./16-v1-prd.ko.md)
  - [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- 다음 읽기:
  - [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
  - [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)

## 목적
이 문서는 V1에서 **우선 지원할 실제 신고 경로**와,
agent가 언제 멈추고, 보류하고, 사용자에게 제어권을 돌려줘야 하는지를 정의합니다.

핵심은 단순합니다.
V1은 모든 한국 종합소득세 신고 케이스를 똑같이 잘 지원한다고 가장하면 안 됩니다.

## 왜 이 문서가 필요한가
기존 아키텍처와 workflow 문서는 시스템이 어떻게 동작해야 하는지를 잘 설명합니다.
하지만 그것만으로는 아래 질문에 충분히 날카롭게 답하지 못합니다.

- 어떤 실제 신고 케이스를 먼저 지원할 것인가
- 어떤 케이스는 수동 개입이 많이 필요한가
- 어떤 경우엔 bluff하지 말고 멈춰야 하는가

이 경계는 신뢰를 위해 필수입니다.

## 기본 원칙
V1은 아래를 최적화해야 합니다.
- 현실적인 완료 가능성
- 정직한 readiness 보고
- 좁지만 신뢰도 높은 assisted filing
- 명시적인 사용자 checkpoint

반대로 아래를 목표로 삼으면 안 됩니다.
- 모든 신고 경로를 다 지원하는 것처럼 보이기
- 지원하지 않는 케이스를 억지로 workflow에 밀어넣기
- 도메인 불확실성을 generic automation으로 가리기

## 지원 등급 정의

### Tier A — 정식 지원 assisted path
의미:
- V1에서 정상 경로로 지원하려는 케이스
- agent가 수집, review, draft 생성, HomeTax 보조까지 이어갈 수 있음
- submission-ready draft로 갈 수 있는 신뢰 가능한 경로가 있음

### Tier B — 수동 비중이 큰 제한 지원 경로
의미:
- 일부 workflow 도움은 여전히 유효함
- 하지만 fact 입력, 증빙 처리, 포털 측 작업이 더 많이 필요함
- full submission assist 전에 멈출 수 있음

### Tier C — V1 범위 밖
의미:
- agent는 왜 미지원인지 설명할 수 있음
- 입력 정리나 blocker 파악은 도울 수 있음
- 하지만 신뢰 가능한 submission-ready 경로처럼 보이면 안 됨

## Tier A: 우선 지원 대상 경로

### 1. HomeTax 친화적인 비교적 단순한 신고 경로
특징:
- 미리 채워진 값이나 소폭 조정 흐름에 가까움
- 사용자가 계산 결과를 현실적으로 검토 가능함
- HomeTax assist의 핵심이 탐색, 비교, 확인에 있음

예시:
- 주요 공식 값이 이미 존재하는 prefilled에 가까운 흐름
- 모호성이 낮은 비교적 단순한 개인 종합소득세 신고 흐름

왜 좋은가:
- 문서 혼란이 적음
- bespoke business logic 분기가 적음
- 사용자 신뢰 루프를 빠르게 만들 수 있음

### 2. 원천징수 기록이 비교적 명확한 프리랜서형 케이스
특징:
- 소득 출처를 이해하기 쉬움
- 원천징수 또는 기납부세액 기록을 명시적으로 수집 가능함
- 경비 처리가 제한적이거나 관리 가능함
- draft 검증으로 이어지는 경로가 있음

왜 좋은가:
- 실제로 도움 수요가 많음
- 고난도 장부형 케이스보다 도메인 복잡도가 낮음

### 3. 복잡도가 제한된 혼합소득 개인 케이스
특징:
- 근로 + 부업처럼 이해 가능한 조합
- 고난도 공동/장부 복잡성이 없음
- 원천징수와 source coverage를 명시적으로 점검 가능함

왜 좋은가:
- 현실적인 사용자군임
- 제품이 source coverage와 withholding을 정직하게 모델링하도록 강제함

### 4. review gate로 통제 가능한 비교적 단순한 경비 청구 케이스
특징:
- 일부 경비가 존재함
- 하지만 양과 모호성이 아직 관리 가능함
- 애매한 항목을 추측으로 넘기지 않고 review로 노출 가능함

왜 허용 가능한가:
- review queue 설계를 현실적으로 시험할 수 있음
- 곧바로 고난도 bookkeeping 지원까지 요구하지 않음

## Tier B: 수동 비중이 큰 제한 지원 경로
이 경로들은 V1에서도 일부 유용할 수 있지만, 설명을 매우 조심해야 합니다.

### 1. 더 넓은 fact capture가 필요한 일반 신고 경로
예시:
- deduction / credit 자격이 거래내역만으로는 드러나지 않는 경우
- 사용자가 여러 수기 설명이나 증빙 묶음을 제공해야 하는 경우

기대 동작:
- fact와 증빙을 정리하고
- blocker를 노출하며
- assumption과 warning이 있는 draft를 만들고
- confidence가 높은 부분만 assist

### 2. 신고 기간 중 공식 데이터 변경 영향이 큰 케이스
예시:
- official refresh에 따라 값이 실질적으로 바뀔 수 있는 신고
- estimate는 가능하지만 안정적인 submission readiness를 아직 장담하기 어려운 경우

기대 동작:
- refresh, diff, recompute, comparison 지원
- 첫 draft를 최종본처럼 취급하지 않음

### 3. 추가 세무 처리 로직이 필요한 creator / platform income 케이스
예시:
- 해외 원천징수 또는 플랫폼 발행 증빙이 있는 경우
- source 수집은 가능하지만 도메인 처리 제품화가 아직 깊지 않은 경우

기대 동작:
- 기록을 명시적으로 보존하고
- 추가 review 필요성을 드러내며
- 지원 등급이 충족되지 않으면 confident한 submission assist 전에 멈춤

## Tier C: V1 범위 밖 경로
정확한 경계는 나중에 조정될 수 있지만, V1에서는 아래를 기본적으로 범위 밖으로 봐야 합니다.

### 1. bookkeeping 비중이 높은 고난도 신고
예시:
- 상당한 수준의 사업 장부 유지가 필요한 경우
- 복잡한 회계 재구성이 필요한 경우
- business-use 배분이 매우 복잡해서 V1 review 지원으로 감당하기 어려운 경우

### 2. 다자간 / 배분 구조가 복잡한 케이스
예시:
- 공동 또는 분배 해석이 중요한 상황
- 공유소득 / 배분소득 해석 요구가 큰 경우

### 3. workflow 지원보다 전문 최적화가 본질인 케이스
예시:
- 여러 합법적 세무 처리 방법 중 최적화를 선택해야 하는 상황
- 오픈소스 V1 제품 posture로 감당하기 어려운 법적 해석 리스크가 큰 경우

## submission-ready로 보기 위한 필수 입력 축
거래내역을 가져왔다는 이유만으로 submission-ready라고 보면 안 됩니다.
최소한 아래 입력 축에서 충분한 coverage가 있어야 합니다.

### 1. 신고 경로 결정 입력값
예시:
- filing year
- residency / filing context
- taxpayer posture
- 공식 또는 사용자 제공 사실에서 나온 filing-path clue
- 필요한 경우 사업자등록 / 사업 맥락 힌트

### 2. 소득 인벤토리
예시:
- 소득 카테고리
- 지급자 또는 source 단서
- 포착된 소득원과 누락된 소득원 구분
- 발생 시기
- evidence linkage

### 3. 원천징수 / 기납부세액 기록
예시:
- 원천징수 기록
- 기납부세액 단서
- 필요한 경우 지방세 관련 금액
- provenance와 review 상태

### 4. 경비 및 증빙 coverage
예시:
- 청구 후보 경비
- 연결된 증빙
- 필요한 경우 business-use 설명
- 미해결 모호성 개수

### 5. 공제 / 세액공제 사실관계
예시:
- fact checklist
- 필요한 증빙
- support-tier 라벨
- 미지원 또는 deferred category

### 6. 신고 필드 매핑 및 비교 준비 상태
예시:
- 섹션별 draft field value
- manual-entry flag
- assumptions
- HomeTax 화면값과의 mismatch 상태

## Submission readiness 레벨
제품은 최소한 아래 레벨을 구분해야 합니다.

### Estimate-ready
의미:
- 대략적 결과를 낼 수 있는 입력은 있음
- 하지만 여전히 중요한 unknown이 남아 있음

### Draft-ready
의미:
- 구조화된 filing draft가 존재함
- 주요 assumption과 blocker가 드러남
- 그러나 submission assist는 아직 막혀 있을 수 있음

### Submission-assist-ready
의미:
- 지원 경로에서 필요한 blocker가 해소되었고
- HomeTax field mapping이 가능하며
- agent가 명시적 사용자 checkpoint와 함께 제출 보조를 진행할 수 있음

즉 “ready” 하나로 뭉뚱그리지 말고,
여러 readiness 레벨을 구분해야 합니다.

## 중단 조건
아래 중 하나라도 해당하면 agent는 멈추거나, pause하거나, 주장 강도를 낮춰야 합니다.

### Stop 1. 미지원 신고 경로가 감지됨
예시:
- 케이스가 명확히 Tier C에 해당함
- 또는 신고 경로를 안전하게 판별할 수 없음

필수 동작:
- 지원 경계를 설명
- 수집된 사실은 보존
- 안전한 submission-ready처럼 보이게 하지 않음

### Stop 2. 중요한 source coverage가 누락됨
예시:
- 가능성 높은 소득원이 아직 수집되지 않음
- 중요한 원천징수 기록이 없음
- 의미 있는 경비 청구에 필요한 증빙이 없음

필수 동작:
- 명시적 coverage gap 생성
- 다음 수집 우선순위 제시
- confidence를 과장하지 않음

### Stop 3. 높은 심각도의 review item이 미해결임
예시:
- 혼합사용 경비 모호성
- 중요한 duplicate conflict
- 영향이 큰 사실관계 불확실성

필수 동작:
- draft 진행 또는 submission readiness 보류
- 명시적 review 경로로 넘김

### Stop 4. Draft와 HomeTax 비교가 미완료이거나 중대한 mismatch가 있음
예시:
- 필요한 section mapping이 되지 않음
- HomeTax 화면값과 draft 값이 실질적으로 다름
- refresh 이후 portal 상태가 바뀜

필수 동작:
- mismatch를 노출
- 조용한 덮어쓰기보다 검증 우선
- 해결되거나 의식적으로 수용되기 전까지 최종 제출 차단

### Stop 5. 필요한 사용자 checkpoint가 없음
예시:
- source consent 미부여
- 인증 미완료
- 최종 제출 승인 미확인

필수 동작:
- resume 가능한 checkpoint로 pause
- 완료를 꾸며내지 않음

### Stop 6. official data freshness를 신뢰할 수 없음
예시:
- official refresh에서 값 변경이 감지됨
- 신고 기간 중 업데이트로 기존 draft가 무효화될 수 있음
- 현재 포털 데이터가 최신인지 검증 불가

필수 동작:
- refresh
- diff
- recompute
- compare를 다시 거친 뒤 submission readiness 판단

## 사람에게 넘겨야 하는 조건
지원 경로 안에서도 아래 경우에는 명시적 handoff가 필요합니다.
- 사용자가 직접 인증 또는 포털 조작을 해야 할 때
- 중요한 모호성이 사람 판단을 요구할 때
- manual-only 지원 등급에 도달했을 때
- 사용자가 직접 takeover를 원할 때

## MCP / 상태 모델과의 연결
이 문서는 workflow surface와 state model에 아래 개념이 필요하다는 뜻입니다.
- filing-path detection
- withholding record tracking
- readiness level 구분
- field-level draft mapping
- HomeTax comparison state
- domain-aware coverage gap

참고:
- [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)

## 요약
V1은 의도적으로 좁아야 합니다.
신뢰할 수 있는 V1은:
- 어떤 신고 경로를 지원하는지 분명히 말하고
- estimate-ready와 submission-ready를 구분하며
- 중요한 도메인 불확실성에서는 멈추고
- 최종 제출 단계까지 사용자가 보이는 통제권을 갖게 만드는 제품입니다.
