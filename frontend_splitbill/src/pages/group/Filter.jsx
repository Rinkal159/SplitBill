function Filter({
  value,
  subvalues = [],
  doApplyBorder = true,
  isActive,
  onClick,
  onSubvalueClick,
}) {
  return (
    <span
      onClick={onClick}
      className={`relative group cursor-pointer text-slate-400
        after:content-['']
        after:absolute after:left-0 after:-bottom-2
        after:h-[2px] after:w-full after:bg-slate-400
        after:transition-transform after:duration-300
        after:origin-left
        ${isActive ? "after:scale-x-100 text-slate-600" : "after:scale-x-0"}
        ${doApplyBorder ? "border-r border-slate-200" : ""}
        hover:text-slate-500
        trans
        px-4
      `}
    >
      <span className="inline-flex items-center gap-2">
        {value}

        {subvalues.length > 0 && (
          <i className="fa-solid fa-chevron-down text-xs transition-transform duration-200"></i>
        )}
      </span>

      {/* Dropdown */}
      {subvalues.length > 0 && (
        <div
          className="absolute left-0 top-full z-50 mt-2
            min-w-48 max-w-64
            max-h-0 overflow-hidden opacity-0 invisible
            group-hover:max-h-60 group-hover:overflow-y-auto
            group-hover:opacity-100 group-hover:visible
            transition-all duration-300 ease-in-out
            rounded-lg border border-slate-200
            bg-white shadow-lg"
        >
          {subvalues.map((subvalue, index) => (
            <div
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onSubvalueClick(
                  typeof subvalue === "string" ? subvalue : subvalue.id,
                  value,
                );
              }}
              className="px-4 py-2.5 text-xs font-semibold text-slate-500
                 hover:text-slate-800
                transition-colors duration-150
                whitespace-nowrap"
            >
              {typeof subvalue === "string" ? subvalue : subvalue.value}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

export default Filter;
