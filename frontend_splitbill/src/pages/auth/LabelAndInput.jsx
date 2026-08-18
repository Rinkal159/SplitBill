import React from "react";

function LabelAndInput({
  field,
  labelValue,
  type,
  person,
  placeholder,
  handleEvent,
  showError,
  errors = []
}) {
  const validErrors = errors.length > 0 && typeof errors === "string" ? errors : errors[field]; 
  return (
    <div className="space-y-2">
      <label htmlFor={field} className="form-lbl">
        {labelValue}
      </label>
      <input
        className="form-input"
        type={type}
        id={field}
        name={field}
        value={typeof person === "string" ? person : person[field]}
        autoComplete="off"
        required
        placeholder={placeholder}
        onChange={handleEvent}
      />
      {showError && validErrors && (
        <div className="text-xs text-red-500 font-medium mt-1">
          {validErrors}
        </div>
      )}
    </div>
  );
}

export default LabelAndInput;
