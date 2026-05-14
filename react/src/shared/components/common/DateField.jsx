import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function parseDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DateButtonInput = forwardRef(function DateButtonInput(
  { value, onClick, placeholder, disabled, error },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`erp-date-picker-trigger ${error ? "erp-date-picker-trigger-error" : ""}`}
    >
      <span className={`truncate ${value ? "text-[#1d2730]" : "text-[#8aa0b2]"}`}>{value || placeholder || "Select date"}</span>
      <span className="erp-date-picker-icon">
        <i className="fas fa-calendar-alt text-[12px]" />
      </span>
    </button>
  );
});

export function DateField({
  value,
  onChange,
  min,
  max,
  name,
  id,
  label,
  error,
  disabled = false,
  placeholder = "Select date",
  className = ""
}) {
  const selectedDate = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  return (
    <div className={className}>
      {label ? <label htmlFor={id ?? name} className="erp-label">{label}</label> : null}
      <DatePicker
        selected={selectedDate}
        onChange={(date) => onChange?.(formatDateValue(date))}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        calendarClassName="erp-date-picker-calendar"
        popperClassName="erp-date-picker-popper"
        wrapperClassName="block w-full"
        dateFormat="MMMM d, yyyy"
        showPopperArrow={false}
        fixedHeight
        customInput={
          <DateButtonInput
            value={selectedDate ? selectedDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : ""}
            placeholder={placeholder}
            error={error}
          />
        }
        id={id ?? name}
        name={name}
      />
      {error ? <p className="mt-1 text-[10px] text-[#c62828]">{error}</p> : null}
    </div>
  );
}
