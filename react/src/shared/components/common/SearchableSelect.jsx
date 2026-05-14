import { useEffect, useId, useRef, useState } from "react";

function normalizeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  disabled = false,
  error = "",
  emptyMessage = "No matching options found."
}) {
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const normalizedValue = normalizeValue(value);
  const selectedOption = options.find((option) => normalizeValue(option.value) === normalizedValue) ?? null;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearchTerm("");
    setHighlightedIndex(0);

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(Math.max(filteredOptions.length - 1, 0));
    }
  }, [filteredOptions.length, highlightedIndex]);

  function handleSelect(optionValue) {
    onChange?.(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  }

  function handleTriggerKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        handleSelect(option.value);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }

          setIsOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`erp-select flex h-9 items-center justify-between gap-3 text-left ${
          error ? "erp-input-error" : ""
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
      >
        <span className={selectedOption ? "truncate text-[#1d2730]" : "truncate text-[#90a4ae]"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <i className={`fas ${isOpen ? "fa-chevron-up" : "fa-chevron-down"} shrink-0 text-[10px] text-[#78909c]`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-sm border border-[#c9d6e2] bg-white shadow-[0_14px_30px_rgba(26,53,87,0.18)]">
          <div className="border-b border-[#e3ebf1] bg-[#f8fbfd] p-2">
            <div className="relative">
              <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#90a4ae]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                className="erp-input h-8 pl-8 text-[12px]"
                placeholder={searchPlaceholder}
              />
            </div>
          </div>

          <div id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-[#78909c]">{emptyMessage}</div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = normalizeValue(option.value) === normalizedValue;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={normalizeValue(option.value) || option.label}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] transition ${
                      isHighlighted ? "bg-[#eef5fa]" : "bg-white"
                    } ${isSelected ? "font-bold text-[#17324d]" : "text-[#1d2730]"}`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? <i className="fas fa-check shrink-0 text-[10px] text-[#0070b8]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}