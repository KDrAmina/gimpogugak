/**
 * 폰트 로딩 위치 안내 (선언은 각 사용처에 국소화되어 있다)
 *
 * - Pretendard : public/fonts/pretendard-1.3.9/ 자체 호스팅 variable dynamic subset.
 *                app/layout.tsx가 <link rel="stylesheet">로 로드. 패밀리명 'Pretendard Variable'.
 * - Nanum Myeongjo : app/blog/[id]/page.tsx에서만 선언 (globals.css `.blog-content h1~h3` 전용).
 * - TinyMCE 에디터 폰트 : components/PostEditor.tsx · PostModal.tsx의 content_css에서
 *                         에디터 iframe 내부로만 주입된다. 공개 페이지와 무관.
 */
export {};
