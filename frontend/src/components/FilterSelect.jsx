import { useEffect, useMemo, useRef, useState } from "react";

const FilterSelect = ({ value, options, onChange, placeholder = "Select an option" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`input flex w-full items-center justify-between gap-3 text-left transition ${
          isOpen ? "border-dsr-brand ring-2 ring-[color:color-mix(in_srgb,var(--dsr-brand)_20%,white)]" : ""
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate text-dsr-ink">{selectedOption?.label || placeholder}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);

            return (
              <button
                key={String(option.value)}
                type="button"
                className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? "bg-dsr-brand text-white shadow-sm"
                    : "text-dsr-ink hover:bg-dsr-soft"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterSelect;
