import React from "react";

function LabelAndInput({
  field,
  labelValue,
  type,
  person,
  placeholder,
  handleEvent,
  showError,
  errors
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={field} className="form-lbl">
        {labelValue}
      </label>
      <input
        className="form-input"
        type={type}
        id={field}
        name={field}
        value={person[field]}
        autoComplete="off"
        required
        placeholder={placeholder}
        onChange={handleEvent}
      />
      {showError && errors[field] && (
        <div className="text-xs text-red-500 font-medium mt-1">
          {errors[field]}
        </div>
      )}
    </div>
  );
}

export default LabelAndInput;
