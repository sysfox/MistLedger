"use client";

// 收支类型单选组（新建流水 / 修改流水两处复用）。按 WAI-ARIA APG § radiogroup
// 实现完整契约（宣告了 radiogroup 就必须履行它，违反 WCAG 2.2 SC 2.1.1）：
//   · Roving tabindex：只有选中项在 tab 序列里，Tab 进入本组一次、离开一次。
//   · 方向键在组内循环移动焦点且**同时**更新选中态（单选 radiogroup 的标准行为，
//     不是手动选择模式）；Home / End 跳首末项。
//   · Space / Enter 交给底层原生 <button> 的激活行为，见下方 default 分支。
//
// 焦点环由 MUI 主题 `MuiChip.root` 的 `"&:focus-visible": LAMP_RING`（mui-theme.tsx）
// 提供，满足 DESIGN.md §十一 #9。

import { useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

export type TypeOption = { value: string; label: string };

/** 收支类型是受控词汇表（DESIGN.md 第十节），顺序即键盘左右顺序 */
export const TX_TYPES: TypeOption[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

export default function TypePicker({
  value,
  onChange,
  label = "收支类型",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    TX_TYPES.findIndex((t) => t.value === value),
  );

  /** 移动焦点并同时更新选中态（APG 单选 radiogroup） */
  const moveTo = (index: number) => {
    const next = TX_TYPES[index];
    if (!next) return;
    onChange(next.value);
    chipRefs.current[index]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TX_TYPES.length - 1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveTo(index >= last ? 0 : index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveTo(index <= 0 ? last : index - 1);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(last);
        break;
      default:
        // Space / Enter 不在此处理：Chip 根元素是 ButtonBase 渲染的原生 <button>，
        // 浏览器按键激活会派发 click，onClick 已完成选中。
        break;
    }
  };

  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {TX_TYPES.map((t, i) => (
        <Chip
          key={t.value}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          label={t.label}
          clickable
          role="radio"
          aria-checked={value === t.value}
          // Roving tabindex：只有选中项可 Tab 进入
          tabIndex={i === selectedIndex ? 0 : -1}
          color={value === t.value ? "primary" : "default"}
          variant="outlined"
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        />
      ))}
    </Box>
  );
}
