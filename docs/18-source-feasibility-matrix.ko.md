# 소스 실현 가능성 매트릭스

- 상태: companion
- 기준 원문: [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
- 다음 읽기:
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)

## 목적
구현이 특정 connector에 과하게 묶이기 전에,
주요 source category별로 **현실적인 수집 경로**를 정리합니다.

이 문서는 정량 스펙이 아니라 질적 판단 문서입니다.
제품과 엔지니어링이 다음을 결정하는 데 도움을 줍니다.
- 무엇을 v1에 반영해야 하는가
- 무엇은 live validation이 필요한가
- 무엇은 fallback path로 남겨야 하는가

## 실현 가능성 레이블
- **v1-design**: 지금 아키텍처와 계약에 반영해야 함
- **v1-prototype**: 초기 프로토타입에서 검증할 가치가 큼
- **later**: 중요하지만 초반 실행을 과도하게 좌우하면 안 됨
- **fallback-only**: 백업 경로로 지원, 제품 정체성의 중심은 아님

## 1. HomeTax 포털
대상 데이터:
- 납세자에게 보이는 신고 자료
- 다운로드 가능한 세무 문서
- 가능하다면 prefilled input과 신고 상태
- 최종 제출 경로

가장 현실적인 수집 경로:
- browser-assisted collection
- 포털이 export를 허용하면 export-ingestion

주요 blocker:
- 로그인 / 본인확인
- UI 변경
- 간헐적 anti-automation friction
- 납세자 유형에 따라 달라지는 경로/문서명

필수 user action:
- 인증
- 큰 checkpoint에서의 명시적 승인
- 최종 제출 승인

판단:
- **v1-design** + **v1-prototype**
- 가장 먼저 검증해야 할 핵심 현실 source

## 2. 은행 거래내역
대상 데이터:
- 수입 추적과 경비 증빙에 관련된 입출금
- 메모 / 상대방 단서

권장 경로:
- export-ingestion 우선
- 가능하면 browser-assisted collection
- direct connector는 안정성과 허용 범위가 확인될 때만

주요 blocker:
- 기관별 로그인 마찰
- OTP / 2차 인증
- 제각각인 export format

필수 user action:
- 로그인 또는 export 확인

판단:
- **v1-design**
- 구현은 narrow initial set 또는 generic export workflow 위주가 적절

## 3. 카드 거래내역
대상 데이터:
- 지출 기록
- 가맹점 설명
- 시각 / 금액

권장 경로:
- export-ingestion 우선
- statement retrieval가 예측 가능하면 browser-assisted collection

주요 blocker:
- metadata 품질 한계
- anti-bot friction
- 카드사별 상이한 statement 구조

필수 user action:
- 필요 시 로그인 / export 확인

판단:
- **v1-design**
- issuer-specific connector 난립보다 generic statement ingestion부터 시작하는 편이 좋음

## 4. 증권 / 브로커리지 계좌
대상 데이터:
- 관련 있는 realized gains/losses
- dividend / withholding records
- account statements

권장 경로:
- export-ingestion 우선
- 로그인 후 statement 접근 가능하면 browser-assisted retrieval

주요 blocker:
- 상품 복잡도
- 자산 유형별 세무 처리 차이
- 기관별 export 특이성

판단:
- **v1-design**
- 풍부한 자동화는 **later**가 더 현실적

## 5. 로컬 파일시스템 / 승인된 폴더
대상 데이터:
- 영수증
- invoice
- PDF statement
- 스크린샷 / 임시 증빙

권장 경로:
- explicit scope 기반 local-access ingestion
- 무차별 전체 스캔이 아니라 missing evidence 기준 targeted scan

주요 blocker:
- 지저분한 파일명
- 중복
- 약한 metadata

판단:
- **v1-design** + **v1-prototype**
- 현실 가치가 높고 통합 리스크는 비교적 낮음

## 6. 클라우드 드라이브
대상 데이터:
- 동기화된 영수증, invoice, export된 세무 자료

권장 경로:
- 가능하면 connector retrieval
- 아니면 local synced-folder 접근

주요 blocker:
- provider policy 제약
- 권한 범위 관리 복잡성
- 관련 없는 noisy file

판단:
- **v1-design**
- direct connector는 practical validation 이후 **later** 가능

## 7. 이메일 첨부파일
대상 데이터:
- invoice
- 카드 명세서
- 증권 알림
- 세무 통지

권장 경로:
- targeted retrieval
- 또는 user-approved export/search workflow

주요 blocker:
- 광범위한 privacy scope
- 발신자/문서 일관성 부족
- attachment parsing 편차

판단:
- direct integration은 **later**
- 가치 있지만 privacy/noise 때문에 첫 connector로는 부적합

## 8. 메신저로 전달된 영수증/명세
대상 데이터:
- 판매자/플랫폼이 보낸 임시 증빙

권장 경로:
- targeted retrieval 또는 local export ingestion

주요 blocker:
- 플랫폼 제약
- privacy risk
- poor structure

판단:
- 초기에는 **fallback-only**

## 9. 사용자 입력 taxpayer facts
대상 데이터:
- taxpayer type
- residency / filing context
- business-use 설명
- edge-case clarification

권장 경로:
- 대화 기반 targeted fact capture

주요 blocker:
- 사용자 본인의 불확실성
- 질문 과다 피로

판단:
- **v1-design** + **v1-prototype**
- 피할 수 없는 source이며 구조화가 중요함

## 한 줄 결론
v1의 중심은
- HomeTax를 anchor source로 삼고,
- 은행/카드/로컬 파일은 export-ingestion 중심으로 가며,
- taxpayer facts를 first-class로 수집하고,
- privacy-heavy direct connector는 뒤로 미루는 것
입니다.
