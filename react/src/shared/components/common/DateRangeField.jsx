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

function formatDisplayDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function normalizeRange(start, end) {
  if (start && end && start > end) {
    return [end, start];
  }

  return [start, end];
}

const DateRangeButtonInput = forwardRef(function DateRangeButtonInput(
  { value, onClick, placeholder, disabled },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="erp-date-picker-trigger"
    >
      <span className={`truncate text-left ${value ? "text-[#1d2730]" : "text-[#8aa0b2]"}`}>
        {value || placeholder || "Select date range"}
      </span>
      <span className="erp-date-picker-icon">
        <i className="fas fa-calendar-alt text-[12px]" />
      </span>
    </button>
  );
});

export function DateRangeField({
  startValue,
  endValue,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  className = ""
}) {
  const [startDate, endDate] = normalizeRange(parseDate(startValue), parseDate(endValue));
  const displayValue = startDate && endDate
    ? `${formatDisplayDate(formatDateValue(startDate))} - ${formatDisplayDate(formatDateValue(endDate))}`
    : startDate
      ? `${formatDisplayDate(formatDateValue(startDate))} - End date`
      : "";

  return (
    <div className={className}>
      <DatePicker
        selectsRange
        startDate={startDate}
        endDate={endDate}
        onChange={(dates) => {
          const [nextStart, nextEnd] = dates;
          let start = nextStart;
          let end = nextEnd;

          if (startDate && !endDate && nextStart && !nextEnd && nextStart < startDate) {
            start = nextStart;
            end = startDate;
          }

          const [normalizedStart, normalizedEnd] = normalizeRange(start, end);

          onChange?.({
            start: formatDateValue(normalizedStart),
            end: formatDateValue(normalizedEnd)
          });
        }}
        disabled={disabled}
        calendarClassName="erp-date-picker-calendar"
        popperClassName="erp-date-picker-popper"
        wrapperClassName="block w-full"
        dateFormat="MMMM d, yyyy"
        showPopperArrow={false}
        fixedHeight
        customInput={
          <DateRangeButtonInput
            value={displayValue}
            placeholder={placeholder}
          />
        }
      />
    </div>
  );
}
