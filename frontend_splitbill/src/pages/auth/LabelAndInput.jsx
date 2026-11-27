import React from "react";

function LabelAndInput({
  field,
  labelValue,
  type,
  person,
  placeholder,
  handleEvent,
  showError,
  errors = [],
  required = false,
  autoFocus=false,
  compact = false,
}) {
  const validErrors =
    errors.length > 0 && typeof errors === "string" ? errors : errors[field];
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <label htmlFor={field} className="form-lbl">
        {labelValue}
        {required && <span className="text-red-400 text-sm">*</span>}
      </label>
      <input
        className={compact ? "form-input !px-3 !py-2" : "form-input"}
        type={type}
        id={field}
        name={field}
        value={
          person == null
            ? null
            : typeof person === "string"
              ? person
              : person[field]
        }
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        onChange={handleEvent}
        autoFocus={autoFocus}
      />
      {showError && validErrors && (
        <div className="text-xs text-sky-600 font-medium mt-1">
          {validErrors}
        </div>
      )}
    </div>
  );
}

export default LabelAndInput;
