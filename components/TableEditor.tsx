"use client";

import { useState, useCallback, KeyboardEvent } from "react";

export type TableData = string[][];

interface Props {
  initialData?: TableData | null;
  onInsert: (html: string) => void;
  onCancel: () => void;
}

const DEFAULT_DATA: TableData = [
  ["열 1", "열 2", "열 3"],
  ["내용", "내용", "내용"],
  ["내용", "내용", "내용"],
];

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function tableDataToHtml(data: TableData): string {
  const [header, ...body] = data;
  const ths = header.map((c) => `<th>${escHtml(c)}</th>`).join("");
  const trs = body
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`
    )
    .join("\n    ");
  return `\n<table>\n  <thead>\n    <tr>${ths}</tr>\n  </thead>\n  <tbody>\n    ${trs}\n  </tbody>\n</table>\n`;
}

export function tableElToData(tableEl: HTMLTableElement): TableData {
  const data: TableData = [];
  tableEl.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      cells.push(cell.textContent?.trim() ?? "");
    });
    if (cells.length > 0) data.push(cells);
  });
  return data.length > 0 ? data : DEFAULT_DATA;
}

export default function TableEditor({ initialData, onInsert, onCancel }: Props) {
  const [data, setData] = useState<TableData>(() =>
    (initialData ?? DEFAULT_DATA).map((r) => [...r])
  );

  const rows = data.length;
  const cols = data[0]?.length ?? 0;

  const updateCell = useCallback((r: number, c: number, val: string) => {
    setData((prev) =>
      prev.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row
      )
    );
  }, []);

  const addRow = () =>
    setData((prev) => [
      ...prev,
      Array.from({ length: cols }, () => "내용"),
    ]);

  const addCol = () =>
    setData((prev) =>
      prev.map((row, ri) => [...row, ri === 0 ? `열 ${cols + 1}` : "내용"])
    );

  const delLastRow = () => {
    if (rows <= 2) return;
    setData((prev) => prev.slice(0, -1));
  };

  const delLastCol = () => {
    if (cols <= 1) return;
    setData((prev) => prev.map((row) => row.slice(0, -1)));
  };

  const reset = () => setData(DEFAULT_DATA.map((r) => [...r]));

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number
  ) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const nr = c + 1 < cols ? r : r + 1;
    const nc = c + 1 < cols ? c + 1 : 0;
    if (nr < rows) {
      (
        document.querySelector(
          `[data-cell="${nr}-${nc}"]`
        ) as HTMLInputElement | null
      )?.focus();
    }
  };

  const toolbarBtns: {
    label: string;
    onClick: () => void;
    variant: "blue" | "red" | "gray";
    disabled: boolean;
    title?: string;
  }[] = [
    { label: "+ 행 추가", onClick: addRow, variant: "blue", disabled: false },
    { label: "+ 열 추가", onClick: addCol, variant: "blue", disabled: false },
    { label: "행 삭제", onClick: delLastRow, variant: "red", disabled: rows <= 2, title: "마지막 행 삭제" },
    { label: "열 삭제", onClick: delLastCol, variant: "red", disabled: cols <= 1, title: "마지막 열 삭제" },
    { label: "초기화", onClick: reset, variant: "gray", disabled: false },
  ];

  return (
    <div className="flex flex-col border border-blue-200 rounded-xl bg-white overflow-hidden shadow-sm mx-auto max-w-2xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-900">⊞ 표 편집기</span>
          <span className="text-xs text-blue-500 tabular-nums">
            {rows}행 × {cols}열
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {toolbarBtns.map(({ label, onClick, variant, disabled, title }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={disabled}
              title={title ?? label}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                variant === "blue"
                  ? "bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                  : variant === "red"
                  ? "bg-white border-gray-200 text-red-600 hover:bg-red-50"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-1.5 text-xs text-blue-600 bg-blue-50/40 border-b border-blue-100">
        첫 번째 행은 <strong>헤더</strong>(파란 배경)로 자동 스타일 적용 ·{" "}
        <kbd className="px-1 py-0.5 bg-white border border-blue-200 rounded text-[10px]">
          Tab
        </kbd>{" "}
        키로 다음 셀 이동
      </div>

      {/* Visual Grid */}
      <div className="overflow-x-auto p-4">
        <table className="border-collapse" style={{ width: "100%" }}>
          <thead>
            <tr>
              {data[0].map((cell, ci) => (
                <th
                  key={ci}
                  className="border border-blue-300 bg-[#e8f0fe] p-0"
                  style={{ minWidth: 110 }}
                >
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => updateCell(0, ci, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 0, ci)}
                    data-cell={`0-${ci}`}
                    placeholder={`열 ${ci + 1}`}
                    className="w-full px-3 py-2 text-sm font-bold text-[#1e3a5f] bg-transparent focus:outline-none focus:bg-blue-100 placeholder:text-blue-300 text-left"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border border-gray-300 p-0 ${
                      ri % 2 === 1 ? "bg-gray-50" : "bg-white"
                    }`}
                    style={{ minWidth: 110 }}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(ri + 1, ci, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, ri + 1, ci)}
                      data-cell={`${ri + 1}-${ci}`}
                      placeholder="내용"
                      className="w-full px-3 py-2 text-sm text-gray-700 bg-transparent focus:outline-none focus:bg-blue-50 placeholder:text-gray-300"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          * 김포국악원 스타일(파란 헤더, 줄무늬)이 자동 적용됩니다.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onInsert(tableDataToHtml(data))}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            에디터에 삽입
          </button>
        </div>
      </div>
    </div>
  );
}
