import React from "react";

function NavigationState({
  value,
  label,
  activeState,
  handleClick,
  completed,
  disabled = false,
}) {
  const isActive = activeState === value;

  return (
    <div className="flex-1 text-center group">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-current={isActive ? "step" : undefined}
        className={`w-full pb-2 text-lg disabled:cursor-not-allowed disabled:opacity-50 ${
          completed
            ? "font-medium bg-gradient-to-r from-green-500 via-green-400 to-green-700 bg-clip-text text-transparent"
            : isActive
              ? "glittery-shadow"
              : "text-slate-500 enabled:group-hover:text-slate-600"
        }`}
      >
        {label}
      </button>

      <hr
        className={`border-0 h-0.5 ${
          completed
            ? "bg-green-400"
            : isActive
              ? "bg-sky-400"
              : "bg-slate-200 group-hover:bg-slate-300"
        }`}
      />
    </div>
  );
}
export default NavigationState;
