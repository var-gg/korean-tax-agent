# HomeTax 제출 보조 흐름

- 상태: companion
- Doc role: companion
- Locale: ko
- 기준 원문: [08-hometax-submission-flow.md](./08-hometax-submission-flow.md) (EN)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
- 다음 읽기:
  - [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)

## 목적
사용자에게 **보이는 통제권**을 유지하면서 HomeTax 제출 보조를 지원하는 것입니다.

browser-assist 레이어는 사용자를 더 빠르게 움직이게 도와야 하지만,
신고 과정이 보이지 않거나 통제 불가능하게 느껴지게 하면 안 됩니다.

## 운영 원칙
- silent automation이 아니라 assisted flow
- fire-and-forget이 아니라 checkpoint-driven flow
- pause/resume 친화적 구조
- submit 전 명시적 최종 승인 필수

## 제안 end-to-end 흐름
### Phase 1. Readiness check
1. 사용자가 filing workflow 시작
2. agent가 draft readiness 확인
3. unresolved review item 상태 확인
4. critical review item이 남아 있으면 진행 차단

기대 출력:
- draft version
- warning summary
- unresolved blocker summary
- HomeTax-assist readiness flag

### Phase 2. Session start
1. browser assist가 HomeTax 흐름 열기
2. system이 assist session id 생성
3. agent가 다음 checkpoint 설명

기대 출력:
- assist session id
- 현재 target screen/section
- auth required flag

### Phase 3. Authentication checkpoint
1. 사용자가 필요한 HomeTax 인증 수행
2. agent는 인증 성공을 추측하지 않고 대기
3. 인증 완료가 감지되거나 사용자에게 확인된 후에만 재개

규칙:
- 로그인/인증 단계는 사용자가 직접 수행
- auth는 blocking checkpoint로 모델링
- 인증 성공이 최종 제출 승인을 의미하지는 않음

### Phase 4. Section navigation and field mapping
1. agent가 신고 section 탐색
2. system이 draft value를 HomeTax section/field에 매핑
3. unsupported / ambiguous / blocked field를 명확히 노출

가능한 field state:
- `auto_fill_ready`
- `manual_confirmation_required`
- `manual_entry_required`
- `blocked`
- `mismatch_detected`

### Phase 5. Assisted population
1. 안전한 필드는 agent가 입력
2. 수동 확인이 필요한 지점에서는 pause
3. draft 값과 화면상 HomeTax 값의 mismatch를 기록

중요 규칙:
- 보이는 mismatch를 사용자에게 알리지 않고 조용히 덮어쓰면 안 됨

### Phase 6. Pre-submit review
1. submit 전 최종 요약 제시
2. 요약에는 최소한 아래가 포함되어야 함
   - filing year
   - 주요 income/expense/deduction total
   - unresolved non-blocking warning
   - 수동 처리된 field
   - 자동 검증하지 못한 section

### Phase 7. Final approval gate
1. 사용자가 최종 제출을 명시적으로 승인
2. system이 submission consent 기록
3. 그 이후에만 최종 submit step 실행 가능

### Phase 8. Submission result handling
1. system이 제출 성공 / 실패 / 불확실 상태 기록
2. agent가 결과와 next step 요약
3. 결과가 모호하면 false success보다 `unknown/pending verification`를 우선

## Pause/resume 모델
browser flow는 최소한 아래 지점에서 interruption을 지원해야 합니다.
- auth 전
- auth 후
- 새 filing section 진입 전
- mismatch 탐지 시
- 최종 제출 직전

권장 session 필드:
- `assistSessionId`
- `workspaceId`
- `draftId`
- `checkpoint`
- `lastKnownSection`
- `authState`
- `pendingUserAction`
- `startedAt`
- `updatedAt`

## 명시적으로 다뤄야 할 failure mode
- HomeTax UI 변경으로 selector mapping 실패
- 중간에 인증 만료
- assist session 중 draft version 변경
- field value가 예상 매핑과 다름
- 필요한 supporting material 누락
- 브라우저 세션이 예기치 않게 닫힘

## v1 정책 한 줄
최종 제출은 조용히 처리하지 않습니다.
**마지막 확인은 항상 사용자에게 보이고, 사용자 통제 하에 있어야 합니다.**
