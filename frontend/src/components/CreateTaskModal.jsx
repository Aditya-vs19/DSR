const CreateTaskModal = ({
  open = false,
  title = "Create Task",
  form,
  onFieldChange,
  onSubmit,
  onClose,
  error = "",
  locked = false,
  lockedMessage = "",
  submitLabel = "Add Task",
  todayText = "",
  departmentOptions = [],
  showAssignment = false,
  employees = [],
  selfAssign = false,
  onSelfAssignChange,
  currentUserId = "",
  currentUserName = "Me"
}) => {
  if (!open) {
    return null;
  }

  const effectiveEmployees = showAssignment
    ? [
        ...employees,
        ...(currentUserId && !employees.some((entry) => Number(entry.id) === Number(currentUserId))
          ? [{ id: currentUserId, name: `${currentUserName} (Me)` }]
          : [])
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,246,0.96))] p-4 shadow-[0_28px_60px_rgba(31,42,34,0.16)]">
        <div className="flex items-start justify-between gap-4 rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,#f7fbf8,#eef5f0)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div>
            <h2 className="text-xl font-bold text-dsr-ink">{title}</h2>
            <p className="mt-1 text-sm text-dsr-muted">Keep it focused. Fill the essentials and schedule it when needed.</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dsr-border bg-white text-slate-500 transition hover:text-slate-700"
            onClick={onClose}
            aria-label="Close create task modal"
          >
            <span className="text-xl leading-none">x</span>
          </button>
        </div>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-900">Client / Vendor</span>
            <input
              className="input"
              value={form.client}
              disabled={locked}
              onChange={(event) => onFieldChange("client", event.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-900">Task Title</span>
            <input
              className="input"
              value={form.task}
              disabled={locked}
              onChange={(event) => onFieldChange("task", event.target.value)}
              required
            />
          </label>

          {showAssignment ? (
            <>
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">Assign To</span>
                <select
                  className="input"
                  value={form.assignedTo}
                  onChange={(event) => onFieldChange("assignedTo", event.target.value)}
                  disabled={selfAssign || locked}
                  required
                >
                  <option value="">Assign to team employee</option>
                  {effectiveEmployees
                    .filter((entry) => Number(entry.id) !== Number(currentUserId) || !selfAssign)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-dsr-border bg-dsr-soft px-3 py-2.5 text-sm text-dsr-muted">
                <input
                  type="checkbox"
                  checked={selfAssign}
                  disabled={locked}
                  onChange={(event) => onSelfAssignChange?.(event.target.checked)}
                />
                Self assign (assign to me)
              </label>
            </>
          ) : null}

          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-900">Task Department</span>
            <select
              className="input"
              value={form.taskDepartment}
              disabled={locked}
              onChange={(event) => onFieldChange("taskDepartment", event.target.value)}
              required
            >
              <option value="">Select department</option>
              {departmentOptions.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-900">Task Date</span>
            <input
              className="input"
              type="date"
              min={todayText}
              value={form.taskDate}
              onChange={(event) => onFieldChange("taskDate", event.target.value)}
              required
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-900">Priority</span>
            <select
              className="input"
              value={form.priority}
              disabled={locked}
              onChange={(event) => onFieldChange("priority", event.target.value)}
            >
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-900">Action</span>
            <textarea
              className="input"
              rows={4}
              value={form.action}
              disabled={locked}
              onChange={(event) => onFieldChange("action", event.target.value)}
              required
            />
          </label>

          {(error || lockedMessage) ? (
            <p className={`md:col-span-2 text-sm ${error ? "text-rose-600" : "text-amber-700"}`}>
              {error || lockedMessage}
            </p>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary min-w-[150px]" type="submit" disabled={locked}>
              {locked ? "Available Tomorrow" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
