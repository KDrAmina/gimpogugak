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

## Bug 2: Keystroke Leakage (키보드 이벤트 버블링)

### 증상
- 이미지 툴팁(Alt/Caption 입력) 내부에서 타이핑할 때 키 입력이 **하단 Quill 에디터로 새어 나감**
- 플로팅 툴팁 input에 포커스가 있어도 입력 문자가 Quill 본문에 삽입됨

### 원인
- 툴팁 `<input>` 요소의 키보드 이벤트가 **버블링**되어 Quill 에디터가 수신
- Quill은 전역 키 이벤트를 감지하여 입력 처리하므로, 툴팁 내부 입력도 에디터로 전달됨

### 해결
- 툴팁 내부 입력 필드에 **이벤트 전파 차단** 적용:
  - `onKeyDown={(e) => e.stopPropagation()}`
  - `onKeyPress={(e) => e.stopPropagation()}`
  - `onPointerDown={(e) => e.stopPropagation()}` — Quill 포커스 탈취 방지

### 적용
- `components/PostEditor.tsx` — Alt input, Caption input 모두에 `stopPropagation` 추가

---

## 참고: 유사 패턴 시 체크리스트

- [ ] **Quill/리치 에디터 위에 오버레이/팝오버가 있는가?** → input/textarea에 `stopPropagation` 적용
- [ ] **에디터 콘텐츠를 DOM으로 직접 수정하는가?** → React state + Quill API로 일괄 반영
- [ ] **키보드 이벤트가 의도치 않은 컴포넌트로 전달되는가?** → `e.stopPropagation()` 또는 `e.preventDefault()` 검토

---

*최종 업데이트: 2026-02-27 (v2.06)*
