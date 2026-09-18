"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { formatMoney } from "@/lib/ledger/format";
import { adjustAccountBalance } from "./account-actions";
import { notifyDataChanged } from "@/lib/api/client";

const INITIAL = { ok: true, message: "" };

export default function AdjustBalanceButton({
  id,
  accountName,
  currentBalance,
  initialBalance,
}: {
  id: string;
  accountName: string;
  currentBalance: number;
  initialBalance: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adjustAccountBalance, INITIAL);
  useEffect(() => {
    if (state?.ok && state.message) notifyDataChanged();
  }, [state]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetBalance, setTargetBalance] = useState(String(currentBalance));
  const formRef = useRef<HTMLFormElement>(null);
  const armedRef = useRef(false);
  const net = currentBalance - initialBalance;

  const targetNumber = Number(targetBalance);
  const targetValid = targetBalance !== "" && Number.isFinite(targetNumber);

  const confirmSubmit = () => {
    armedRef.current = true;
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <Button
        type="button"
        variant="text"
        color="primary"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        sx={{ minHeight: 44, minWidth: 44, fontSize: "0.75rem" }}
      >
        调整余额
      </Button>
      {open && !(state.ok && state.message) ? (
        <form
          ref={formRef}
          action={action}
          onSubmit={(e) => {
            if (!armedRef.current) {
              e.preventDefault();
              setConfirmOpen(true);
              return;
            }
            armedRef.current = false;
          }}
          className="w-full flex flex-col gap-2 rounded-xl border border-fogline px-4 py-3"
        >
          <input type="hidden" name="id" value={id} />
          <p className="eyebrow">调整余额</p>
          <p className="text-xs text-dim">
            当前余额 <span className="money">¥{formatMoney(currentBalance)}</span>（期初{" "}
            <span className="money">¥{formatMoney(initialBalance)}</span>，流水净变动{" "}
            <span className="money">¥{formatMoney(net)}</span>）
          </p>
          <TextField
            id={`target-balance-${id}`}
            name="target_balance"
            type="number"
            label="目标余额"
            required
            value={targetBalance}
            onChange={(e) => setTargetBalance(e.target.value)}
            placeholder="目标余额"
            slotProps={{
              htmlInput: { step: "0.01", inputMode: "decimal", enterKeyHint: "done" },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={pending || !targetValid}
            sx={{ alignSelf: "flex-start" }}
          >
            {pending ? "调整中…" : "调整"}
          </Button>
          {!state.ok && state.message ? (
            <p role="alert" className="text-xs text-ember">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
      {confirmOpen ? (
        <Dialog open onClose={() => setConfirmOpen(false)}>
          <DialogTitle>确认调整「{accountName}」的余额？</DialogTitle>
          <DialogContent>
            <Box component="p" sx={{ margin: 0, fontFamily: "var(--font-geist-mono), monospace" }}>
              <span className="money">
                ¥{formatMoney(currentBalance)} → ¥{formatMoney(targetNumber)}
              </span>
            </Box>
            <DialogContentText sx={{ mt: 1 }}>
              将同步调整期初余额，使当前余额与目标一致。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="primary" variant="text" disabled={pending} onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button color="primary" variant="contained" disabled={pending} onClick={confirmSubmit}>
              确认调整
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
