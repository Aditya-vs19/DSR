import { useEffect, useState } from "react";

const statusClass = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800"
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
  reassigningTaskId = null
}) => {
  const [dependencyDrafts, setDependencyDrafts] = useState({});
  const [reassignSelections, setReassignSelections] = useState({});

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
    setReassignSelections(() => {
      const next = {};
      tasks.forEach((task) => {
        next[task.id] = String(task.assigned_to || "");
      });
      return next;
    });
  }, [tasks]);

  const getDependencyValue = (item) => dependencyDrafts[item.id] ?? item.dependency ?? "";

  const handleDependencySave = async (item) => {
    const dependency = getDependencyValue(item).trim();
    if (!dependency || !onStatusChange) {
      return;
    }

    await onStatusChange(item, item.status, dependency);
  };

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
            const selectedAssigneeId = String(reassignSelections[item.id] ?? item.assigned_to ?? "");
            const canSubmitReassign =
              !isCompletedTask &&
              selectedAssigneeId &&
              Number(selectedAssigneeId) !== Number(item.assigned_to) &&
              Boolean(onReassign);

            return (
              <tr key={item.id} className={`border-b border-slate-100 ${overdue ? "bg-rose-50" : ""}`}>
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
                      <option value="Completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  )}
                  {item.completed_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Completed: {new Date(item.completed_at).toLocaleString()}
                    </p>
                  )}
                </td>
                <td className="p-3">
                  {item.status !== "Pending" ? (
                    "-"
                  ) : editableStatus && !item.dependency ? (
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
                      <div className="flex min-w-[220px] items-center gap-2">
                        <select
                          className="input py-1"
                          value={selectedAssigneeId}
                          onChange={(event) =>
                            setReassignSelections((prev) => ({
                              ...prev,
                              [item.id]: event.target.value
                            }))
                          }
                        >
                          <option value="">Select employee</option>
                          {reassignOptions.map((member) => (
                            <option key={member.id} value={String(member.id)}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary whitespace-nowrap"
                          disabled={!canSubmitReassign || reassigningTaskId === item.id}
                          onClick={() => onReassign?.(item, Number(selectedAssigneeId))}
                        >
                          {reassigningTaskId === item.id ? "Reassigning..." : "Reassign"}
                        </button>
                      </div>
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
                  6 +
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
    </div>
  );
};

export default TaskTable;
