import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { getTaskDateText, getTodayText } from "../utils/taskMeta";

const TASKS_PER_PAGE = 10;

const statusClass = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-sky-100 text-sky-800",
  Completed: "bg-green-100 text-green-800"
};

const priorityClass = {
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-800"
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

const formatDateOnly = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }

  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
};

const TaskCellPreview = ({ text = "", interactive = false, onEdit = null }) => {
  const contentRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      setHasOverflow(false);
      return;
    }

    const updateOverflow = () => {
      setHasOverflow(element.scrollHeight > element.clientHeight + 1);
    };

    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [expanded, text]);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  const contentClassName = interactive
    ? "w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-900 whitespace-pre-wrap break-words"
    : "block px-2.5 py-1.5 text-[13px] font-medium text-slate-900 whitespace-pre-wrap break-words";

  const clampStyle = expanded
    ? undefined
    : {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden"
      };

  return (
    <div className="w-full">
      {interactive ? (
        <button type="button" className={contentClassName} onClick={onEdit}>
          <span ref={contentRef} className="block" style={clampStyle}>
            {text || "-"}
          </span>
        </button>
      ) : (
        <span className={contentClassName}>
          <span ref={contentRef} className="block" style={clampStyle}>
            {text || "-"}
          </span>
        </span>
      )}

      {hasOverflow ? (
        <button
          type="button"
          className="px-2.5 pt-1 text-xs font-semibold text-dsr-brand hover:underline"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
};

const TaskTable = ({
  tasks = [],
  onStatusChange,
  editableStatus = false,
  onPriorityChange,
  showAssignee = false,
  showAssigner = false,
  showSubmitToHr = false,
  onSubmitToHr,
  submittingTaskId = null,  
  showReassign = false,
  reassignOptions = [],
  onReassign,
  reassigningTaskId = null,
  onDeleteTask = null,
  canDeleteTask = null,
  focusedTaskId = null,
  setFocusedTaskId = null
}) => {
  const wrapperRef = useRef(null);
  const [dependencyDrafts, setDependencyDrafts] = useState({});
  const [dependencyMeta, setDependencyMeta] = useState({});
  const [activeDependencyIds, setActiveDependencyIds] = useState({});
  const [skipPersistIds, setSkipPersistIds] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionMeta, setActionMeta] = useState({});
  const [activeActionIds, setActiveActionIds] = useState({});
  const [skipActionPersistIds, setSkipActionPersistIds] = useState({});
  const [clientDrafts, setClientDrafts] = useState({});
  const [clientMeta, setClientMeta] = useState({});
  const [activeClientIds, setActiveClientIds] = useState({});
  const [skipClientPersistIds, setSkipClientPersistIds] = useState({});
  const [taskTitleDrafts, setTaskTitleDrafts] = useState({});
  const [taskTitleMeta, setTaskTitleMeta] = useState({});
  const [activeTaskTitleIds, setActiveTaskTitleIds] = useState({});
  const [skipTaskTitlePersistIds, setSkipTaskTitlePersistIds] = useState({});
  const [reassignModalTask, setReassignModalTask] = useState(null);
  const [reassignSelectionId, setReassignSelectionId] = useState("");
  const [hoveredDeleteTask, setHoveredDeleteTask] = useState(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const todayText = getTodayText();

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
    setClientDrafts((prev) => {
      const next = {};
      tasks.forEach((task) => {
        const taskClient = task.client ?? "";
        const isActive = Boolean(activeClientIds[task.id]);
        const isSaving = clientMeta[task.id]?.state === "saving";
        next[task.id] = isActive || isSaving ? prev[task.id] ?? taskClient : taskClient;
      });
      return next;
    });
  }, [tasks, clientMeta, activeClientIds]);

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

    if (typeof setFocusedTaskId === "function") {
      const clearTimer = window.setTimeout(() => setFocusedTaskId(null), rowElement ? 400 : 0);
      return () => window.clearTimeout(clearTimer);
    }

    return undefined;
  }, [focusedTaskId, tasks, currentPage, setFocusedTaskId]);

  const getDependencyValue = (item) => dependencyDrafts[item.id] ?? item.dependency ?? "";
  const getClientValue = (item) => clientDrafts[item.id] ?? item.client ?? "";
  const getActionValue = (item) => actionDrafts[item.id] ?? item.action ?? "";
  const getTaskTitleValue = (item) => taskTitleDrafts[item.id] ?? item.task ?? "";
  const setClientActive = (taskId, isActive) => {
    setActiveClientIds((prev) => {
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

  const clearClientMeta = (taskId) => {
    setClientMeta((prev) => {
      if (!prev[taskId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const resetClientMeta = (taskId) => {
    setTimeout(() => {
      setClientMeta((prev) => {
        if (!prev[taskId] || prev[taskId].state !== "saved") {
          return prev;
        }

        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 1200);
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

  const persistClient = async (item, value = undefined) => {
    if (!onStatusChange) {
      return;
    }

    if (skipClientPersistIds[item.id]) {
      setSkipClientPersistIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    const nextClient = String(value ?? getClientValue(item)).trim();
    const currentClient = String(item.client ?? "").trim();

    if (nextClient === currentClient) {
      return;
    }

    setClientMeta((prev) => ({
      ...prev,
      [item.id]: { state: "saving" }
    }));

    try {
      await onStatusChange(item, item.status, getDependencyValue(item), getActionValue(item), getTaskTitleValue(item), nextClient);
      setClientMeta((prev) => ({
        ...prev,
        [item.id]: { state: "saved" }
      }));
      resetClientMeta(item.id);
    } catch {
      setClientDrafts((prev) => ({ ...prev, [item.id]: item.client ?? "" }));
      setClientMeta((prev) => ({
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

  const isTaskDeletable = (item) => {
    if (!onDeleteTask) {
      return false;
    }

    if (typeof canDeleteTask === "function") {
      return Boolean(canDeleteTask(item));
    }

    return true;
  };

  const handleRowHover = (event, item) => {
    if (!isTaskDeletable(item) || !wrapperRef.current) {
      return;
    }

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const rowRect = event.currentTarget.getBoundingClientRect();

    setHoveredDeleteTask({
      id: Number(item.id),
      item,
      top: rowRect.top - wrapperRect.top + rowRect.height / 2
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmTask || !onDeleteTask) {
      return;
    }

    setDeletingTaskId(deleteConfirmTask.id);

    try {
      await onDeleteTask(deleteConfirmTask);
      setDeleteConfirmTask(null);
      setHoveredDeleteTask((current) => (Number(current?.id) === Number(deleteConfirmTask.id) ? null : current));
    } finally {
      setDeletingTaskId(null);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-visible"
      onMouseLeave={() => setHoveredDeleteTask(null)}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
      <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-slate-300 bg-emerald-100/75 text-left text-slate-700">
            <th className="w-14 px-2.5 py-2">Sr No</th>
            <th className="w-[15%] px-2.5 py-2 whitespace-normal">Client / Vendor</th>
            <th className="w-[25%] px-2.5 py-2 text-center">Task title</th>
            <th className="w-[23%] px-2.5 py-2 text-center">Action</th>
            <th className="w-24 px-1.5 py-2 text-center">Status</th>
            <th className="w-20 px-1.5 py-2 text-center">Priority</th>
            <th className="w-[16%] px-2 py-2">Dependency / Remark</th>
            {showAssignee && <th className="w-24 px-1.5 py-2 text-center">Assigned To</th>}
            {showAssigner && <th className="w-28 px-2.5 py-2 text-center">Assigned By</th>}
            {showSubmitToHr && <th className="w-28 px-2.5 py-2 text-center">HR Submit</th>}
            {showReassign && <th className="w-24 px-1 py-2 text-center">Reassign</th>}
            <th className="w-28 px-2.5 py-2 text-center">Assigned Time</th>
            <th className="w-28 px-2.5 py-2 text-center">Completed Time</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTasks.map((item, index) => {
            const overdue = item.deadline && item.status !== "Completed" && new Date(item.deadline) < new Date();
            const isCompletedTask = item.status === "Completed";
            const taskDateText = getTaskDateText(item);
            const isFutureTask = Boolean(taskDateText) && taskDateText > todayText;
            const canEditTask = editableStatus && Number(item.submitted_to_hr) !== 1 && !isFutureTask;
            const isClientEditing = Boolean(activeClientIds[item.id]);
            const isTaskTitleEditing = Boolean(activeTaskTitleIds[item.id]);
            const isActionEditing = Boolean(activeActionIds[item.id]);
            const isDependencyEditing = Boolean(activeDependencyIds[item.id]);
            const assignedAt = formatLocalDateTimeParts(item.assigned_at || item.created_at);
            const reassignedAt = formatLocalDateTimeParts(item.reassigned_at);
            const completedAt = formatUtcDateTimeParts(item.completed_at);

            return (
              <tr
                key={item.id}
                data-task-id={item.id}
                onMouseEnter={(event) => handleRowHover(event, item)}
                className={`border-b border-slate-300 ${
                  Number(focusedTaskId) === Number(item.id)
                    ? "bg-emerald-50"
                    : overdue
                      ? "bg-rose-50"
                      : ""
                }`}
              >
                <td className="px-2.5 py-2 align-top font-medium text-slate-900">{(currentPage - 1) * TASKS_PER_PAGE + index + 1}</td>
                <td className="px-2.5 py-2 align-top overflow-hidden">
                  {canEditTask ? (
                    <div className="w-full max-w-full">
                      {isClientEditing ? (
                        <textarea
                          autoFocus
                          rows={3}
                          className="block w-full max-w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] leading-5 text-slate-700 outline-none focus:border-emerald-500"
                          placeholder="Update client / vendor"
                          value={getClientValue(item)}
                          onChange={(event) => {
                            setClientDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                            clearClientMeta(item.id);
                          }}
                          onBlur={(event) => {
                            setClientActive(item.id, false);
                            void persistClient(item, event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }

                            if (event.key === "Escape") {
                              setSkipClientPersistIds((prev) => ({ ...prev, [item.id]: true }));
                              setClientDrafts((prev) => ({
                                ...prev,
                                [item.id]: item.client ?? ""
                              }));
                              clearClientMeta(item.id);
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      ) : (
                        <TaskCellPreview
                          text={getClientValue(item)}
                          interactive
                          onEdit={() => setClientActive(item.id, true)}
                        />
                      )}
                      {clientMeta[item.id]?.state === "saving" && (
                        <p className="mt-1 text-xs text-dsr-muted">Saving...</p>
                      )}
                      {clientMeta[item.id]?.state === "saved" && (
                        <p className="mt-1 text-xs text-emerald-600">Saved</p>
                      )}
                      {clientMeta[item.id]?.state === "error" && (
                        <p className="mt-1 text-xs text-rose-600">Could not save client / vendor</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <TaskCellPreview text={item.client || "-"} />
                      {isFutureTask ? <p className="mt-1 px-2.5 text-xs text-slate-500">Editable on {taskDateText}</p> : null}
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-2 align-top overflow-hidden">
                  {canEditTask ? (
                    <div className="w-full max-w-full">
                      {isTaskTitleEditing ? (
                        <textarea
                          autoFocus
                          rows={3}
                          className="block w-full max-w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] leading-5 text-slate-700 outline-none focus:border-emerald-500"
                          placeholder="Update task title"
                          value={getTaskTitleValue(item)}
                          onChange={(event) => {
                            setTaskTitleDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                            clearTaskTitleMeta(item.id);
                          }}
                          onBlur={(event) => {
                            setTaskTitleActive(item.id, false);
                            void persistTaskTitle(item, event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
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
                      ) : (
                        <TaskCellPreview
                          text={getTaskTitleValue(item)}
                          interactive
                          onEdit={() => setTaskTitleActive(item.id, true)}
                        />
                      )}
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
                    <div>
                      <TaskCellPreview text={item.task || "-"} />
                      {isFutureTask ? <p className="mt-1 px-2.5 text-xs text-slate-500">Editable on {taskDateText}</p> : null}
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-2 align-top overflow-hidden">
                  {canEditTask ? (
                    <div className="w-full max-w-full">
                      {isActionEditing ? (
                        <textarea
                          autoFocus
                          rows={4}
                          className="block w-full max-w-full resize-y rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] leading-5 text-slate-700 outline-none focus:border-emerald-500"
                          placeholder="Update action"
                          value={getActionValue(item)}
                          onChange={(event) => {
                            setActionDrafts((prev) => ({ ...prev, [item.id]: event.target.value }));
                            clearActionMeta(item.id);
                          }}
                          onBlur={(event) => {
                            setActionActive(item.id, false);
                            void persistAction(item, event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
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
                      ) : (
                        <TaskCellPreview
                          text={getActionValue(item)}
                          interactive
                          onEdit={() => setActionActive(item.id, true)}
                        />
                      )}
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
                      <div>
                        <TaskCellPreview text={item.action || "-"} />
                        {isFutureTask ? <p className="mt-1 px-2.5 text-xs text-slate-500">Editable on {taskDateText}</p> : null}
                      </div>
                    )}
                  </td>
                <td className="px-1.5 py-2 align-top text-center">
                  {canEditTask ? (
                    <select
                      className={`mx-auto w-full max-w-[104px] rounded-md px-2 py-1 text-[9px] font-semibold ${statusClass[item.status] || "bg-slate-100 text-slate-700"}`}
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
                    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[9px] font-semibold ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  )}
                </td>
                <td className="px-1.5 py-2 align-top text-center">
                  {canEditTask ? (
                    <select
                      className={`mx-auto w-full max-w-[96px] rounded-md px-2 py-1 text-[9px] font-semibold ${priorityClass[item.priority] || "bg-slate-100 text-slate-700"}`}
                      value={item.priority || "Medium"}
                      onChange={(event) => {
                        if (onPriorityChange) {
                          onPriorityChange(item, event.target.value);
                        }
                      }}
                    >
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  ) : (
                    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[9px] font-semibold ${priorityClass[item.priority] || "bg-slate-100 text-slate-700"}`}>
                      {item.priority || "Medium"}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 align-top">
                  {canEditTask ? (
                    <div className="w-full">
                      {isDependencyEditing ? (
                        <textarea
                          autoFocus
                          rows={4}
                          className="w-full min-w-0 resize-y rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] leading-5 text-slate-700 outline-none focus:border-emerald-500"
                          placeholder="Add dependency / remark"
                          value={getDependencyValue(item)}
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
                      ) : (
                        <TaskCellPreview
                          text={getDependencyValue(item)}
                          interactive
                          onEdit={() => setDependencyActive(item.id, true)}
                        />
                      )}
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
                    <div>
                      <TaskCellPreview text={item.dependency || "-"} />
                      {isFutureTask ? <p className="mt-1 px-2.5 text-xs text-slate-500">Editable on {taskDateText}</p> : null}
                    </div>
                  )}
                </td>
                {showAssignee && <td className="px-1.5 py-2 align-top text-center font-medium text-slate-900">{item.assigned_to_name || "-"}</td>}
                {showAssigner && <td className="px-2.5 py-2 align-top text-center font-medium text-slate-900">{item.assigned_by_name || "-"}</td>}
                {showSubmitToHr && (
                  <td className="px-1 py-2 align-top text-center">
                    {Number(item.submitted_to_hr) === 1 ? (
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                        Submitted
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary px-2.5 py-1.5 text-[13px]"
                        disabled={!onSubmitToHr || submittingTaskId === item.id || isFutureTask}
                        onClick={() => onSubmitToHr?.(item)}
                      >
                        {submittingTaskId === item.id ? "Submitting..." : "Submit to HR"}
                      </button>
                    )}
                  </td>
                )}
                {showReassign && (
                  <td className="px-2.5 py-2 align-top text-center">
                    {isCompletedTask ? (
                      <span className="text-xs text-slate-500">-</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary inline-flex h-6 w-[64px] items-center justify-center whitespace-nowrap !rounded-none px-0 py-0 text-[10px] leading-none"
                        disabled={!onReassign || reassigningTaskId === item.id || isFutureTask}
                        onClick={() => openReassignModal(item)}
                      >
                        {reassigningTaskId === item.id ? "Reassigning..." : "Reassign"}
                      </button>
                    )}
                  </td>
                )}
                <td className="px-2.5 py-2 whitespace-nowrap align-top text-center text-[12px] font-medium text-slate-900 leading-tight">
                  {assignedAt ? (
                    <div>
                      <p>{isFutureTask && taskDateText ? formatDateOnly(taskDateText) : assignedAt.date}</p>
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
                <td className="px-2.5 py-2 whitespace-nowrap align-top text-center text-[12px] font-medium text-slate-900 leading-tight">
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
      </div>
      </div>

      {hoveredDeleteTask && isTaskDeletable(hoveredDeleteTask.item) ? (
        <>
          <div
            className="absolute right-[-56px] top-0 bottom-0 w-16"
            onMouseEnter={() => setHoveredDeleteTask((current) => current)}
          />
          <button
            type="button"
            className="absolute right-[-44px] z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 shadow-md transition hover:bg-rose-50"
            style={{ top: hoveredDeleteTask.top }}
            onClick={() => setDeleteConfirmTask(hoveredDeleteTask.item)}
            aria-label="Delete task"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </>
      ) : null}

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
            <span className="rounded-md border border-slate-300 bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm">
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">
                  Select assignee
                </label>
                <select
                  className="input"
                  value={reassignSelectionId}
                  onChange={(event) => setReassignSelectionId(event.target.value)}
                >
                  <option value="">Choose assignee</option>
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

      <ConfirmDialog
        open={Boolean(deleteConfirmTask)}
        title="Delete Task"
        message={
          deleteConfirmTask
            ? `Do you want to delete "${deleteConfirmTask.task}"? This will remove its carried-forward copies too.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={Number(deletingTaskId) === Number(deleteConfirmTask?.id)}
        onCancel={() => {
          if (!deletingTaskId) {
            setDeleteConfirmTask(null);
          }
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
};

export default TaskTable;
