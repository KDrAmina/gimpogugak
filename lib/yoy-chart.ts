/**
 * 연도별 겹쳐보기(YoY) 차트 공용 정의 — recharts를 import하지 않으므로
 * 통계 페이지(데이터 생성)와 YoyMatrixChart(렌더링) 양쪽에서 가볍게 사용한다.
 *
 * series = 행(색상 축) × 열(선 스타일 축)
 *   예) 매출 추이: 연도(색) × 수강료/외부수입(선)
 *       유입경로:  유입경로(색) × 연도(선)
 */

/** 한 series의 선 스타일. dot 기본값은 "filled" */
export type LineStyle = { dash?: string; dot?: "filled" | "hollow" | "none" };

/** 행 × 열 series의 dataKey. Recharts는 dataKey의 "."을 객체 경로로 해석하므로 "__"로 잇는다 */
export const seriesKey = (row: string, col: string) => row + "__" + col;
