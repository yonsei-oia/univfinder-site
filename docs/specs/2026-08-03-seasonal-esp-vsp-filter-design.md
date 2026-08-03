# 계절 대시보드 ESP/VSP 타입 필터 설계

- 작성일: 2026-08-03
- 상태: 설계 승인 (대표 승인 2026-08-03)
- 대상 repo: 프론트 `20-1-univfinder-site` (site-only, 백엔드 무관)
- 관련: [[2026-07-23-seasonal-update-history-design]], `2027S/lib/seasonal.js`, 정규 세그먼트 토글(`filter-group`/`filter-btn`)

---

## 1. 배경 & 목적

계절 대시보드(`/seasonal/`)는 프로그램이 ESP(Exchange, 등록금 없음)와 VSP(Visiting, 등록금 부과) 두 유형으로 나뉜다. 등록금 부담 여부는 학생의 1차 의사결정 축이다. 현재 계절 대시보드에는 검색만 있고 유형 필터가 없다. 정규 대시보드의 세그먼트 토글과 **동일한 위치·디자인**으로 ESP/VSP 필터를 추가한다.

승인된 방향: 정규 `Student Type` 토글 패턴을 그대로 재사용(별도 컴포넌트 안 만듦, 같은 CSS 클래스).

## 2. 승인된 결정 사항

| 항목 | 결정 |
|---|---|
| 위치 | 계절 filter-panel 안, 검색창과 같은 패널의 `Program Type` 섹션 |
| 디자인 | 정규와 동일 `.filter-group` > `.filter-btn` (`.active` 강조). 같은 스타일시트라 클래스 재사용만으로 100% 일치 |
| 버튼 | `[ESP] [VSP]` 두 개. **명시적 All 버튼 없음** |
| 선택 동작 | 단일선택 + **활성 버튼 재클릭 시 해제 → 전체 표시** (정규 Student Type과 동일) |
| 타입 판별 | 기존 `programTypeLabel` 규칙 재사용: `program_type`.toUpperCase() === 'VSP' → VSP, 그 외 → ESP |
| 결합 | 기존 검색과 AND. `Found N programs` 카운트도 필터 반영 |
| 범위 밖(YAGNI) | active-filter chip, 즐겨찾기, 엑셀 다운로드 — 하지 않음 |
| 정규 무손상 | 정규 필터·컴포넌트 무변경. 계절 코드에만 추가 |

## 3. 아키텍처 & 데이터 흐름

```
lib/seasonal.js: seasonalTypeOf(program) -> 'ESP' | 'VSP'  (순수, node 테스트)
SeasonalMain: typeFilter 상태('' | 'ESP' | 'VSP')
   → filtered = programs.filter(검색 매치 AND (typeFilter==='' || seasonalTypeOf(p)===typeFilter))
   → Program Type filter-group 렌더(정규 filter-btn 스타일)
   → Found N programs = filtered.length
```

정규 토글과 시각·동작 대칭. 로직은 순수 헬퍼로 분리해 테스트.

## 4. 프론트 (`20-1-univfinder-site/2027S/`)

### 4.1 `lib/seasonal.js` (순수 헬퍼 + export)

- 신규 `seasonalTypeOf(program)`: `String(program && program.program_type).toUpperCase() === 'VSP' ? 'VSP' : 'ESP'`. (기존 `programTypeLabel`과 동일 규칙. 값 없으면 ESP.)
- `SeasonalLib`에 `seasonalTypeOf` 추가 export.

### 4.2 `index.src.html` — SeasonalMain

- `const [typeFilter, setTypeFilter] = useState('')` (SeasonalMain 로컬 상태로 충분; App 상태 불필요).
- 검색 useMemo에 타입 조건 결합:
  ```
  return programs.filter(p => {
      const matchesSearch = !q || searchNorm(`${p.university_name} ${p.program_name} ${p.country}`).includes(q);
      const matchesType = !typeFilter || SeasonalLib.seasonalTypeOf(p) === typeFilter;
      return matchesSearch && matchesType;
  });
  ```
  (deps에 `typeFilter` 추가.)
- filter-panel 안(검색 섹션과 같은 패널)에 `Program Type` filter-section 추가. 정규 Student Type과 동일 마크업:
  ```jsx
  <div className="filter-section">
      <span className="filter-label" id="fl-seasonal-type">Program Type</span>
      <div className="filter-group" role="group" aria-labelledby="fl-seasonal-type">
          {['ESP','VSP'].map(t => (
              <button key={t}
                  className={`filter-btn ${typeFilter===t?'active':''}`}
                  onClick={() => setTypeFilter(prev => prev===t ? '' : t)}>
                  {t}
              </button>
          ))}
      </div>
  </div>
  ```
- `is_live === false`(준비 중) 분기에서는 기존대로 필터/그리드 미표시(무변경).

### 4.3 `index.html`

- `index.src.html` 편집 → `node build.cjs` → `index.html` 재빌드·커밋.

## 5. 테스트

- **`lib/seasonal.js` node 테스트**(`tests/seasonal.test.js`):
  - `seasonalTypeOf({program_type:'VSP'})` === 'VSP'
  - `seasonalTypeOf({program_type:'vsp'})` === 'VSP' (대소문자 무관)
  - `seasonalTypeOf({program_type:'ESP'})` === 'ESP'
  - `seasonalTypeOf({})` === 'ESP' (값 없음 → 기본 ESP)
- **회귀**: 기존 seasonal.test.js / term.test.js 통과 유지.
- **빌드**: `node build.cjs` 후 `index.html`에 `Program Type`·`fl-seasonal-type` grep 확인.

## 6. 에러 처리 / 엣지

- `program_type` 누락·오타 → ESP로 취급(정규 `programTypeLabel`과 동일 폴백).
- 타입 필터로 결과 0건 → 기존 "No programs match your search." 빈 상태 재사용.

## 7. 구현 순서(개요)

1. `lib/seasonal.js` `seasonalTypeOf` + export + 테스트(TDD)
2. SeasonalMain: `typeFilter` 상태 + useMemo 결합 + Program Type filter-section
3. `node build.cjs` 재빌드 + grep 검증
4. 로컬 프리뷰 확인 → 일괄 배포(대표 지시)

## 8. Self-Review

- Placeholder 없음. 코드 스텝 실제 코드 포함.
- 타입 일관성: `seasonalTypeOf`(정의·export) = SeasonalMain 소비 일치. `typeFilter` 값 도메인('' | 'ESP' | 'VSP') = 버튼 onClick/필터 조건 일치.
- 정규 무손상: 정규 `filter-btn`/`filter-group` 클래스 **재사용만**(CSS 변경 없음), 정규 마크업 무변경.
- 범위: 단일 구현 계획으로 충분(작은 UI 추가).
