const EmployeeTaskFilters = ({
  filters,
  onStatusChange,
  onPeriodMenuToggle,
  isPeriodMenuOpen,
  periodFieldLabel,
  periodOptions,
  onPeriodSelect,
  periodMenuRef,
  customDateInputRef,
  onCustomDateChange,
  formatDateOptionLabel
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Status</label>
        <select className="input" value={filters.status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="all">All</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <div className="relative" ref={periodMenuRef}>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Task Period</label>
        <button
          type="button"
          className="input flex w-full items-center justify-between text-left"
          onClick={onPeriodMenuToggle}
        >
          <span>{periodFieldLabel}</span>
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 transition-transform ${isPeriodMenuOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isPeriodMenuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-dsr-border bg-white p-2 shadow-lg">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  filters.period === option.value
                    ? "bg-dsr-soft font-semibold text-dsr-ink"
                    : "text-dsr-ink hover:bg-dsr-soft"
                }`}
                onClick={() => onPeriodSelect(option.value)}
              >
                {option.value === "custom" && filters.period === "custom"
                  ? formatDateOptionLabel(filters.date)
                  : option.label}
              </button>
            ))}
          </div>
        )}

        <input
          ref={customDateInputRef}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={filters.date}
          onChange={(event) => onCustomDateChange(event.target.value)}
        />
      </div>
    </div>
  );
};

export default EmployeeTaskFilters;