# Lessons Learned / Troubleshooting (오답 노트)

> 에이전시·프로젝트 간 반복 실수 방지를 위한 버그 해결 기록

---

## Bug 1: Ghosting Caption (무한 증식 버그)

### 증상
- 이미지 캡션 입력 시 캡션 요소가 무한히 복제·증식되는 현상
- 에디터에서 글자 입력 시마다 캡션이 중복 삽입됨

### 원인
- `onChange` 핸들러에서 **DOM을 직접 조작**하면서 Quill의 Delta 엔진과 충돌
- Quill은 내부 Delta를 기반으로 콘텐츠를 관리하는데, 외부 DOM 조작이 이를 무시하고 덮어쓰면서 동기화 꼬임 발생

### 해결
- **React 상태와 Quill 업데이트를 분리**
- 캡션 입력은 **로컬 React state만** 업데이트 (`setImageTooltip`)
- 실제 DOM/Quill 반영은 **"적용" 버튼 클릭 또는 Enter 키** 시점에만 수행
- Quill API(`deleteText`, `insertText`) 또는 `editor.root.innerHTML` 동기화를 통해 일괄 반영

### 적용
- `components/PostEditor.tsx` — `handleTooltipCaptionChange`는 state만 업데이트, `applyCaption`에서 일괄 반영

---

## Bug 2: Keystroke Leakage (키보드 이벤트 누수)

### 증상
- 이미지 툴팁(Alt/Caption 입력) 내부에서 타이핑할 때 키 입력이 **하단 Quill 에디터로 새어 나감**
- 플로팅 툴팁 input에 포커스가 있어도 입력 문자가 Quill 본문에 삽입됨

### 원인
- React-Quill / Quill.js는 **document 레벨 또는 캡처 단계**에서 키보드 이벤트를 수신
- 따라서 개별 input에서 **버블 단계(bubble phase)** `e.stopPropagation()`만 적용하면, 이벤트가 이미 캡처 단계에서 Quill에게 도달한 뒤이므로 **차단 효과 없음**

### ❌ 실패한 접근 (v2.06)
- 각 `<input>` 태그에 `onKeyDown`, `onKeyPress`, `onPointerDown`의 **버블 단계** `stopPropagation` 적용
- **결과:** Quill의 전역 포커스 관리 및 캡처 단계 리스너가 이벤트를 먼저 가로채므로 **무효**

### ⚠️ 불완전한 해결 — React Capture Phase (v2.07)
1. 툴팁 컨테이너에 React의 `onKeyDownCapture`, `onKeyUpCapture` 등 Synthetic Event 캡처 핸들러 적용
2. `onFocus`에서 `quill.blur()` 호출
3. **결과:** 대부분의 상황에서 동작하나, Quill이 **네이티브 DOM addEventListener**를 사용하므로 React Synthetic Event보다 **먼저 실행**되어 첫 글자가 여전히 누수될 수 있음

### ✅ 최종 해결 — ReadOnly Lock + Native Event Isolation (v2.08)
**세 겹의 격리 전략 (Triple Isolation):**

1. **Editor ReadOnly Lock (궁극의 방패):**
   - `<ReactQuill readOnly={imageTooltip.visible}>` — 툴팁이 열린 동안 에디터를 읽기 전용으로 전환
   - `useEffect`에서 `quill.enable(false)` / `quill.enable(true)` 호출
   - Quill의 keyboard 모듈 자체가 비활성화되므로 키 입력이 에디터에 도달해도 **처리 자체가 불가**

2. **Native DOM Event Isolation (DOM 레벨 차단):**
   - `tooltipRef`에 `useEffect`로 네이티브 `addEventListener('keydown', stop, true)` 등록
   - `stopPropagation()` + `stopImmediatePropagation()`으로 이벤트가 캡처 단계에서 **완전 소멸**
   - React Synthetic Event와 달리 Quill의 네이티브 리스너보다 **먼저 실행됨**

3. **Auto-Focus (UX 보장):**
   - 툴팁 열릴 때 `setTimeout(() => altInput.focus(), 50)`으로 자동 포커스
   - ReadOnly 전환 후 DOM이 안정화된 뒤 포커스 이동하여 즉시 타이핑 가능

### React Synthetic Events vs Native DOM Listeners
```
이벤트 발생 순서:
  1. Native Capture (addEventListener capture:true)  ← 우리가 여기서 차단
  2. React Capture (onKeyDownCapture)                 ← v2.07은 여기
  3. Native Bubble (addEventListener capture:false)
  4. React Bubble (onKeyDown)

Quill은 1번 또는 3번에서 리스너를 등록하므로,
2번(React Capture)에서 stopPropagation해도 1번은 이미 실행된 후.
따라서 1번에서 stopImmediatePropagation으로 차단해야 함.
```

### 구조적 교훈
- **React Synthetic Events는 네이티브 리스너보다 늦게 실행된다** — Quill, CKEditor 등 네이티브 DOM을 직접 조작하는 라이브러리와 함께 사용할 때 `onKeyDownCapture`만으로는 불충분
- **ReadOnly Lock이 가장 확실한 방패** — 이벤트 차단이 실패하더라도 에디터가 잠겨 있으면 키 입력 처리 자체가 불가
- 네이티브 `addEventListener(type, handler, true)`로 캡처 단계 최우선에서 `stopImmediatePropagation()` 호출이 belt-and-suspenders

### 적용
- `components/PostEditor.tsx` — `readOnly={imageTooltip.visible}`, `quill.enable()` useEffect, `tooltipRef` 네이티브 이벤트 리스너 useEffect, auto-focus useEffect

---

## Bug 3: Editor Lock-out (사진 증발 버그) — v2.08 → v2.09

### 증상
- 이미지 캡션 입력 후 "적용" 버튼 클릭 시 **이미지가 사라지는** 현상
- 캡션은 적용되지만 해당 이미지 `<img>` 노드가 DOM에서 삭제됨

### 원인
- v2.08에서 도입한 `readOnly={imageTooltip.visible}` + `editor.enable(false)`가 **에디터 잠금 상태에서 DOM 변경을 수행**하는 부작용 발생
- `applyCaption()`이 에디터가 `disabled` 상태일 때 호출되면:
  1. Quill 내부 Delta 엔진이 비활성화되어 DOM 변경을 추적하지 못함
  2. `setContent(editor.root.innerHTML)` 호출 시 Quill이 비활성 상태에서 innerHTML을 재파싱하면서 인덱스 손상 발생
  3. 결과적으로 이미지 노드가 손실되거나 잘못된 위치의 콘텐츠가 삭제됨

### ❌ 실패 원인 (v2.08)
- ReadOnly Lock은 키보드 이벤트 누수 방지에는 완벽했지만, **에디터 콘텐츠 수정 시점을 고려하지 않음**
- `applyCaption`은 툴팁이 열린(= 에디터 잠금) 상태에서 실행되므로, 항상 disabled 상태에서 DOM을 변경하게 됨

### ✅ 해결 — Intelligent Unlock (v2.09)
```typescript
const applyCaption = useCallback(() => {
  // ★ DOM 수정 직전에 에디터를 일시적으로 활성화
  editor.enable(true);

  // 이미지 노드가 DOM에 여전히 존재하는지 검증
  if (!editor.root.contains(anchor)) {
    editor.enable(false);  // 안전하게 복원
    return;
  }

  // DOM 수정 수행 (캡션 추가/수정/삭제)
  // ...

  // 콘텐츠 동기화
  setContent(editor.root.innerHTML);

  // 툴팁 닫기 → useEffect가 자동으로 editor.enable(true) 호출
  //   (visible이 false가 되므로 readOnly도 false로 전환)
  setImageTooltip({ ...prev, visible: false });
}, [...]);
```

**핵심 원리:**
1. `editor.enable(true)` — DOM 수정 전 에디터 활성화로 Quill Delta 엔진 정상 동작 보장
2. `editor.root.contains(anchor)` — 이미지 노드 존재 검증으로 null reference 방지
3. 툴팁 닫힘 시 `useEffect`가 `visible: false`를 감지하여 자연스럽게 `editor.enable(true)` 호출 (재잠금 불필요)

### 구조적 교훈
- **ReadOnly 상태에서 Quill Delta를 수정하면 안 된다** — `enable(false)`는 키보드 차단뿐 아니라 내부 Delta 추적까지 비활성화함
- 에디터 잠금과 콘텐츠 수정은 **상호 배타적** — 수정이 필요한 순간에는 반드시 일시 해제 후 작업
- DOM 조작 전 노드 존재 검증(`contains`)은 defensive programming의 기본

### 적용
- `components/PostEditor.tsx` — `applyCaption` 함수에 `editor.enable(true)` 선행 호출 및 노드 존재 검증 추가

---

## 참고: 유사 패턴 시 체크리스트

- [ ] **Quill/리치 에디터 위에 오버레이/팝오버가 있는가?** → 에디터를 `readOnly`로 잠그고, 컨테이너에 **네이티브 addEventListener**(capture: true) + `stopImmediatePropagation` 적용
- [ ] **React Synthetic 이벤트로 차단했는데 여전히 누수되는가?** → Quill은 네이티브 리스너를 사용하므로 React보다 먼저 실행됨. 네이티브 리스너로 전환 필요
- [ ] **에디터 콘텐츠를 DOM으로 직접 수정하는가?** → React state + Quill API로 일괄 반영
- [ ] **키보드 이벤트가 의도치 않은 컴포넌트로 전달되는가?** → 캡처 vs 버블 단계 확인, 전역 리스너 존재 여부 점검, `readOnly` lock 고려
- [ ] **팝오버 input에 포커스 시 에디터가 키를 가로채는가?** → `readOnly` lock + 네이티브 이벤트 격리 + auto-focus
- [ ] **ReadOnly 상태에서 에디터 콘텐츠를 수정하는가?** → 수정 직전 `editor.enable(true)`로 일시 활성화 필수, 수정 완료 후 재잠금 또는 상태 전환으로 자동 복원

---

## SEO & IndexNow Integration

- **IndexNow 키 위치:** `public/<key>.txt` — 32자 hex 문자열이 파일명이자 내용과 동일
- **유틸리티:** `lib/indexnow.ts` — `notifyIndexNow(postSlugOrId)` 함수가 Bing IndexNow API에 POST 요청
- **호출 시점:** 블로그 글 발행/수정 성공 직후 (PostEditor, PostModal) — fire-and-forget로 `/api/indexnow?path=...` 호출
- **지원 검색엔진:** Bing, Naver 등 IndexNow 프로토콜 지원 엔진

---

*최종 업데이트: 2026-02-27 (v2.11)*
