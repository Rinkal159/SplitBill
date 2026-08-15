import React from "react";

function Expense({symbol, expense_title, expense_desc, rupee, summary, summary_color}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-lg">
          {symbol}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">{expense_title}</p>
          <p className="text-xs text-slate-400">{expense_desc}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold text-slate-700">{rupee}</p>
        <p className={`text-xs ${summary_color}`}>{summary}</p>
      </div>
    </div>
  );
}

export default Expense;
