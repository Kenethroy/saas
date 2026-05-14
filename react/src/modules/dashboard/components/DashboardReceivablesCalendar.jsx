import { useEffect, useState } from "react";
import { Skeleton } from "@/shared/components/common/Skeleton";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function humanizeLabel(value) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPriorityClasses(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "high") {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  if (normalized === "medium") {
    return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
  }

  return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
}

function resolveDefaultSelectedDate(calendar, year, month) {
  if (!calendar?.days?.length) {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  const now = new Date();
  const todayKey = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayEntry = calendar.days.find((entry) => entry.date === todayKey && entry.dueCount > 0);

  if (todayEntry) {
    return todayEntry.date;
  }

  const firstDueEntry = calendar.days.find((entry) => entry.dueCount > 0);
  return firstDueEntry?.date ?? calendar.days[0].date;
}

export function DashboardReceivablesCalendar({
  title,
  description,
  calendar,
  monthLabel,
  month,
  year,
  isLoading,
  onPreviousMonth,
  onNextMonth,
  isMonthChanging = false,
  errorMessage = ""
}) {
  const [selectedDate, setSelectedDate] = useState(resolveDefaultSelectedDate(calendar, year, month));

  useEffect(() => {
    if (!calendar) {
      return;
    }

    setSelectedDate(resolveDefaultSelectedDate(calendar, year, month));
  }, [calendar, year, month]);

  const selectedDay = calendar?.days?.find((entry) => entry.date === selectedDate) ?? null;
  const selectedMonth = Number(calendar?.days?.[0]?.date?.slice(5, 7) ?? 1);
  const blankCells = Array.from({ length: calendar?.startsOn ?? 0 }, (_, index) => (
    <div key={`blank-${index}`} className="min-h-[86px] rounded-sm border border-dashed border-[#edf2f6] bg-[#fbfdff]" />
  ));

  return (
    <section className="table-card self-start overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <div className="flex flex-col gap-3 border-b border-[#deebf2] bg-[linear-gradient(180deg,#fcfeff_0%,#f4f8fb_100%)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6c88a1]">Collections Planning</div>
          <div className="mt-1 text-[15px] font-bold tracking-[0.01em] text-[#17324d]">{title}</div>
          <div className="mt-1 text-[12px] text-[#5f7488]">{description}</div>
        </div>

        <div className="inline-flex items-center rounded-full border border-[#d7e4ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#60798e]">
          Due-Date View
        </div>
      </div>

      {errorMessage && !isLoading ? (
        <div className="px-5 py-8 text-[11px] text-[#c62828]">{errorMessage}</div>
      ) : isLoading ? (
        <div className="space-y-4 px-5 py-5">
          <Skeleton className="h-[420px] w-full" />
        </div>
      ) : (
        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[20px] border border-[#dce5ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[14px] font-bold text-[#17324d]">{monthLabel} {year}</div>
                  <div className="mt-1 text-[11px] text-[#607d8b]">Daily due schedule</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onPreviousMonth}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#d7e3ec] bg-white text-[#607d8b] transition-colors hover:border-[#90caf9] hover:text-[#0070b8]"
                    aria-label="Previous month"
                  >
                    <i className="fas fa-chevron-left text-[11px]" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextMonth}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#d7e3ec] bg-white text-[#607d8b] transition-colors hover:border-[#90caf9] hover:text-[#0070b8]"
                    aria-label="Next month"
                  >
                    <i className="fas fa-chevron-right text-[11px]" />
                  </button>
                </div>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-1 text-center text-[9px] font-bold uppercase tracking-[0.4px] text-[#78909c] sm:text-[10px]">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {blankCells}
                {(calendar?.days ?? []).map((entry) => {
                  const isSelected = entry.date === selectedDate;
                  const hasDue = entry.dueCount > 0;

                  return (
                    <button
                      key={entry.date}
                      type="button"
                      onClick={() => setSelectedDate(entry.date)}
                      className={`min-h-[72px] rounded-sm border px-1.5 py-2 text-left transition-all sm:min-h-[86px] sm:px-2 ${
                        isSelected
                          ? "border-[#0070b8] bg-[#e8f1f8] shadow-[0_8px_18px_rgba(0,112,184,0.12)]"
                          : hasDue
                            ? "border-[#cfe0ec] bg-white hover:border-[#90caf9] hover:bg-[#f8fbff]"
                            : "border-[#edf2f6] bg-[#fbfdff] hover:border-[#d7e3ec]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[11px] font-bold sm:text-[12px] ${isSelected ? "text-[#0070b8]" : "text-[#1a3557]"}`}>{entry.day}</span>
                        {entry.highPriorityCount > 0 ? (
                          <span className="inline-flex rounded-full bg-[#fff5f5] px-1.5 py-0.5 text-[9px] font-bold text-[#c62828]">
                            {entry.highPriorityCount}H
                          </span>
                        ) : null}
                      </div>

                      {hasDue ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-[9px] font-bold text-[#1a3557] sm:text-[10px]">{entry.dueCount} due</div>
                          <div className="text-[9px] text-[#607d8b] sm:text-[10px]">{formatCurrency(entry.totalOutstanding)}</div>
                          {entry.overdueCount > 0 ? (
                            <div className="text-[9px] font-bold uppercase tracking-[0.3px] text-[#c62828]">
                              {entry.overdueCount} overdue
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-6 text-[9px] uppercase tracking-[0.3px] text-[#b0bec5]">No due</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {isMonthChanging ? (
                <div className="mt-3 text-[10px] text-[#607d8b]">Loading calendar month...</div>
              ) : null}
            </div>

            <div className="rounded-[20px] border border-[#dce5ec] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="border-b border-[#e8eef3] bg-[#f8fbfd] px-4 py-4">
                <div className="text-[13px] font-bold text-[#17324d]">
                  {selectedDay ? `${monthLabel} ${selectedDay.day}, ${year}` : `${monthLabel} ${year}`}
                </div>
                <div className="mt-1 text-[11px] text-[#607d8b]">
                  {selectedDay?.dueCount ? `${selectedDay.dueCount} receivable accounts due` : "No due receivables for the selected day"}
                </div>
              </div>

              <div className="space-y-3 px-4 py-4">
                {selectedDay?.items?.length ? (
                  selectedDay.items.map((item) => (
                    <div key={`${selectedDay.date}-${item.id}`} className="rounded-[16px] border border-[#dce5ec] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[12px] font-bold text-[#17324d]">{item.customerName}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#607d8b]">
                            {item.invoiceNumber}
                            {item.salesOrderNumber ? ` · ${item.salesOrderNumber}` : ""}
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getPriorityClasses(item.priority)}`}>
                          {humanizeLabel(item.priority)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-[11px] text-[#607d8b] sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-[12px] bg-white px-3 py-2">
                          <div className="font-bold text-[#17324d]">{formatCurrency(item.outstandingAmount)}</div>
                          <div>Outstanding</div>
                        </div>
                        <div className="rounded-[12px] bg-white px-3 py-2">
                          <div className="font-bold text-[#17324d]">{item.daysOverdue > 0 ? `${item.daysOverdue} days` : "Current"}</div>
                          <div>{humanizeLabel(item.agingBucket)}</div>
                        </div>
                        <div className="rounded-[12px] bg-white px-3 py-2">
                          <div className="font-bold text-[#17324d]">{item.agentName}</div>
                          <div>{item.agentCode}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-sm border border-dashed border-[#dce5ec] bg-[#fbfdff] px-4 py-10 text-center text-[11px] text-[#90a4ae]">
                    No receivables due on this date.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}