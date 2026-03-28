const PendingTasksSummary = ({ pending = 0, inProgress = 0, title = "Yesterday Carry Over", className = "" }) => {
  const pendingCount = Number(pending) || 0;
  const inProgressCount = Number(inProgress) || 0;
  const totalOpen = pendingCount + inProgressCount;
  const hasCarryOver = totalOpen > 0;

  return (
    <aside
      className={`w-full rounded-2xl border p-2 shadow-sm ${
        hasCarryOver ? "border-rose-300 bg-rose-50" : "border-emerald-200 bg-emerald-50"
      } ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-dsr-muted">{title}</p>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            hasCarryOver ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {totalOpen} open
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg border border-rose-200 bg-white/70 px-2 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Pending</p>
          <p className="text-lg font-bold leading-none text-rose-700">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white/70 px-2 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">In Progress</p>
          <p className="text-lg font-bold leading-none text-amber-700">{inProgressCount}</p>
        </div>
      </div>

      <p className={`mt-1.5 text-[10px] font-semibold ${hasCarryOver ? "text-rose-700" : "text-emerald-700"}`}>
        {hasCarryOver ? "Carry-over from yesterday." : "No carry-over tasks."}
      </p>
    </aside>
  );
};

export default PendingTasksSummary;
