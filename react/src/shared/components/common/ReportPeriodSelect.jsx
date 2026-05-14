import { useEffect, useMemo, useRef, useState } from "react";
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

const presetOptions = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" }
];

function getButtonLabel(period, startValue, endValue) {
  if (period === "custom") {
    const [normalizedStart, normalizedEnd] = normalizeRange(parseDate(startValue), parseDate(endValue));

    if (normalizedStart && normalizedEnd) {
      return `Custom Range: ${formatDisplayDate(formatDateValue(normalizedStart))} - ${formatDisplayDate(formatDateValue(normalizedEnd))}`;
    }

    return "Custom Range";
  }

  return presetOptions.find((option) => option.value === period)?.label ?? "Select period";
}

export function ReportPeriodSelect({
  value,
  startValue,
  endValue,
  onChange,
  className = ""
}) {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => normalizeRange(parseDate(startValue), parseDate(endValue))[0]);
  const [draftEnd, setDraftEnd] = useState(() => normalizeRange(parseDate(startValue), parseDate(endValue))[1]);

  useEffect(() => {
    const [normalizedStart, normalizedEnd] = normalizeRange(parseDate(startValue), parseDate(endValue));
    setDraftStart(normalizedStart);
    setDraftEnd(normalizedEnd);
  }, [startValue, endValue]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setCalendarOpen(false);
        const [normalizedStart, normalizedEnd] = normalizeRange(parseDate(startValue), parseDate(endValue));
        setDraftStart(normalizedStart);
        setDraftEnd(normalizedEnd);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        setCalendarOpen(false);
        const [normalizedStart, normalizedEnd] = normalizeRange(parseDate(startValue), parseDate(endValue));
        setDraftStart(normalizedStart);
        setDraftEnd(normalizedEnd);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [startValue, endValue]);

  const buttonLabel = useMemo(() => getButtonLabel(value, startValue, endValue), [value, startValue, endValue]);

  function handlePresetSelect(nextValue) {
    if (nextValue === "custom") {
      setOpen(true);
      setCalendarOpen(true);
      const [normalizedStart, normalizedEnd] = normalizeRange(parseDate(startValue), parseDate(endValue));
      setDraftStart(normalizedStart);
      setDraftEnd(normalizedEnd);
      return;
    }

    onChange?.({
      period: nextValue,
      start: startValue,
      end: endValue
    });
    setOpen(false);
    setCalendarOpen(false);
  }

  function handleRangeChange(dates) {
    const [nextStart, nextEnd] = dates;
    let start = nextStart;
    let end = nextEnd;

    if (draftStart && !draftEnd && nextStart && !nextEnd && nextStart < draftStart) {
      start = nextStart;
      end = draftStart;
    }

    const [normalizedStart, normalizedEnd] = normalizeRange(start, end);
    setDraftStart(normalizedStart);
    setDraftEnd(normalizedEnd);

    if (normalizedStart && normalizedEnd) {
      onChange?.({
        period: "custom",
        start: formatDateValue(normalizedStart),
        end: formatDateValue(normalizedEnd)
      });
      setOpen(false);
      setCalendarOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={`relative min-w-[220px] ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (!next) {
              setCalendarOpen(false);
            }
            return next;
          });
        }}
        className="erp-select flex min-h-[38px] items-center justify-between gap-3 text-left"
      >
        <span className={`block truncate ${value === "custom" ? "text-[#1d2730]" : "text-[#1d2730]"}`}>
          {buttonLabel}
        </span>
        <i className={`fas ${open ? "fa-chevron-up" : "fa-chevron-down"} shrink-0 text-[11px] text-[#78909c]`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[340px] overflow-hidden rounded-[16px] border border-[#d7e3ec] bg-white shadow-[0_16px_40px_rgba(26,53,87,0.14)]">
          {!calendarOpen ? (
            <div className="p-2">
              {presetOptions.map((option) => {
                const isActive = value === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePresetSelect(option.value)}
                    className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[12px] transition ${
                      isActive
                        ? "bg-[#e8f1f8] font-bold text-[#1a3557]"
                        : "text-[#546e7a] hover:bg-[#f6fbff] hover:text-[#1a3557]"
                    }`}
                  >
                    <span>{option.label}</span>
                    {option.value === "custom" ? <i className="fas fa-calendar-alt text-[11px] text-[#78909c]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCalendarOpen(false)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#d7e3ec] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1a3557] transition hover:bg-[#f5f9fc]"
                >
                  <i className="fas fa-chevron-left text-[10px]" />
                  Back
                </button>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#90a4ae]">Custom Range</div>
                  <div className="mt-0.5 text-[11px] text-[#607d8b]">
                    {draftStart && draftEnd
                      ? `${formatDisplayDate(formatDateValue(draftStart))} - ${formatDisplayDate(formatDateValue(draftEnd))}`
                      : "Select start and end dates"}
                  </div>
                </div>
              </div>

              <DatePicker
                inline
                selectsRange
                startDate={draftStart}
                endDate={draftEnd}
                onChange={handleRangeChange}
                calendarClassName="erp-date-picker-calendar"
                monthsShown={1}
                showPopperArrow={false}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
