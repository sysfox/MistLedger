"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

export type TypeOption = { value: string; label: string };

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

// 移动焦点并同时更新选中态（APG 单选 radiogroup）。
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
// Roving tabindex：组内恒有且仅有 1 个可 Tab 进入。
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
