import { useEffect, useMemo, useState } from "react";

const TASKS_PER_PAGE = 10;

const statusClass = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-sky-100 text-sky-800",
  Completed: "bg-green-100 text-green-800"
};

const formatLocalDateTimeParts = (value) => {
  if (!value) {
    return null;
  }

  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(rawValue)
    ? rawValue.replace(" ", "T")
    : rawValue;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: parsed.toLocaleDateString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }),
    time: parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    })
  };
};

const formatUtcDateTimeParts = (value) => {
  if (!value) {
    return null;
  }

  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(rawValue)
    ? `${rawValue.replace(" ", "T")}Z`
    : rawValue;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: parsed.toLocaleDateString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }),
    time: parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    })
  };
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
  const [dependencyMeta, setDependencyMeta] = useState({});
  const [activeDependencyIds, setActiveDependencyIds] = useState({});
  const [skipPersistIds, setSkipPersistIds] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionMeta, setActionMeta] = useState({});
  const [activeActionIds, setActiveActionIds] = useState({});
  const [skipActionPersistIds, setSkipActionPersistIds] = useState({});
  const [taskTitleDrafts, setTaskTitleDrafts] = useState({});
  const [taskTitleMeta, setTaskTitleMeta] = useState({});
  const [activeTaskTitleIds, setActiveTaskTitleIds] = useState({});
  const [skipTaskTitlePersistIds, setSkipTaskTitlePersistIds] = useState({});
  const [reassignModalTask, setReassignModalTask] = useState(null);
  const [reassignSelectionId, setReassignSelectionId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE));
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    return tasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [currentPage, tasks]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setDependencyDrafts((prev) => {
      const next = {};
      tasks.forEach((task) => {
        const taskDependency = task.dependency ?? "";
        const isActive = Boolean(activeDependencyIds[task.id]);
        const isSaving = dependencyMeta[task.id]?.state === "saving";
        next[task.id] = isActive || isSaving ? prev[task.id] ?? taskDependency : taskDependency;
      });
      return next;
    });
  }, [tasks, dependencyMeta, activeDependencyIds]);

  useEffect(() => {
    setActionDrafts((prev) => {
      const next = {};
      tasks.forEach((task) => {
        const taskAction = task.action ?? "";
        const isActive = Boolean(activeActionIds[task.id]);
        const isSaving = actionMeta[task.id]?.state === "saving";
        next[task.id] = isActive || isSaving ? prev[task.id] ?? taskAction : taskAction;
      });
      return next;
    });
  }, [tasks, actionMeta, activeActionIds]);

  useEffect(() => {
    setTaskTitleDrafts((prev) => {
      const next = {};
      tasks.forEach((task) => {
        const taskTitle = task.task ?? "";
        const isActive = Boolean(activeTaskTitleIds[task.id]);
        const isSaving = taskTitleMeta[task.id]?.state === "saving";
        next[task.id] = isActive || isSaving ? prev[task.id] ?? taskTitle : taskTitle;
      });
      return next;
    });
  }, [tasks, taskTitleMeta, activeTaskTitleIds]);

  useEffect(() => {
    if (!focusedTaskId) {
      return;
    }

    const focusedIndex = tasks.findIndex((task) => Number(task.id) === Number(focusedTaskId));
    if (focusedIndex >= 0) {
      const targetPage = Math.floor(focusedIndex / TASKS_PER_PAGE) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
        return;
      }
    }

    const rowElement = document.querySelector(`[data-task-id='${focusedTaskId}']`);
    if (rowElement) {
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedTaskId, tasks, currentPage]);

  const getDependencyValue = (item) => dependencyDrafts[item.id] ?? item.dependency ?? "";
  const getActionValue = (item) => actionDrafts[item.id] ?? item.action ?? "";
  const getTaskTitleValue = (item) => taskTitleDrafts[item.id] ?? item.task ?? "";
  const setDependencyActive = (taskId, isActive) => {
    setActiveDependencyIds((prev) => {
      const currentlyActive = Boolean(prev[taskId]);
      if (currentlyActive === isActive) {
        return prev;
      }

      const next = { ...prev };
      if (isActive) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  };

  const setActionActive = (taskId, isActive) => {
    setActiveActionIds((prev) => {
      const currentlyActive = Boolean(prev[taskId]);
      if (currentlyActive === isActive) {
        return prev;
      }

      const next = { ...prev };
      if (isActive) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  };

  const setTaskTitleActive = (taskId, isActive) => {
    setActiveTaskTitleIds((prev) => {
      const currentlyActive = Boolean(prev[taskId]);
      if (currentlyActive === isActive) {
        return prev;
      }

      const next = { ...prev };
      if (isActive) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  };

  const clearDependencyMeta = (taskId) => {
    setDependencyMeta((prev) => {
      if (!prev[taskId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const resetDependencyMeta = (taskId) => {
    setTimeout(() => {
      setDependencyMeta((prev) => {
        if (!prev[taskId] || prev[taskId].state !== "saved") {
          return prev;
        }

        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1200);
  };

  const clearActionMeta = (taskId) => {
    setActionMeta((prev) => {
      if (!prev[taskId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const resetActionMeta = (taskId) => {
    setTimeout(() => {
      setActionMeta((prev) => {
        if (!prev[taskId] || prev[taskId].state !== "saved") {
          return prev;
        }

        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1200);
  };

  const clearTaskTitleMeta = (taskId) => {
    setTaskTitleMeta((prev) => {
      if (!prev[taskId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const resetTaskTitleMeta = (taskId) => {
    setTimeout(() => {
      setTaskTitleMeta((prev) => {
        if (!prev[taskId] || prev[taskId].state !== "saved") {
          return prev;
        }

        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1200);
  };

  const persistDependency = async (item, value = undefined) => {
    if (!onStatusChange) {
      return;
    }

    if (skipPersistIds[item.id]) {
      setSkipPersistIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    const nextDependency = String(value ?? getDependencyValue(item)).trim();
    const currentDependency = (item.dependency ?? "").trim();

    if (nextDependency === currentDependency) {
      return;
    }

    setDependencyMeta((prev) => ({
      ...prev,
      [item.id]: { state: "saving" }
    }));

    try {
      await onStatusChange(item, item.status, nextDependency, getActionValue(item), getTaskTitleValue(item));
      setDependencyMeta((prev) => ({
        ...prev,
        [item.id]: { state: "saved" }
      }));
      resetDependencyMeta(item.id);
    } catch {
      setDependencyDrafts((prev) => ({ ...prev, [item.id]: item.dependency ?? "" }));
      setDependencyMeta((prev) => ({
        ...prev,
        [item.id]: { state: "error" }
      }));
    }
  };

  const persistAction = async (item, value = undefined) => {
    if (!onStatusChange) {
      return;
    }

    if (skipActionPersistIds[item.id]) {
      setSkipActionPersistIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    const nextAction = String(value ?? getActionValue(item)).trim();
    const currentAction = String(item.action ?? "").trim();

    if (nextAction === currentAction) {
      return;
    }

    setActionMeta((prev) => ({
      ...prev,
      [item.id]: { state: "saving" }
    }));

    try {
      await onStatusChange(item, item.status, getDependencyValue(item), nextAction, getTaskTitleValue(item));
      setActionMeta((prev) => ({
        ...prev,
        [item.id]: { state: "saved" }
      }));
      resetActionMeta(item.id);
    } catch {
      setActionDrafts((prev) => ({ ...prev, [item.id]: item.action ?? "" }));
      setActionMeta((prev) => ({
        ...prev,
        [item.id]: { state: "error" }
      }));
    }
  };

  const persistTaskTitle = async (item, value = undefined) => {
    if (!onStatusChange) {
      return;
    }

    if (skipTaskTitlePersistIds[item.id]) {
      setSkipTaskTitlePersistIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    const nextTaskTitle = String(value ?? getTaskTitleValue(item)).trim();
    const currentTaskTitle = String(item.task ?? "").trim();

    if (nextTaskTitle === currentTaskTitle) {
      return;
    }

    setTaskTitleMeta((prev) => ({
      ...prev,
      [item.id]: { state: "saving" }
    }));

    try {
      await onStatusChange(item, item.status, getDependencyValue(item), getActionValue(item), nextTaskTitle);
      setTaskTitleMeta((prev) => ({
        ...prev,
        [item.id]: { state: "saved" }
      }));
      resetTaskTitleMeta(item.id);
    } catch {
      setTaskTitleDrafts((prev) => ({ ...prev, [item.id]: item.task ?? "" }));
      setTaskTitleMeta((prev) => ({
        ...prev,
        [item.id]: { state: "error" }
      }));
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
            <th className="p-3">Dependancy / Remark</th>
            {showAssignee && <th className="p-3">Assigned To</th>}
            {showAssigner && <th className="p-3">Assigned By</th>}
            {showSubmitToHr && <th className="p-3">HR Submit</th>}
            {showReassign && <th className="p-3">Reassign</th>}
            <th className="p-3">Assigned Time</th>
            <th className="p-3">Completed Time</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTasks.map((item, index) => {
            const overdue = item.deadline && item.status !== "Completed" && new Date(item.deadline) < new Date();
            const isCompletedTask = item.status === "Completed";
            const assignedAt = formatLocalDateTimeParts(item.assigned_at || item.created_at);
            const reassignedAt = formatLocalDateTimeParts(item.reassigned_at);
            const completedAt = formatUtcDateTimeParts(item.completed_at);

            return (
              <tr
                key={item.id}
                data-task-id={item.id}
                className={`border-b border-slate-100 ${
                  Number(focusedTaskId) === Number(item.id)
                    ? "bg-emerald-50"
                    : overdue
                      ? "bg-rose-50"
                      : item.status === "Completed"
                        ? "bg-green-50"
                        : item.status === "In Progress"
                          ? "bg-sky-50"
                        : item.status === "Pending"
                          ? "bg-yellow-50"
                        : ""
                }`}
              >
                <td className="p-3">{(currentPage - 1) * TASKS_PER_PAGE + index + 1}</td>
                <td className="p-3 font-medium">{item.client}</td>
                <td className="p-3">
                  {editableStatus && Number(item.submitted_to_hr) !== 1 ? (
                    <div className="min-w-[220px]">
                      <input
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
                        type="text"
                        placeholder="Update task title"
                        value={getTaskTitleValue(item)}
                        onFocus={() => setTaskTitleActive(item.id, true)}
                        onChange={(event) => {
                          setTaskTitleDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                          clearTaskTitleMeta(item.id);
                        }}
                        onBlur={(event) => {
                          setTaskTitleActive(item.id, false);
                          void persistTaskTitle(item, event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }

                          if (event.key === "Escape") {
                            setSkipTaskTitlePersistIds((prev) => ({ ...prev, [item.id]: true }));
                            setTaskTitleDrafts((prev) => ({
                              ...prev,
                              [item.id]: item.task ?? ""
                            }));
                            clearTaskTitleMeta(item.id);
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      {taskTitleMeta[item.id]?.state === "saving" && (
                        <p className="mt-1 text-xs text-dsr-muted">Saving...</p>
                      )}
                      {taskTitleMeta[item.id]?.state === "saved" && (
                        <p className="mt-1 text-xs text-emerald-600">Saved</p>
                      )}
                      {taskTitleMeta[item.id]?.state === "error" && (
                        <p className="mt-1 text-xs text-rose-600">Could not save task title</p>
                      )}
                    </div>
                  ) : (
                    item.task || "-"
                  )}
                </td>
                <td className="p-3">
                  {editableStatus && Number(item.submitted_to_hr) !== 1 ? (
                    <div className="min-w-[220px]">
                      <input
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
                        type="text"
                        placeholder="Update action"
                        value={getActionValue(item)}
                        onFocus={() => setActionActive(item.id, true)}
                        onChange={(event) => {
                          setActionDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                          clearActionMeta(item.id);
                        }}
                        onBlur={(event) => {
                          setActionActive(item.id, false);
                          void persistAction(item, event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }

                          if (event.key === "Escape") {
                            setSkipActionPersistIds((prev) => ({ ...prev, [item.id]: true }));
                            setActionDrafts((prev) => ({
                              ...prev,
                              [item.id]: item.action ?? ""
                            }));
                            clearActionMeta(item.id);
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      {actionMeta[item.id]?.state === "saving" && (
                        <p className="mt-1 text-xs text-dsr-muted">Saving...</p>
                      )}
                      {actionMeta[item.id]?.state === "saved" && (
                        <p className="mt-1 text-xs text-emerald-600">Saved</p>
                      )}
                      {actionMeta[item.id]?.state === "error" && (
                        <p className="mt-1 text-xs text-rose-600">Could not save action</p>
                      )}
                    </div>
                  ) : (
                    item.action || "-"
                  )}
                </td>
                <td className="p-3">
                  {editableStatus && Number(item.submitted_to_hr) !== 1 ? (
                    <select
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status] || "bg-slate-100 text-slate-700"}`}
                      value={item.status}
                      onChange={(event) =>
                        onStatusChange(
                          item,
                          event.target.value,
                          getDependencyValue(item),
                          getActionValue(item),
                          getTaskTitleValue(item)
                        )
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {editableStatus && Number(item.submitted_to_hr) !== 1 ? (
                    <div className="min-w-[220px]">
                      <input
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
                        type="text"
                        placeholder="Add dependancy / remark"
                        value={getDependencyValue(item)}
                        onFocus={() => setDependencyActive(item.id, true)}
                        onChange={(event) => {
                          setDependencyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                          clearDependencyMeta(item.id);
                        }}
                        onBlur={(event) => {
                          setDependencyActive(item.id, false);
                          void persistDependency(item, event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }

                          if (event.key === "Escape") {
                            setSkipPersistIds((prev) => ({ ...prev, [item.id]: true }));
                            setDependencyDrafts((prev) => ({
                              ...prev,
                              [item.id]: item.dependency ?? ""
                            }));
                            clearDependencyMeta(item.id);
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      {dependencyMeta[item.id]?.state === "saving" && (
                        <p className="mt-1 text-xs text-dsr-muted">Saving...</p>
                      )}
                      {dependencyMeta[item.id]?.state === "saved" && (
                        <p className="mt-1 text-xs text-emerald-600">Saved</p>
                      )}
                      {dependencyMeta[item.id]?.state === "error" && (
                        <p className="mt-1 text-xs text-rose-600">Could not save dependancy / remark</p>
                      )}
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
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
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
                <td className="p-3 whitespace-nowrap align-top">
                  {assignedAt ? (
                    <div>
                      <p>{assignedAt.date}</p>
                      <p>{assignedAt.time}</p>
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                  {reassignedAt && (
                    <div className="mt-1 border-t border-slate-200 pt-1 text-xs text-slate-600">
                      <p>Reassigned: {reassignedAt.date}</p>
                      <p>{reassignedAt.time}</p>
                    </div>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap align-top">
                  {item.status === "Completed" && completedAt ? (
                    <div>
                      <p>{completedAt.date}</p>
                      <p>{completedAt.time}</p>
                    </div>
                  ) : (
                    ""
                  )}
                </td>
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

      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-3 text-sm">
          <p className="text-slate-600">
            Showing {(currentPage - 1) * TASKS_PER_PAGE + 1}
            -{Math.min(currentPage * TASKS_PER_PAGE, tasks.length)} of {tasks.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default TaskTable;
