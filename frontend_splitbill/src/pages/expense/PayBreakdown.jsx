import React from "react";

function PayBreakdown({
  heading,
  desc,
  selectedParticipants,
  idPart,
  handleChange,
  getter,
  setter,
  field,
  totalHeading,
  totalAmount,
  errors,
  showRupee,
}) {

  return (
    <div className="flex-1 space-y-1 mt-4">
      <label className="form-lbl">{heading}</label>

      <div>
        <p className="mb-3 text-xs text-slate-400">{desc}</p>

        <div className="max-h-[200px] space-y-2 overflow-y-auto">
          {selectedParticipants.map((participant, i) => (
            <div
              key={participant.value}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
            >
              <label
                htmlFor={`${idPart}-${participant.value}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600"
              >
                {participant.label}
              </label>

              <div className="relative w-32">
                {showRupee && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                )}

                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-right text-sm text-slate-700 outline-none trans placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(e) =>
                    handleChange(e, participant.value, setter, field)
                  }
                  value={
                    (getter.find((item) => item.id === participant.value)?.[
                      field
                    ] ?? 0) === 0
                      ? ""
                      : getter.find((item) => item.id === participant.value)?.[
                          field
                        ] ?? 0
                  }
                  id={`${idPart}-${participant.value}`}
                />

                {!showRupee && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    %
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-blue-100 pt-3">
          <span className="text-sm font-medium text-slate-500">
            {totalHeading}
          </span>

          <p className="text-base font-semibold text-blue-600">
            {showRupee && <span>₹</span>}
            {totalAmount}
            {!showRupee && <span>%</span>}
          </p>
        </div>
        {errors && (
          <div className="text-xs text-red-500 font-medium mt-2 text-center">
            {errors}
          </div>
        )}
      </div>
    </div>
  );
}

export default PayBreakdown;
