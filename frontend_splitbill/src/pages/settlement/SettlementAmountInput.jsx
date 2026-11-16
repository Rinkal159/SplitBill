import React from "react";
import formatAmount from "../../utils/formatAmount";

function SettlementAmountInput({ onChangeEvent, amount, initialAmount }) {
  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex items-baseline justify-center gap-1 border-b-2 border-dashed border-slate-300 ">
        <span className="text-4xl font-medium text-slate-700">₹</span>
        <input
          onChange={onChangeEvent}
          style={{
            width: `${Math.max(amount.length, 1)}ch`,
          }}
          className="bg-transparent pb-1 text-center text-4xl font-medium text-slate-700 focus:outline-none focus:ring-0"
          type="text"
          inputMode="decimal"
          value={amount}
          autoFocus
        />
      </div>
      <div className="text-center text-xs text-slate-500">
        Outstanding debt:{" "}
        <span className="font-semibold text-slate-600">
          ₹{formatAmount(initialAmount)}
        </span>
      </div>
    </div>
  );
}

export default SettlementAmountInput;
