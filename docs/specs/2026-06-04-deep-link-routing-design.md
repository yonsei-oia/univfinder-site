# Per-School Deep-Link Routing (Design Spec)

- **작성일**: 2026-06-04
- **상태**: 설계 확정 (구현 계획 작성 대기)
- **대상**: 학생 사이트(`20-1-univfinder-site`) `2027S/index.html` 단일 페이지 앱
- **관련**: `2026-06-02-univ-finder-detail-redesign-design.md`(디테일 모달)

---

## 1. 배경과 목적

대시보드를 배포하면 공개 URL이 생긴다. 지금은 277교를 카드 그리드로 보여주고, 클릭하면 디테일 **모달**이 뜬다. 모달은 URL을 갖지 않아 **특정 학교를 직접 링크할 수 없다.**

목적: 학교별 **deep-link URL**을 만들어, 파트너 대학에게 "당신 학교 페이지" URL을 공유해 본인 정보(원하는 내용이 들어갔는지)를 확인하게 한다. 공유·검증·UX(뒤로가기·북마크) 이득.

**범위 결정(대표 2026-06-04):** deep-link **만** 추가. 데이터·공개 범위는 **현행 유지**(별도 결정). 화면 형태는 **기존 모달을 URL로 자동 여는** 방식. URL은 **해시(`#/slug`)**.

---

## 2. 핵심 설계 원칙

- **기존 모달 재사용.** 새 페이지/라우터 프레임워크 도입 없음. `selectedUniversity` 상태를 URL과 양방향 동기화.
- **해시 라우팅.** `#/slug` — 서버 설정 0, 로컬(python http.server)·Netlify 모두 그대로 작동, 깨질 염려 없음.
- **slug는 기존 데이터 필드.** 각 university에 `slug`(예: `sciences-po`)가 이미 있다. 새 데이터 불필요.
- **최소 침습.** 추가는 (a) 순수 헬퍼 모듈 1개 + (b) App의 동기화 effect 2개 + hashchange 리스너.

---

## 3. 컴포넌트

### 3.1 `2027S/lib/hashroute.js` (신규, 순수)
브라우저 글로벌 + Node export (term.js/campus_map.js 패턴). node --test.
- **`slugFromHash(hash) -> string`**: `'#/vrije-universiteit-amsterdam'` → `'vrije-universiteit-amsterdam'`. `'#/'`·`''`·`'#'` → `''`. 앞쪽 `#`/`/` 제거 후 첫 세그먼트만.
- **`hashForSlug(slug) -> string`**: `'vrije-...'` → `'#/vrije-...'`. 빈 slug → `''`.

### 3.2 App 라우팅 배선 (`2027S/index.html`, App 컴포넌트)
기존 상태: `selectedUniversity`(열린 학교 or null), `setSelectedUniversity`. 카드 클릭·prev/next가 이 상태를 바꾼다.

- **URL → 상태** (effect): `universities`가 로드된 뒤, 그리고 `hashchange` 이벤트마다 — `slugFromHash(location.hash)`로 slug를 얻어 `universities.find(u => u.slug === slug)`로 학교를 찾는다. 찾으면 모달 열기(`setSelectedUniversity(found)`), slug가 없거나 매칭 실패면 모달 닫기(`setSelectedUniversity(null)`). **현재 선택과 같으면 갱신 생략**(루프 방지).
- **상태 → URL** (effect): `selectedUniversity`가 바뀌면 — 열렸으면 `location.hash = hashForSlug(u.slug)`, 닫혔으면 해시 비움. **현재 해시와 같으면 생략**(루프 방지). prev/next는 `selectedUniversity`를 거치므로 자동으로 URL이 따라온다.
- **리스너**: mount 시 `window.addEventListener('hashchange', ...)`, unmount 시 해제.

### 3.3 동기화 루프 방지
양방향 effect는 "현재값과 다를 때만 set" 가드로 idempotent하게 만든다: 해시→상태는 찾은 학교가 현재 `selectedUniversity`와 다를 때만 setState; 상태→해시는 목표 해시가 `location.hash`와 다를 때만 set. set이 다시 이벤트를 유발해도 두 번째 패스는 "같음"이라 멈춘다.

---

## 4. 데이터 흐름

```
[로드] universities 채워짐 → (해시에 slug 있으면) 해당 모달 자동 열기
[클릭/Prev/Next] setSelectedUniversity(u) → location.hash = #/u.slug
[모달 닫기] setSelectedUniversity(null) → 해시 비움
[뒤로/앞으로/URL편집] hashchange → slug로 모달 동기화
```

## 5. 엣지 케이스 / 에러 처리
- **잘못된/삭제된 slug**: 매칭 실패 → 그리드만(모달 안 뜸). 에러 표시 없음(조용히 무시).
- **비동기 로드**: 초기 해시 적용은 `universities`가 비어있지 않을 때 1회(+이후 hashchange). 데이터 로드 전 해시는 보류.
- **필터로 그리드에서 빠진 학교의 직접 링크**: `universities`(전체)에서 찾으므로, 현재 필터와 무관하게 모달은 열린다(직접 링크 우선). 닫으면 현재 필터된 그리드로 복귀.
- **정렬/필터 sessionStorage**(`27S_sortBy` 등)와 무관 — 해시는 학교 선택 전용.

## 6. 테스트
- **순수**: `hashroute.js`의 `slugFromHash`/`hashForSlug` — node --test (`2027S/tests/*.test.js`).
- **배선**: 시각 QA — (a) `#/sciences-po` URL로 진입 시 모달 자동 열림; (b) 카드 클릭 시 URL이 `#/slug`로 갱신; (c) 모달 닫으면 해시 비고 그리드; (d) 뒤로가기로 모달 닫힘/이전 학교; (e) 잘못된 slug는 그리드만.

## 7. Repo / 범위
- 학생 사이트(`20-1-univfinder-site`)만. plan 1개.
- **범위 밖**: SEO·소셜 미리보기 프리렌더, path 기반 URL, per-partner 접근제어, 데이터/공개범위 변경.

## 8. 공유 URL 예시
`https://yonsei-oia-univfinder.netlify.app/#/vrije-universiteit-amsterdam` → VU Amsterdam 디테일 모달이 열린 상태로 진입.
