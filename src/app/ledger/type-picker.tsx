"use client";

// 收支类型单选组（新建流水 / 修改流水两处复用）。
//
// 审查前的实现在 `<Box role="radiogroup">` 里放三个 `role="radio"` 的 MUI Chip，
// 但只宣告了 radiogroup 语义，没有实现 APG 的键盘契约：
//   · 三个 chip 各自 `tabIndex=0` → 键盘用户要 Tab 三次才能走完这个组
//   · 无 onKeyDown → ←/→/↑/↓/Home/End 全部无响应
// 违反 WCAG 2.2 SC 2.1.1（Keyboard）与 WAI-ARIA APG § radiogroup：
// 宣告了 radiogroup 就必须履行它，换来的是「不宣告就不欠实现」。
//
// 本组件按 APG radiogroup 模式实现完整契约：
//   · **Roving tabindex**：只有选中项在 tab 序列里（tabIndex=0），其余为 -1，
//     于是 Tab 进入本组一次、离开一次，组内导航交给方向键。
//   · **方向键移动并选中**：←/→/↑/↓ 在组内循环移动焦点且**同时**更新选中态
//     （单选 radiogroup 的标准行为，不是手动选择模式）。
//   · **Home / End**：跳到首项 / 末项。
//   · **Space / Enter**：由底层原生按钮的激活行为负责（见下方 keydown 说明）。
//
// 焦点环：MUI 主题 `MuiChip.root` 已钉 `"&:focus-visible": LAMP_RING`
// （src/components/mui-theme.tsx），与 globals.css 的 `.chip:focus-visible` 同值，
// 满足 DESIGN.md §十一 #9「焦点环不得被移除或换成非灯色」。
//
// 视觉：选中态仍用 `color="primary"`（复刻 `.chip-active` 灯色），
// 未选中态用默认 outlined（复刻 `.chip`），与改造前逐字一致，无视觉变化。

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
        // Space / Enter 不在此处理：Chip 的根元素是 ButtonBase 渲染的原生 <button>，
        // 浏览器自身的按键激活会派发 click，onClick 已经完成选中。
        // 这里吞掉方向键的默认滚动行为之外的一切，不做额外干预。
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
