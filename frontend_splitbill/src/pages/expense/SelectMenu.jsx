import Select from "react-select";
import CreatableSelect from "react-select/creatable";

export default function SelectMenu({
  options = [],
  value,
  onChange,
  field,
  label,
  placeholder,
  isMultiSelect,
  closeMenuOnSelect,
  isCreatable = false,
  onCreateOption,
  formatOptionLabel,
  additionalInfo = "",
  required = true
}) {
  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "44px",
      borderRadius: "10px",
      borderColor: state.isFocused ? "#60a5fa" : "#cbd5e1",
      boxShadow: state.isFocused ? "0 0 0 2px #dbeafe" : "none",
      "&:hover": {
        borderColor: "#60a5fa",
      },
      backgroundColor: "#ffffff",
      cursor: "text",
    }),

    valueContainer: (base) => ({
      ...base,
      padding: "0px 10px",
      gap: "2px",
    }),

    placeholder: (base) => ({
      ...base,
      color: "#94a3b8",
      fontSize: "14px",
    }),

    input: (base) => ({
      ...base,
      color: "#334155",
      fontSize: "14px",
    }),

    multiValue: (base) => ({
      ...base,
      backgroundColor: "#eff6ff",
      borderRadius: "6px",
    }),

    multiValueLabel: (base) => ({
      ...base,
      color: "#1886e0",
      fontSize: "13px",
      fontWeight: 500,
      padding: "4px 6px",
    }),

    multiValueRemove: (base) => ({
      ...base,
      color: "#60a5fa",
      borderRadius: "0 6px 6px 0",

      "&:hover": {
        backgroundColor: "#dbeafe",
        color: "#1d4ed8",
      },
    }),

    menu: (base) => ({
      ...base,
      marginTop: "4px",
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid #e2e8f0",
      boxShadow: "0 8px 20px rgba(59, 130, 246, 0.12)",
    }),

    menuList: (base) => ({
      ...base,
      padding: "6px",
      maxHeight: "220px",
    }),

    option: (base, state) => ({
      ...base,
      borderRadius: "7px",
      padding: "4px 10px",
      fontSize: "14px",
      color: state.isSelected ? "#2563eb" : "#334155",
      backgroundColor: state.isSelected
        ? "#eff6ff"
        : state.isFocused
          ? "#f8fafc"
          : "#ffffff",

      cursor: "pointer",

      "&:active": {
        backgroundColor: "#dbeafe",
      },
    }),

    noOptionsMessage: (base) => ({
      ...base,
      color: "#94a3b8",
      fontSize: "14px",
    }),

    clearIndicator: (base) => ({
      ...base,
      color: "#94a3b8",

      "&:hover": {
        cursor: "pointer",
        color: "#ef4444",
      },
    }),

    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? "#3b82f6" : "#94a3b8",

      "&:hover": {
        color: "#2563eb",
      },
    }),

    indicatorSeparator: () => ({
      display: "none",
    }),
  };

  const handleChange = (newValue, actionMeta) => {
    if (actionMeta.action === "clear") {
      if (isMultiSelect) {
        onChange((value ?? []).filter((option) => option.isFixed));
      } else {
        onChange(null);
      }

      return;
    }

    if (
      isMultiSelect &&
      ["remove-value", "pop-value"].includes(actionMeta.action) &&
      actionMeta.removedValue?.isFixed
    ) {
      return;
    }

    onChange(newValue);
  };

  const SelectComponent = isCreatable ? CreatableSelect : Select;

  return (
    <div className="">
      <label htmlFor={field} className={`form-lbl ${additionalInfo.length > 0 ? `pb-1` : `pb-2`}`}>
        {label}{required && <span className="text-red-400 text-sm">*</span>}
      </label>
      {
        additionalInfo.length > 0 && <p className="text-xs italic text-slate-500 pb-3">{additionalInfo}</p>
      }
      <SelectComponent
        id={field}
        isMulti={isMultiSelect}
        options={options}
        formatOptionLabel={formatOptionLabel}
        value={value}
        onChange={handleChange}
        isSearchable
        isClearable
        placeholder={placeholder}
        closeMenuOnSelect={closeMenuOnSelect}
        styles={customStyles}
        onCreateOption={isCreatable ? onCreateOption : undefined}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
      />
    </div>
  );
}
