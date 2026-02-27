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

## 참고: 유사 패턴 시 체크리스트

- [ ] **Quill/리치 에디터 위에 오버레이/팝오버가 있는가?** → 에디터를 `readOnly`로 잠그고, 컨테이너에 **네이티브 addEventListener**(capture: true) + `stopImmediatePropagation` 적용
- [ ] **React Synthetic 이벤트로 차단했는데 여전히 누수되는가?** → Quill은 네이티브 리스너를 사용하므로 React보다 먼저 실행됨. 네이티브 리스너로 전환 필요
- [ ] **에디터 콘텐츠를 DOM으로 직접 수정하는가?** → React state + Quill API로 일괄 반영
- [ ] **키보드 이벤트가 의도치 않은 컴포넌트로 전달되는가?** → 캡처 vs 버블 단계 확인, 전역 리스너 존재 여부 점검, `readOnly` lock 고려
- [ ] **팝오버 input에 포커스 시 에디터가 키를 가로채는가?** → `readOnly` lock + 네이티브 이벤트 격리 + auto-focus

---

*최종 업데이트: 2026-02-27 (v2.08)*
