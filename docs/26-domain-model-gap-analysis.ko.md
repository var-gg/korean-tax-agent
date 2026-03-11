# 실제 신고 입력 관점의 도메인 모델 갭 분석

- 상태: companion
- 기준 원문: [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
- 다음 읽기:
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)

## 목적
`25-korean-comprehensive-income-tax-data-research.ko.md`에서 정리한 도메인 입력 요구사항을 기준으로,
현재 코드와 계약이 무엇을 아직 충분히 모델링하지 못하는지 정리합니다.

핵심 질문은 이것입니다.
**지금 repo가 workflow skeleton을 넘어서 실제 한국 종합소득세 입력을 다루려면 무엇이 더 필요하나?**

## 현재 강점
이미 있는 것:
- workflow checkpoint
- source connection / resumable sync
- transaction classification
- review queue
- draft generation
- HomeTax assist 준비 상태

즉, 파이프라인의 뼈대는 꽤 갖춰져 있습니다.

## 하지만 아직 큰 빈칸이 있는 영역
현재 모델은 여전히 다음에 치우쳐 있습니다.
- transactions
- decisions
- review items
- draft summary

이것만으로는 실제 신고 준비를 책임 있게 설명하기 어렵습니다.

가장 큰 부족함은 **실제 세무 입력 도메인**입니다.

## Gap 1. Taxpayer facts가 얇다
문제:
실제 신고 readiness는 단순 `TaxpayerProfile`만으로 충분하지 않습니다.

부족한 정보 예:
- 급여 + 부업 혼합 여부
- 경비 청구 의향
- 어떤 deduction/credit eligibility가 있는지
- freelancer-like / sole-proprietor-like / mixed-income-like 같은 filing posture

필요한 방향:
- `TaxpayerFact` 또는 `FilingFact` 계층
- filing posture
- income stream checklist
- deduction eligibility fact checklist
- business-use explanation
- fact completeness status

우선순위:
- 매우 높음

## Gap 2. Withholding / prepaid tax가 first-class가 아님
문제:
환급/추가납부 추정은 이미 원천징수되었거나 기납부된 세액에 크게 좌우됩니다.
그런데 현재는 generic transaction 흐름만으로는 부족합니다.

필요한 방향:
- `WithholdingRecord` 같은 명시적 모델

최소 필드 예:
- workspaceId
- filingYear
- payerName / incomeSourceRef
- grossAmount
- withheldTaxAmount
- localTaxAmount
- sourceType / provenance
- extractionConfidence
- evidenceRefs
- reviewStatus

우선순위:
- critical

## Gap 3. Deduction / credit support가 약하다
문제:
공제/감면은 거래내역만으로는 안 나오는 경우가 많습니다.
필요한 facts, 지원 증빙, 지원 여부를 별도 추적해야 합니다.

필요한 방향:
- `DeductionFact`, `CreditFact`, 또는 `FilingAdjustmentCandidate`

최소 필드 예:
- adjustmentType
- eligibilityState
- requiredFactKeys
- providedFactKeys
- requiredEvidenceRefs
- amountCandidate
- confidence
- reviewRequired
- supportTier

우선순위:
- 높음

## Gap 4. Draft output은 summary이지 비교 가능한 filing output은 아니다
문제:
HomeTax assist가 신뢰되려면 draft가 단순 summary를 넘어서,
어느 섹션/필드에 어떤 값이 들어가야 하는지 보여줘야 합니다.

필요한 방향:
- `DraftFieldValue`
- `FilingSectionValue`
- 또는 유사한 section/field 중심 구조

최소 필드 예:
- draftId
- sectionKey / fieldKey
- value
- sourceRefs
- evidenceRefs
- confidence
- isEstimated
- requiresManualEntry
- portalComparisonState
- portalObservedValue
- mismatchSeverity

우선순위:
- 매우 높음

## Gap 5. Provenance / confidence가 일관되게 노출되지 않는다
문제:
사용자는 “왜 이 숫자가 맞다고 보는지”를 알고 싶습니다.
세무 workflow에서는 이 설명력이 신뢰의 핵심입니다.

필요한 방향:
공통 패턴으로 정리:
- `sourceOfTruthType = official | imported | inferred | user_asserted`
- `confidenceScore`
- `materiality`
- `evidenceRefs`
- `reviewStatus`

우선순위:
- 높음

## Gap 6. Coverage gap도 도메인-aware해야 한다
문제:
단순히 missing data라고 하면 부족합니다.
무엇이 빠졌는지를 구조적으로 구분해야 합니다.

예:
- `missing_income_source`
- `missing_withholding_record`
- `missing_expense_evidence`
- `missing_deduction_fact`
- `missing_submission_comparison`

우선순위:
- 높음

## Gap 7. estimate / draft / submission readiness가 분리되어야 한다
문제:
지금은 draft나 readiness를 한 덩어리로 보기 쉽습니다.
하지만 제품은 아래 세 순간의 진실을 구분해야 합니다.
- rough estimate 가능 여부
- filing draft 가능 여부
- HomeTax assist-ready 여부

필요한 방향:
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`
- `confidenceBand`
- `majorUnknowns[]`

우선순위:
- 중상

## 계약(MCP) 레벨에서 이어질 수 있는 것
향후 필요한 tool 예:
- `tax.profile.capture_facts`
- `tax.withholding.import_records`
- `tax.withholding.list_records`
- `tax.filing.list_blockers`
- `tax.filing.get_field_mapping`
- `tax.filing.compare_with_hometax`
- `tax.deductions.capture_facts`

## 단기 추천 구현 순서
1. filing input docs 강화
2. core types 확장
   - taxpayer facts
   - withholding records
   - filing field values
3. contracts/runtime에 노출
4. 그 다음 browser assist / persistence 심화

## 한 줄 결론
지금 repo의 가장 큰 남은 리스크는 아키텍처 부족보다
**도메인 입력 under-modeling**입니다.

즉 앞으로 중요한 것은:
- 어떤 세무 입력을 first-class로 올릴지,
- 그 값의 provenance와 confidence를 어떻게 드러낼지,
- HomeTax와 비교 가능한 output 구조를 어떻게 만들지
입니다.
