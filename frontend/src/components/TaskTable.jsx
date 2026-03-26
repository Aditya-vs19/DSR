import { useEffect, useState } from "react";

const statusClass = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800"
};

const formatTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};

const TaskTable = ({
  tasks = [],
  onStatusChange,
  editableStatus = false,
  showAssignee = false,
  showAssigner = false,
  showSubmitToHr = false,
  onSubmitToHr,
  submittingTaskId = null,  
  showReassign = false,
  reassignOptions = [],
  onReassign,
  reassigningTaskId = null,
  focusedTaskId = null
}) => {
  const [dependencyDrafts, setDependencyDrafts] = useState({});
  const [dependencyEditing, setDependencyEditing] = useState({});
  const [dependencyToast, setDependencyToast] = useState({ show: false, kind: "success", message: "" });
  const [reassignModalTask, setReassignModalTask] = useState(null);
  const [reassignSelectionId, setReassignSelectionId] = useState("");

  useEffect(() => {
    setDependencyDrafts(() => {
      const next = {};
      tasks.forEach((task) => {
        next[task.id] = task.dependency ?? "";
      });
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    setDependencyEditing(() => {
      const next = {};
      tasks.forEach((task) => {
        next[task.id] = !task.dependency;
      });
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    if (!dependencyToast.show) {
      return;
    }

    const timer = setTimeout(() => {
      setDependencyToast({ show: false, kind: "success", message: "" });
    }, 2200);

    return () => clearTimeout(timer);
  }, [dependencyToast]);

  useEffect(() => {
    if (!focusedTaskId) {
      return;
    }

    const rowElement = document.querySelector(`[data-task-id='${focusedTaskId}']`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedTaskId, tasks]);

  const getDependencyValue = (item) => dependencyDrafts[item.id] ?? item.dependency ?? "";

  const handleDependencySave = async (item) => {
    if (!onStatusChange) {
      return;
    }

    const dependency = String(getDependencyValue(item)).trim();
    if (!dependency) {
      return;
    }

    try {
      await onStatusChange(item, item.status, dependency);
      setDependencyEditing((prev) => ({ ...prev, [item.id]: false }));
      setDependencyToast({ show: true, kind: "success", message: "Dependency saved" });
    } catch {
      setDependencyToast({ show: true, kind: "error", message: "Failed to save dependency" });
    }
  };

  const openReassignModal = (item) => {
    setReassignModalTask(item);
    setReassignSelectionId("");
  };

  const closeReassignModal = () => {
    setReassignModalTask(null);
    setReassignSelectionId("");
  };

  const handleConfirmReassign = async () => {
    if (!reassignModalTask || !reassignSelectionId || !onReassign) {
      return;
    }

    await onReassign(reassignModalTask, Number(reassignSelectionId));
    closeReassignModal();
  };

  const availableReassignOptions = reassignModalTask
    ? reassignOptions.filter((member) => Number(member.id) !== Number(reassignModalTask.assigned_to))
    : [];

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
            <th className="p-3">Sr No</th>
            <th className="p-3">Client</th>
            <th className="p-3">Task</th>
            <th className="p-3">Action</th>
            <th className="p-3">Status</th>
            <th className="p-3">Assigned Time</th>
            <th className="p-3">Completed Time</th>
            <th className="p-3">Dependency</th>
            {showAssignee && <th className="p-3">Assigned To</th>}
            {showAssigner && <th className="p-3">Assigned By</th>}
            {showSubmitToHr && <th className="p-3">HR Submit</th>}
            {showReassign && <th className="p-3">Reassign</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((item, index) => {
            const overdue = item.deadline && item.status !== "Completed" && new Date(item.deadline) < new Date();
            const isCompletedTask = item.status === "Completed";

            return (
              <tr
                key={item.id}
                data-task-id={item.id}
                className={`border-b border-slate-100 ${
                  Number(focusedTaskId) === Number(item.id)
                    ? "bg-emerald-50"
                    : overdue
                      ? "bg-rose-50"
                      : ""
                }`}
              >
                <td className="p-3">{index + 1}</td>
                <td className="p-3 font-medium">{item.client}</td>
                <td className="p-3">{item.task}</td>
                <td className="p-3">{item.action}</td>
                <td className="p-3">
                  {editableStatus ? (
                    <select
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status] || "bg-slate-100 text-slate-700"}`}
                      value={item.status}
                      onChange={(event) => onStatusChange(item, event.target.value, getDependencyValue(item))}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">{formatTime(item.created_at)}</td>
                <td className="p-3 whitespace-nowrap">{item.status === "Completed" ? formatTime(item.completed_at) : ""}</td>
                <td className="p-3">
                  {item.status === "Completed" ? (
                    "-"
                  ) : editableStatus ? (
                    dependencyEditing[item.id] ? (
                      <div className="flex min-w-[220px] items-center gap-2">
                        <input
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
                          type="text"
                          placeholder="Add dependency"
                          value={getDependencyValue(item)}
                          onChange={(event) =>
                            setDependencyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                          disabled={!getDependencyValue(item).trim()}
                          onClick={() => void handleDependencySave(item)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex min-w-[220px] items-center gap-2">
                        <span className="truncate text-sm text-slate-700">{item.dependency || "-"}</span>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() =>
                            setDependencyEditing((prev) => ({
                              ...prev,
                              [item.id]: true
                            }))
                          }
                        >
                          Edit
                        </button>
                      </div>
                    )
                  ) : (
                    item.dependency || "-"
                  )}
                </td>
                {showAssignee && <td className="p-3">{item.assigned_to_name || "-"}</td>}
                {showAssigner && <td className="p-3">{item.assigned_by_name || "-"}</td>}
                {showSubmitToHr && (
                  <td className="p-3">
                    {Number(item.submitted_to_hr) === 1 ? (
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                        Submitted
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!onSubmitToHr || submittingTaskId === item.id}
                        onClick={() => onSubmitToHr?.(item)}
                      >
                        {submittingTaskId === item.id ? "Submitting..." : "Submit to HR"}
                      </button>
                    )}
                  </td>
                )}
                {showReassign && (
                  <td className="p-3">
                    {isCompletedTask ? (
                      <span className="text-xs text-slate-500">-</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary whitespace-nowrap"
                        disabled={!onReassign || reassigningTaskId === item.id}
                        onClick={() => openReassignModal(item)}
                      >
                        {reassigningTaskId === item.id ? "Reassigning..." : "Reassign"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {tasks.length === 0 && (
            <tr>
              <td
                colSpan={
                  8 +
                  (showAssignee ? 1 : 0) +
                  (showAssigner ? 1 : 0) +
                  (showSubmitToHr ? 1 : 0) +
                  (showReassign ? 1 : 0)
                }
                className="p-4 text-center text-slate-500"
              >
                No tasks available
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {reassignModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-dsr-ink">Reassign Task</h3>
            <p className="mt-1 text-sm text-dsr-muted">Task: {reassignModalTask.task}</p>
            <p className="mt-1 text-sm text-dsr-muted">Current assignee: {reassignModalTask.assigned_to_name || "-"}</p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">
                Select employee
              </label>
              <select
                className="input"
                value={reassignSelectionId}
                onChange={(event) => setReassignSelectionId(event.target.value)}
              >
                <option value="">Choose employee</option>
                {availableReassignOptions.map((member) => (
                  <option key={member.id} value={String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeReassignModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!reassignSelectionId || reassigningTaskId === reassignModalTask.id}
                onClick={() => void handleConfirmReassign()}
              >
                {reassigningTaskId === reassignModalTask.id ? "Reassigning..." : "Confirm Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {dependencyToast.show && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg ${
              dependencyToast.kind === "error" ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {dependencyToast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskTable;
