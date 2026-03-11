# 한국 종합소득세 입력 데이터 리서치

- 상태: companion
- 기준 원문: [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- 다음 읽기:
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)

## 목적
실제 종합소득세 신고 도메인을 블랙박스처럼 두지 않고,
**무슨 데이터를 어떤 출처에서 어느 정도 확실성으로 확보해야 환급/세액 추정과 신고 draft 준비를 책임 있게 할 수 있는지**를 제품 관점에서 정리합니다.

이 문서는 법률 자문이 아니라,
현실적인 v1 workflow를 만들기 위한 **입력 요건 지도**입니다.

## 이 문서가 답하려는 핵심 질문
한 해의 종합소득세 신고를 준비하려면 시스템이 최소한 아래를 알아야 합니다.
1. 어떤 종류의 소득이 존재하는가
2. 각 소득 범주별 금액이 어느 정도인가
3. 이미 원천징수되었거나 기납부된 세액이 무엇인가
4. 어떤 비용이 필요경비로 인정될 가능성이 있는가
5. 어떤 공제/감면은 거래내역만으로 알 수 없고 납세자 사실이 더 필요한가
6. 어떤 항목은 반드시 user review checkpoint로 올려야 하는가

## readiness를 3단계로 나눠서 봐야 함
이 프로젝트는 아래 세 가지를 명확히 구분해야 합니다.

### 1) estimate-ready
대략적인 환급/추가납부 추정이 가능한 상태입니다.
필요한 최소 조건:
- 주요 소득 흐름 파악
- 중요한 원천징수/기납부세액 파악
- 대략적인 경비 기반 또는 경비 미반영 사실 명시
- 큰 가정과 누락 항목 표시

이 단계는 기대치 확인용입니다.
제출 준비 완료 상태는 아닙니다.

### 2) draft-ready
의미 있는 신고 draft를 만들 수 있는 상태입니다.
필요한 조건:
- 소득 분류가 어느 정도 안정적임
- 원천징수/기납부세액 입력이 materially complete에 가까움
- 경비 항목이 증빙/룰/리뷰 경로를 거침
- 핵심 납세자 facts가 확보되었거나 누락이 표시됨
- 중요한 애매함은 review queue에 남아 있음

### 3) submission-ready
HomeTax 보조 입력으로 넘어갈 수 있는 상태입니다.
필요한 조건:
- 큰 소득 누락 가능성이 낮음
- 중요한 원천징수/기납부세액 누락 가능성이 낮음
- 주요 경비/공제 항목이 확인 또는 명시적 가정 처리됨
- 높은 심각도의 unresolved review가 정리됨
- 최종적으로 HomeTax 표시값과 비교할 수 있음

## v1에서 먼저 지원해야 할 사용자 축
### A. 프리랜서 / 3.3% 원천징수 가능 사용자
중요 데이터:
- 수입/입금 기록
- 원천징수 관련 명세 또는 증빙
- 필요경비 증빙
- 혼합 사용 지출에 대한 business-use 설명

핵심 리스크:
- 수입 일부는 공식 자료에 보이지만, 경비는 외부 자료에 흩어져 있을 수 있음

### B. 개인사업자
중요 데이터:
- 매출/수입
- 사업 관련 지출
- 장비/자산성 지출
- 업종/사용 목적 관련 facts

핵심 리스크:
- 거래내역만으로는 경비 처리 판단이 부족함

### C. 근로 + 부업 혼합 사용자
중요 데이터:
- 근로 관련 공식 자료
- 부업 수입/경비 자료
- 전체 원천징수/기납부세액
- 공제/감면 eligibility facts

핵심 리스크:
- 공식 prefill이 전부라고 오해할 수 있음

## 실제로 필요한 데이터 도메인
### 1) Taxpayer profile / filing facts
예:
- taxpayer type
- residency status
- 사업자 여부
- filing year
- 업종/업무 힌트
- 급여 외 소득 존재 여부
- 경비 청구 의향

### 2) Income domain
예:
- 사업/용역 소득
- 근로 외 추가 소득
- 기타 신고에 영향을 주는 소득 항목
- 각 항목의 출처, 시기, 증빙 연결

### 3) Withholding / prepaid tax domain
예:
- 3.3% 원천징수
- 이미 납부/반영된 세액
- 공식 자료상 확인 가능한 세액

이 축은 환급 추정의 신뢰성과 직결되므로 first-class로 다뤄야 합니다.

### 4) Expense domain
예:
- 반복 사업비
- 장비/자산성 지출
- 구독료, 통신비, 소모품, 외주비 등
- 혼합 사용으로 판단이 필요한 지출

### 5) Deductions / credits domain
중요 포인트:
거래내역만으로는 충분하지 않습니다.
납세자 facts, eligibility, 지원 증빙을 별도로 구조화해야 합니다.

### 6) Submission comparison domain
HomeTax 보조 입력 전에,
- workflow가 계산한 값
- HomeTax에 보이는 값
- 둘 사이의 mismatch
를 비교할 수 있어야 합니다.

## 출처별 역할 정리
### HomeTax / 공식 자료
강점:
- 신고 맥락의 anchor source
- 원천징수/명세/공식 자료
- 최종 제출 보조 경로

한계:
- 현실적인 필요경비 증빙 전체를 대신하지 못함
- business-use 설명을 제공하지 않음
- 외부 영수증/문서 맥락을 모두 포함하지 않음

### 은행 / 카드 export
강점:
- 입출금 흐름 추적
- 지출 후보 탐색
- 반복 패턴 식별

한계:
- tax treatment가 직접 드러나지 않음
- 원천징수 정보가 충분하지 않을 수 있음

### 영수증 / invoice / PDF / 업로드 문서
강점:
- 증빙 강화
- review resolution 지원
- 거래 행만으로 부족한 맥락 보완

### 사용자 입력 facts
강점:
- filing path 결정
- 공제/감면 eligibility
- mixed-use 설명
- 시스템이 추정하면 안 되는 정책성 선택

## blocker / review / tolerable uncertainty 구분
### Hard blocker
예:
- taxpayer type 불명확
- 큰 소득원 누락 가능성 큼
- 중요한 원천징수 자료 누락
- 필요한 섹션 계산 자체가 불가능

### Review item
예:
- 혼합 사용 경비
- 중복 의심 거래
- 자산성 지출 판단
- material한 공제 해석 이슈

### Tolerable uncertainty
예:
- 금액이 작고 영향이 낮은 미분류 지출
- 일부 metadata가 약하지만 전체 세액 영향이 작음

## 제품 관점 핵심 메시지
이 시스템은
“파일 몇 개 넣으면 AI가 다 알아서 해준다”
가 되어서는 안 됩니다.

대신 이렇게 설명되어야 합니다.
- 공식 자료를 먼저 모으고
- 외부 증빙을 그 다음 채우고
- confirmed / inferred / user-asserted 값을 분리하고
- material한 판단만 사용자에게 묻고
- 무엇을 알고 무엇을 모르는지 드러낸 뒤 HomeTax 보조로 넘어간다

## 다음으로 연결되는 구현 질문
이 문서 다음 단계에서 필요한 것은:
- taxpayer facts를 어떤 타입으로 둘 것인가
- withholding/prepaid tax를 어떤 first-class entity로 둘 것인가
- draft confidence를 어떻게 드러낼 것인가
- HomeTax 비교 가능한 filing field 구조를 어떻게 만들 것인가

그 질문을 다루는 문서는 다음입니다.
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
