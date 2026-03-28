const PendingTasksSummary = ({ pending = 0, inProgress = 0, title = "Yesterday Carry Over" }) => {
  const pendingCount = Number(pending) || 0;
  const inProgressCount = Number(inProgress) || 0;
  const totalOpen = pendingCount + inProgressCount;
  const hasCarryOver = totalOpen > 0;

  return (
    <aside
      className={`rounded-2xl border p-4 shadow-sm ${
        hasCarryOver ? "border-rose-300 bg-rose-50" : "border-emerald-200 bg-emerald-50"
      }`}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-dsr-muted">{title}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            hasCarryOver ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {totalOpen} open
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-rose-200 bg-white/70 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Pending</p>
          <p className="mt-1 text-lg font-bold text-rose-700">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">In Progress</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{inProgressCount}</p>
        </div>
      </div>

      <p className={`mt-3 text-sm font-semibold ${hasCarryOver ? "text-rose-700" : "text-emerald-700"}`}>
        {hasCarryOver ? "Action needed: unresolved tasks from yesterday." : "All clear: no carry-over tasks."}
      </p>
    </aside>
  );
};

export default PendingTasksSummary;
