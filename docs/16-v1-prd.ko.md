# V1 PRD

- 상태: companion
- 기준 원문: [16-v1-prd.md](./16-v1-prd.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [00-overview.ko.md](./00-overview.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
  - [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
- 다음 읽기:
  - [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md)
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)

## 1. 제품
Korean Tax Agent는 한국 종합소득세 신고 준비를 위한 오픈소스, agent-native workflow입니다.

V1은 AI 사용에 익숙한 사용자가 아래를 더 쉽게 하도록 돕는 데 집중합니다.
- 관련 세무 자료 수집
- 자료 정규화 및 분류
- 애매한 항목 효율적으로 검토
- 신고 가능한 draft 생성
- 필요하면 HomeTax 인접 입력 작업을 가시적인 browser assistance로 진행

## 2. 타깃 사용자
핵심 타깃:
- 한국 종합소득세 신고 대상자
- AI agent와 로컬/셀프호스팅 도구 사용에 거부감이 적은 사람
- 중요한 세무 판단은 직접 검토할 의향이 있는 사람
- 완전 자동화보다는 반복적인 신고 작업 감소를 원하는 사람

초기 사용자 archetype:
- 프리랜서 / 계약직
- 1인 사업자
- 부업 수입이 있는 혼합소득 개인
- 초기 설정 복잡도를 감수하더라도 이후 시간을 절약하고 싶은 early adopter

## 3. 사용자 문제
현재 종합소득세 신고가 힘든 이유는 사용자가 직접:
- 여러 조각난 출처에서 자료를 모아야 하고
- 거래내역과 증빙을 수동으로 정리해야 하며
- 애매한 분류를 반복해서 판단해야 하고
- HomeTax를 워크플로우 지원이 부족한 상태에서 다뤄야 하고
- 중요한 항목이 조용히 빠지지 않았는지 계속 불안해해야 하기 때문입니다.

## 4. V1 약속
V1은 사용자가 다음처럼 느끼게 해야 합니다.
- "세금 자료를 하나의 workflow로 모을 수 있다."
- "반복적인 구조화 작업은 agent가 처리한다."
- "정말 중요한 항목에만 시간을 쓴다."
- "위험한 판단과 최종 제출은 내가 통제한다."

## 5. 핵심 Job To Be Done
1. 특정 연도 신고 workspace 초기화
2. 관련 source material 연결 또는 가져오기
3. 거래내역과 증빙 정규화
4. 세무 처리 가능성 분류
5. 애매하거나 위험한 항목만 review로 올리기
6. draft summary 계산
7. HomeTax-ready mapping 준비
8. pause/resume 가능한 browser entry assist 제공

## 6. V1 범위 안
- 로컬 / 셀프호스팅 사용 posture
- 문서/파일 기반 import
- HomeTax 자료 import
- transaction normalization
- evidence linkage
- low-confidence / high-risk 항목용 review queue
- filing draft generation
- 가시적인 HomeTax browser assistance
- 명시적 consent + audit trail 모델
- supported / limited / out-of-scope filing path를 구분해서 설명하는 support-boundary communication
- `estimate-ready`, `draft-ready`, `submission-assist-ready`를 구분하는 readiness reporting

## 7. V1 범위 밖
- 사용자 checkpoint 없이 조용히 끝까지 가는 완전 자율 신고
- MyData급 광범위 규제 연동
- 첫날부터 모든 한국 세금 양식/페르소나 지원
- 세무사 수준의 전문 자문 대체
- 모든 edge case에서 법적 정확성 보장 약속
- 멀티테넌트 SaaS 운영 플랫폼
- unsupported path 또는 manual-heavy path를 안전한 submission-ready처럼 보이게 만드는 것

## 8. UX 원칙
1. **Review compression**
   - 낮은 가치의 많은 단계를 몇 개의 의미 있는 검토 순간으로 압축한다.
2. **Visible control**
   - 민감한 단계가 일어날 때 사용자가 항상 이해할 수 있어야 한다.
3. **Traceability**
   - 출력은 source fact와 review decision으로 거슬러 올라갈 수 있어야 한다.
4. **Checkpoint-driven automation**
   - checkpoint 사이 구간은 강하게 자동화하되, checkpoint를 조용히 넘기지는 않는다.
5. **Local-first trust posture**
   - 민감한 납세자 데이터는 가능한 한 로컬에 둔다.

## 9. 성공 기준
V1 workflow는 타깃 사용자가 다음을 할 수 있으면 성공입니다.
- filing workspace 생성
- 대표적인 문서/거래 import
- draft summary 생성
- 감당 가능한 review queue 해소
- 현재 케이스가 `estimate-ready`, `draft-ready`, `submission-assist-ready` 중 어디인지 이해
- supported-path 조건이 실제로 충족되었을 때만 HomeTax-assist-ready 상태 도달
- 무슨 일이 일어났는지에 대한 신뢰를 잃지 않고 제출 준비 완료

## 10. 성공 지표
초기 검증용 제품 지표:
- time-to-first-draft
- imported records 100건당 review item 수
- confidence threshold 이상 자동 분류 비율
- HomeTax workflow에서 제거된 수동 copy/paste 단계 수
- submission stage 전 unresolved blocker 수

## 11. 리스크
주요 리스크:
- HomeTax UI drift로 browser assist 신뢰성 저하
- 사용자별 import 데이터 품질 편차
- 세무 분류 애매함이 예상보다 큼
- consent prompt 과다가 UX를 망침
- 반대로 consent prompt 부족이 신뢰/위험 문제를 만듦

## 12. V1 결과물
- docs-backed product spec
- core domain types
- MCP tool contract layer
- review queue model
- HomeTax assist state/checkpoint model
- 최소 runnable prototype path

## 13. 릴리스 기준
아래가 충족되기 전에는 V1 완료로 부르지 않습니다.
- import -> normalize -> classify -> review -> draft 흐름이 일관됨
- consent checkpoint가 명시적임
- HomeTax assist checkpoint가 모델링됨
- supported filing path와 stop condition이 명확히 문서화됨
- 시스템이 `estimate-ready`, `draft-ready`, `submission-assist-ready`를 구분함
- 사용자 신뢰를 위해 output auditability가 충분함
- 초기 오픈소스 사용자가 아키텍처를 이해할 만큼 문서가 충분함
