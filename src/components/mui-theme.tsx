"use client";

// MUI 试验主题：把 DESIGN.md 第二节的令牌映射到 MUI palette，
// 组件覆写复刻 globals.css 第八节 .input / .btn 的观感。
// 约束：禁用渐变与大面积灯色；金额不在此处设字体——金额一律用 .money（mono）。
// 注意：MUI 默认含若干标准色（info 蓝等），此处把 warning/info 指回灯色/远雾，
// 不引入任何新标准色（DESIGN §十一 #1）。

import { createTheme } from "@mui/material/styles";

// 与 globals.css @theme 同值（DESIGN.md 第二节）
export const mistNightTokens = {
  night: "#0A0E14",
  ink: "#E9E4D8",
  lamp: "#E3B341",
  ember: "#E2574C",
  jade: "#6FBF8F",
  mist: "#111826",
  veil: "#1B2436",
  fogline: "#28324A",
  dim: "#8B93A7",
} as const;

// 与 .input:focus-visible / .btn-ghost:focus-visible 同一灯环（DESIGN.md 第七节）
const LAMP_RING = "0 0 0 2px rgba(227, 179, 65, 0.6)";

const muiTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: mistNightTokens.lamp, contrastText: mistNightTokens.night },
    error: { main: mistNightTokens.ember, contrastText: mistNightTokens.night },
    success: { main: mistNightTokens.jade, contrastText: mistNightTokens.night },
    // 复用令牌，不引入 MUI 默认的琥珀/蓝色系新色
    warning: { main: mistNightTokens.lamp, contrastText: mistNightTokens.night },
    info: { main: mistNightTokens.dim, contrastText: mistNightTokens.night },
    background: { default: mistNightTokens.night, paper: mistNightTokens.mist },
    text: { primary: mistNightTokens.ink, secondary: mistNightTokens.dim },
    divider: mistNightTokens.fogline,
  },
  // 指回 layout 经 next/font 挂在 html 上的正文字体变量（DESIGN.md 第三节）
  typography: {
    fontFamily: "var(--font-noto-sans-sc), ui-sans-serif, system-ui, sans-serif",
  },
  shape: { borderRadius: 6 },
  // 微交互与契约一致：仅 150ms 颜色过渡，单次动画 ≤500ms（DESIGN §十一 #8）
  transitions: {
    duration: {
      shortest: 150,
      shorter: 150,
      short: 150,
      standard: 150,
      complex: 150,
      enteringScreen: 150,
      leavingScreen: 150,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // 与 globals.css body 完全同值：只为 CssBaseline 的全局注入钉死，不产生回归
        body: {
          backgroundColor: mistNightTokens.night,
          color: mistNightTokens.ink,
        },
      },
    },
    MuiButtonBase: {
      // TouchRipple 默认 550ms，超过 §十一 #8 上限；按压反馈改用 active 位移（见 MuiButton）
      defaultProps: { disableRipple: true },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 6,
          fontWeight: 500,
          transitionProperty: "background-color, border-color, color",
          transitionDuration: "150ms",
          boxShadow: "none",
          backgroundImage: "none",
          "&:focus-visible": { outline: "none", boxShadow: LAMP_RING },
          "&:active": { transform: "translateY(1px)" },
        },
        // v9 起 variant 与 color 拆键：用 variant 键 + 颜色类组合选择器
        // 复刻 .btn-primary：灯底 + 夜空字，无渐变、无辉光
        contained: {
          "&.MuiButton-colorPrimary": {
            backgroundColor: mistNightTokens.lamp,
            color: mistNightTokens.night,
            "&:hover": {
              backgroundColor: mistNightTokens.lamp,
              filter: "brightness(1.1)",
            },
          },
        },
        // 复刻 .btn-ghost：远雾字，hover 转纸墨
        text: {
          "&.MuiButton-colorPrimary": {
            color: mistNightTokens.dim,
            "&:hover": { color: mistNightTokens.ink, backgroundColor: "transparent" },
          },
        },
        outlined: {
          "&.MuiButton-colorPrimary": {
            color: mistNightTokens.dim,
            borderColor: mistNightTokens.fogline,
            "&:hover": {
              color: mistNightTokens.ink,
              borderColor: mistNightTokens.fogline,
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // 复刻 .input：纱底 + 雾线边 + 灯焦点环
        root: {
          backgroundColor: mistNightTokens.veil,
          borderRadius: 6,
          color: mistNightTokens.ink,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: mistNightTokens.fogline },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: mistNightTokens.fogline,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(227, 179, 65, 0.6)",
            boxShadow: LAMP_RING,
          },
          "& input::placeholder, & textarea::placeholder": {
            color: "rgba(139, 147, 167, 0.7)",
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: mistNightTokens.dim,
          "&.Mui-focused": { color: mistNightTokens.ink },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { color: mistNightTokens.dim } },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: mistNightTokens.dim },
      },
    },
    // 下拉纸面：雾面 + 雾线边，无阴影堆叠（§十一 #10）
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: mistNightTokens.mist,
          border: `1px solid ${mistNightTokens.fogline}`,
          borderRadius: 12,
          backgroundImage: "none",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: mistNightTokens.ink,
          "&:hover": { backgroundColor: mistNightTokens.veil },
          "&.Mui-selected": {
            backgroundColor: "rgba(227, 179, 65, 0.1)",
            color: mistNightTokens.lamp,
            "&:hover": { backgroundColor: "rgba(227, 179, 65, 0.1)" },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        // 复刻 .chip / .chip-active
        root: {
          backgroundColor: mistNightTokens.veil,
          border: `1px solid ${mistNightTokens.fogline}`,
          color: mistNightTokens.dim,
          borderRadius: 9999,
          "&:focus-visible": { outline: "none", boxShadow: LAMP_RING },
        },
        colorPrimary: {
          borderColor: "rgba(227, 179, 65, 0.7)",
          backgroundColor: "rgba(227, 179, 65, 0.1)",
          color: mistNightTokens.lamp,
        },
        deleteIcon: {
          color: mistNightTokens.dim,
          "&:hover": { color: mistNightTokens.ink },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        // 复刻 .panel：雾面 + 雾线边 + 极轻内高光，无拟物阴影堆叠
        paper: {
          backgroundColor: mistNightTokens.mist,
          border: `1px solid ${mistNightTokens.fogline}`,
          borderRadius: 12,
          backgroundImage: "none",
          boxShadow:
            "inset 0 1px 0 rgba(233, 228, 216, 0.03), 0 1px 2px rgba(0, 0, 0, 0.4)",
          color: mistNightTokens.ink,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { color: mistNightTokens.ink, fontWeight: 500 } },
    },
    MuiDialogContentText: {
      styleOverrides: { root: { color: mistNightTokens.dim } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: "rgba(10, 14, 20, 0.7)" },
      },
    },
  },
});

export default muiTheme;
