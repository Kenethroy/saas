function buildVisiblePages(currentPage, lastPage) {
  const pages = [];

  if (lastPage <= 7) {
    for (let page = 1; page <= lastPage; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  if (currentPage <= 4) {
    for (let page = 1; page <= 5; page += 1) {
      pages.push(page);
    }
    pages.push("...");
    pages.push(lastPage);
    return pages;
  }

  if (currentPage >= lastPage - 3) {
    pages.push(1);
    pages.push("...");
    for (let page = lastPage - 4; page <= lastPage; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  pages.push(1);
  pages.push("...");
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    pages.push(page);
  }
  pages.push("...");
  pages.push(lastPage);

  return pages;
}

export function Pagination({
  currentPage,
  lastPage,
  perPage,
  total,
  itemLabel = "items",
  loading = false,
  onPrevious,
  onNext,
  onGoto
}) {
  if (!total || lastPage <= 1 || total <= perPage) {
    return null;
  }

  const displayStart = (currentPage - 1) * perPage + 1;
  const displayEnd = Math.min(currentPage * perPage, total);
  const visiblePages = buildVisiblePages(currentPage, lastPage);

  return (
    <div className="flex items-center justify-between border-t border-[#e8ecef] bg-[#f9fafc] px-4 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-[#90a4ae]">
        <i className="fas fa-list text-[9px]" aria-hidden="true" />
        <span>
          Showing <span className="font-mono font-bold text-[#546e7a]">{displayStart}</span>-
          <span className="font-mono font-bold text-[#546e7a]">{displayEnd}</span> of{" "}
          <span className="font-mono font-bold text-ink">{total}</span> {itemLabel}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1 || loading}
          className={`inline-flex h-7 items-center gap-1 rounded-sm border px-2.5 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            currentPage <= 1 || loading
              ? "cursor-not-allowed border-[#b0bec5] bg-[#f3f6f9] text-[#90a4ae]"
              : "border-[#b0bec5] bg-white text-[#546e7a] hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
          }`}
        >
          <i className="fas fa-chevron-left text-[9px]" aria-hidden="true" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {visiblePages.map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-7 min-w-[24px] select-none items-end justify-center pb-0.5 text-[12px] font-bold text-[#90a4ae]"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onGoto(page)}
              disabled={loading}
              className={`h-7 min-w-[28px] rounded-sm border px-2 text-[11px] font-mono font-bold transition-all disabled:cursor-not-allowed ${
                page === currentPage
                  ? "cursor-default border-ink bg-ink text-white shadow-sm"
                  : "border-[#b0bec5] bg-white text-[#546e7a] hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= lastPage || loading}
          className={`inline-flex h-7 items-center gap-1 rounded-sm border px-2.5 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            currentPage >= lastPage || loading
              ? "cursor-not-allowed border-[#b0bec5] bg-[#f3f6f9] text-[#90a4ae]"
              : "border-[#b0bec5] bg-white text-[#546e7a] hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
          }`}
        >
          <span className="hidden sm:inline">Next</span>
          <i className="fas fa-chevron-right text-[9px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
