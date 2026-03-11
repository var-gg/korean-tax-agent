# Agentic Auth and Consent Flow (Korean Companion)

> 참고:
> - 이 문서는 `19-agentic-auth-and-consent-flow.md`의 한국어 companion 문서입니다.
> - 기술 정본은 영문 문서입니다.
> - 차이가 있을 경우 영문 문서가 우선합니다.
>
> See also:
> - `19-agentic-auth-and-consent-flow.md`
> - `23-documentation-language-policy.md`

## 목적
source 연결, 인증, 데이터 수집, 민감한 workflow 전환 과정에서,
에이전트가 사용자와 **어떻게 상호작용해야 하는지**를 정의합니다.

원하는 경험은 다음과 같습니다.
- 에이전트가 workflow를 계속 전진시킨다
- 사용자는 진짜 trust, identity, judgment checkpoint에서만 개입한다
- 시스템은 risk-changing action을 절대 숨기지 않는다

## 핵심 상호작용 모델
워크플로우는 대략 다음처럼 느껴져야 합니다.
1. agent가 다음으로 유용한 source 또는 action을 설명한다
2. agent가 scope가 있는 approval을 요청한다
3. user가 login 또는 필요한 confirmation을 수행한다
4. agent가 collection을 자동으로 재개한다
5. agent는 blocked 상태이거나 risk가 실질적으로 바뀌는 경우에만 follow-up 질문을 한다

## 핵심 원칙
authentication은 **checkpoint**입니다.
consent는 **decision**입니다.

두 개는 종종 가까운 시점에 일어나지만,
같은 것이 아닙니다.

## 상호작용 단계

### Stage 1. 다음 collection step을 계획함
connector나 browser flow를 열기 전에, agent는 다음을 설명해야 합니다.
- 어떤 source에 접근하려는지
- 왜 그게 유용한지
- 어떤 데이터 카테고리가 예상되는지
- 사용자가 로그인하거나 확인해야 하는 일이 있는지

이 설명은 짧고 operational해야 하며,
법률 문구처럼 딱딱해서는 안 됩니다.

### Stage 2. 범위가 있는 source access consent 획득
agent는 사용자가 이해할 수 있는 언어로 source access consent를 요청해야 합니다.

좋은 예:
- 2025 신고 workflow를 위해 HomeTax 자료 접근을 허용해 주세요

나쁜 예:
- 앞으로 모든 source에 대해 모든 금융 행동을 허용해 주세요

이후 source scope가 실질적으로 확장되면,
agent는 다시 물어야 합니다.

### Stage 3. authentication checkpoint 시작
인증이 필요할 때 시스템은 다음을 해야 합니다.
- 관련 flow를 visible하게 연다
- 사용자가 다음에 정확히 무엇을 해야 하는지 알려준다
- checkpoint가 완료되기 전까지는 계속 진행할 수 있는 척하지 않는다

예:
- HomeTax에 로그인하고 자료 페이지에 도착하면 알려주세요
- 은행 로그인과 승인 prompt를 끝내면, 그다음 제가 명세서를 이어서 가져오겠습니다

### Stage 4. agent work 자동 재개
authentication이 끝나면, agent는 low-value confirmation을 또 묻지 말고 collection을 재개해야 합니다.

로그인 후 자동으로 진행되어야 하는 작업 예:
- 관련 화면으로 navigation
- 승인된 자료 다운로드 또는 extraction
- filing workspace로 ingestion
- normalization과 duplicate detection
- coverage analysis

### Stage 5. 필요할 때만 targeted follow-up 질문
agent는 아래 경우에만 사용자를 다시 끊어야 합니다.
- 새로운 민감 source가 필요함
- 새로운 authentication event가 필요함
- 브라우저 단계가 막힘
- high-impact review decision이 필요함
- 수집된 데이터로는 추론할 수 없는 missing fact가 있음
- final submission approval이 필요함

## prompt 품질 기준
좋은 prompt는 세 가지 질문에 답해야 합니다.
- 내가 지금 무엇을 해달라는 건가?
- 왜 필요한가?
- 내가 하고 나면 다음엔 무슨 일이 일어나는가?

예:
- 브라우저 창에서 HomeTax에 로그인해 주세요. 로그인되면 제가 이용 가능한 신고 자료를 가져와서 2025 workspace에 정리하겠습니다.

## 피해야 할 안티패턴
- collection을 시도하기도 전에 일단 전부 업로드하라고 하기
- 같은 source scope 안에서 반복적으로 승인 요청하기
- login 완료를 나중의 final submission permission처럼 취급하기
- “추가로 알아야 할 게 있나요?” 같은 vague question 던지기
- 실패한 collection attempt를 숨기고 structured next step으로 바꾸지 않기

## checkpoint taxonomy

### Checkpoint A. Source consent
필요한 경우:
- 새로운 민감 source를 연결할 때
- 기존 source scope를 확장할 때

예상 사용자 행동:
- 요청된 scope를 승인하거나 거절함

### Checkpoint B. Authentication
필요한 경우:
- 사용자가 직접 로그인해야 할 때
- provider가 step-up verification을 요구할 때
- 인증된 session이 만료되었을 때

예상 사용자 행동:
- login 또는 verification 완료

### Checkpoint C. Collection blocker
필요한 경우:
- browser path가 바뀌었을 때
- download에 user click이 필요할 때
- captcha 또는 자동화 불가능한 단계가 나타났을 때

예상 사용자 행동:
- 좁은 범위의 액션을 수행하고 control 반환

### Checkpoint D. Review judgment
필요한 경우:
- tax treatment가 애매하지만 material할 때
- 중요한 deduction 또는 expense에 evidence가 없을 때
- source conflict를 자동으로 reconcile할 수 없을 때

예상 사용자 행동:
- 옵션을 고르거나 fact를 제공함

### Checkpoint E. Final submission
필요한 경우:
- filing draft가 준비되었고 시스템이 외부 제출 또는 export 직전에 있을 때

예상 사용자 행동:
- 명시적 승인

## resume semantics
시스템은 pause와 resume를 자연스럽게 지원해야 합니다.
resume된 session은 다음을 보존해야 합니다.
- source context
- current checkpoint
- 이미 부여된 consent scope
- 아직 유효한 current auth state
- pending user action
- partial collection result

agent는 다음처럼 말할 수 있어야 합니다.
- HomeTax 자료와 은행 export는 이미 수집했습니다. 다음으로는 카드 포털 로그인만 해주시면 지출 내역을 이어서 가져오겠습니다.

## failure handling posture
collection path가 실패했다고 해서 generic failure로 무너지면 안 됩니다.
agent는 실패를 분류하고, 다음 최선의 움직임을 제안해야 합니다.

권장 failure class:
- missing_consent
- missing_auth
- ui_changed
- blocked_by_provider
- export_required
- insufficient_metadata
- unsupported_source

각 failure마다 시스템은 다음을 기록해야 합니다.
- 무엇을 시도했는지
- 무엇이 실패했는지
- 어떤 user action 또는 fallback이 추천되는지

## experience benchmark
좋은 실행은 사용자가 마치 이런 operator와 일하는 것처럼 느껴져야 합니다.
- 다음에 무엇을 가져와야 할지 알고 있다
- 당신은 trust와 identity checkpoint에서만 필요하다
- 그 gate만 통과하면 나는 계속 진행한다
- 당신 몰래 세무 판단을 내리지 않는다

## MCP 설계와의 관계
MCP surface는 이 상호작용 모델에 깔끔하게 대응하는 tool을 노출해야 합니다.
즉 다음을 명시적으로 지원해야 합니다.
- source planning and discovery
- consent-required responses
- auth-required responses
- progress와 pause/resume handling
- collection attempt summary
- fallback recommendation field
