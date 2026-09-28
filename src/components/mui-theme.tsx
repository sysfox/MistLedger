"use client";

import { createTheme } from "@mui/material/styles";

export const mistNightTokens = {
  night: "#0A0E14",
  ink: "#E9E4D8",
  lamp: "#E3B341",
  ember: "#E2574C",
  jade: "#6FBF8F",
  mist: "#111826",
  veil: "#1B2436",
  fogline: "#28324A",
  foglineStrong: "#5E6F8C",
  dim: "#8B93A7",
} as const;

const HIGH_CONTRAST = {
  fogline: "#46516E",
  foglineStrong: "#8B98B8",
  dim: "#B6BED1",
} as const;

const LAMP_RING = "0 0 0 2px rgba(227, 179, 65, 0.6)";

const muiTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: mistNightTokens.lamp, contrastText: mistNightTokens.night },
    error: { main: mistNightTokens.ember, contrastText: mistNightTokens.night },
    success: { main: mistNightTokens.jade, contrastText: mistNightTokens.night },
    warning: { main: mistNightTokens.lamp, contrastText: mistNightTokens.night },
    info: { main: mistNightTokens.dim, contrastText: mistNightTokens.night },
    background: { default: mistNightTokens.night, paper: mistNightTokens.mist },
    text: { primary: mistNightTokens.ink, secondary: mistNightTokens.dim },
    divider: mistNightTokens.fogline,
  },
  typography: {
    fontFamily: "var(--font-noto-sans-sc), ui-sans-serif, system-ui, sans-serif",
  },
  shape: { borderRadius: 6 },
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
        body: {
          backgroundColor: mistNightTokens.night,
          color: mistNightTokens.ink,
        },
      },
    },
    MuiButtonBase: {
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
        root: {
          backgroundColor: mistNightTokens.veil,
          borderRadius: 6,
          color: mistNightTokens.ink,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: mistNightTokens.foglineStrong,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: mistNightTokens.foglineStrong,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(227, 179, 65, 0.6)",
            boxShadow: LAMP_RING,
          },
          "& input::placeholder, & textarea::placeholder": {
            color: "rgba(139, 147, 167, 0.7)",
            opacity: 1,
          },
          "@media (prefers-contrast: more)": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: HIGH_CONTRAST.foglineStrong,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: HIGH_CONTRAST.foglineStrong,
            },
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
        root: {
          backgroundColor: mistNightTokens.veil,
          border: `1px solid ${mistNightTokens.fogline}`,
          color: mistNightTokens.dim,
          borderRadius: 9999,
          "&:focus-visible": { outline: "none", boxShadow: LAMP_RING },
          "&.MuiChip-clickable:hover": { color: mistNightTokens.ink },
          "&.MuiChip-clickable:active": { transform: "scale(0.97)" },
        },
        colorPrimary: {
          borderColor: "rgba(227, 179, 65, 0.7)",
          backgroundColor: "rgba(227, 179, 65, 0.1)",
          color: mistNightTokens.lamp,
          "&.MuiChip-clickable:hover": {
            backgroundColor: "rgba(227, 179, 65, 0.1)",
            color: mistNightTokens.lamp,
          },
        },
        deleteIcon: {
          color: mistNightTokens.dim,
          "&:hover": { color: mistNightTokens.ink },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
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
        root: {
          backgroundColor: "rgba(10, 14, 20, 0.7)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          "@media (prefers-reduced-transparency: reduce)": {
            backgroundColor: "rgba(10, 14, 20, 0.85)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          },
        },
      },
    },
  },
});

export default muiTheme;
