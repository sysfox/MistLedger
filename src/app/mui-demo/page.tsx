"use client";

// MUI 试验演示页（/mui-demo）：只验证 MUI 能否融入常夜主题，不动现有页面。
// - 每个 MUI 组件各展示一个：Button / TextField / Select / Chip / Dialog。
// - 文案：动词开头（保存/取消等），不用「提交」「确定」；计数用「笔」；
//   金额用 .money（mono），不用 MUI Typography 渲染金额。
// - 本屏不用 .lamp-line（常亮灯线 0 条 ≤ 1，DESIGN §十一 #3）。

import { useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";

export default function MuiDemoPage() {
  const [category, setCategory] = useState("catering");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="flex flex-col gap-6">
        <header>
          <p className="eyebrow">雾夜试验</p>
          <h1 className="mt-2 font-display text-[22px] font-semibold text-ink">
            点灯试 MUI
          </h1>
          <p className="mt-2 text-sm text-dim">
            只看 MUI 按钮与输入在常夜里顺不顺眼，不动账房里的任何东西。
          </p>
        </header>

        <section aria-label="按钮" className="panel flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-semibold text-ink">保存与取消</h2>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="contained" color="primary">
              保存修改
            </Button>
            <Button variant="text" color="primary">
              取消
            </Button>
          </Box>
          <p className="text-sm text-dim">
            本月已记 <span className="money text-ink">¥ 3,210.00</span>，共{" "}
            <span className="money text-ink">12</span> 笔
          </p>
        </section>

        <section aria-label="输入与选择" className="panel flex flex-col gap-4 p-4">
          <h2 className="font-display text-base font-semibold text-ink">记一笔试试</h2>
          <TextField
            label="备注"
            placeholder="写下这笔钱去哪了"
            helperText="保存后可在流水中找到"
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="mui-demo-category-label">选择分类</InputLabel>
            <Select
              labelId="mui-demo-category-label"
              label="选择分类"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <MenuItem value="catering">餐饮</MenuItem>
              <MenuItem value="transport">交通</MenuItem>
              <MenuItem value="grocery">购物</MenuItem>
            </Select>
            <FormHelperText>先选分类，再保存</FormHelperText>
          </FormControl>
        </section>

        <section aria-label="标签" className="panel flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-semibold text-ink">常用分类</h2>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip label="餐饮" color="primary" variant="outlined" />
            <Chip label="交通" variant="outlined" />
            <Chip label="购物" variant="outlined" />
          </Box>
          <p className="text-sm text-dim">共 3 笔待确认</p>
        </section>

        <section aria-label="确认框" className="panel flex flex-col gap-3 p-4">
          <h2 className="font-display text-base font-semibold text-ink">删前再问一句</h2>
          <Box sx={{ display: "flex" }}>
            <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
              删除这笔
            </Button>
          </Box>
          <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
            <DialogTitle>确认删除这笔流水？</DialogTitle>
            <DialogContent>
              <DialogContentText>
                删除后相关账户余额会同步更新，且无法找回。
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button color="primary" variant="text" onClick={() => setConfirmOpen(false)}>
                取消
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => setConfirmOpen(false)}
              >
                确认删除
              </Button>
            </DialogActions>
          </Dialog>
        </section>
      </div>
    </main>
  );
}
