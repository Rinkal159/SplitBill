import React from "react";

function NavigationState({ value, label, activeState, handleClick }) {
  const isActive = activeState === value;

  return (
    <div className="flex-1 text-center group">
      <button
        type="button"
        onClick={handleClick}
        aria-current={isActive ? "step" : undefined}
        className={`w-full pb-2 text-sm ${
          isActive
            ? "font-semibold text-slate-500"
            : "text-slate-500"
        }`}
      >
        {label}
      </button>

      <hr
        className={`border-0 h-0.5 ${
          isActive ? "bg-slate-400" : "bg-slate-200 group-hover:bg-slate-300"
        }`}
      />
    </div>
  );
}
export default NavigationState;
