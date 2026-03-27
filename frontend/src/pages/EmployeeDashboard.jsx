import { useEffect, useMemo, useRef, useState } from "react";
import Charts from "../components/Charts";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import useScrollHeader from "../hooks/useScrollHeader";
import { authApi, reportApi, taskApi } from "../services/api";
import { toTeamLabel } from "../utils/teamLabel";

const TABS = ["Overview", "Tasks", "Profile"];
const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today (Default)" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "custom", label: "Custom Date" }
];

const getLocalDateText = (date = new Date()) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
};

const formatChartDateLabel = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatDateOptionLabel = (dateText) => {
  if (!dateText) {
    return "Custom Date";
  }

  const [year, month, day] = String(dateText).split("-");
  if (!year || !month || !day) {
    return "Custom Date";
  }

  return `${day}-${month}-${year}`;
};

const normalizeTimelineDate = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return getLocalDateText(parsed);
};

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const isHeaderVisible = useScrollHeader();
  const customDateInputRef = useRef(null);
  const periodMenuRef = useRef(null);
  const todayText = getLocalDateText();
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total_tasks: 0, completed_tasks: 0, pending_tasks: 0 });
  const [timeline, setTimeline] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "all", period: "today", date: todayText });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [form, setForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    deadline: ""
  });
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, reportsRes, summaryRes, timelineRes, notificationRes] = await Promise.all([
        taskApi.getTasks(),
        reportApi.getReports(),
        taskApi.getDailySummary(),
        taskApi.getTimeline(14),
        taskApi.getNotifications()
      ]);

      setTasks(tasksRes.data || []);
      setReports(reportsRes?.data || []);
      setSummary(summaryRes.data || {});
      setTimeline(timelineRes.data || []);
      setNotifications(notificationRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPeriodMenuOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (periodMenuRef.current?.contains(event.target)) {
        return;
      }

      setIsPeriodMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isPeriodMenuOpen]);

  const filteredTasks = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = getLocalDateText(yesterday);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;

      const taskDateText = (item.created_at || "").slice(0, 10);
      const taskDate = item.created_at ? new Date(item.created_at) : null;

      let dateMatch = true;
      if (filters.period === "today") {
        dateMatch = taskDateText === todayText;
      } else if (filters.period === "all") {
        dateMatch = true;
      } else if (filters.period === "yesterday") {
        dateMatch = taskDateText === yesterdayText;
      } else if (filters.period === "last7") {
        dateMatch = taskDate ? taskDate >= sevenDaysAgo : false;
      } else if (filters.period === "custom") {
        dateMatch = !filters.date || taskDateText === filters.date;
      }

      return statusMatch && dateMatch;
    });
  }, [tasks, filters, todayText]);

  const yesterdayTaskSummary = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = getLocalDateText(yesterday);
    const carriedForwardSourceIds = new Set(
      tasks
        .map((item) => item.carried_forward_from_id)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
    );

    return tasks.reduce(
      (acc, item) => {
        const isYesterday = (item.assigned_at || item.created_at || "").slice(0, 10) === yesterdayText;
        const isCarriedForwardSource = carriedForwardSourceIds.has(Number(item.id));

        if (!isYesterday || isCarriedForwardSource) {
          return acc;
        }

        const normalizedStatus = String(item.status || "").toLowerCase();
        if (normalizedStatus === "pending") {
          acc.pending += 1;
        } else if (normalizedStatus === "in progress") {
          acc.inProgress += 1;
        }

        return acc;
      },
      { pending: 0, inProgress: 0 }
    );
  }, [tasks]);

  const visibleNotifications = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = getLocalDateText(yesterday);

    const taskById = new Map(tasks.map((item) => [Number(item.id), item]));
    const carriedForwardSourceIds = new Set(
      tasks
        .map((item) => item.carried_forward_from_id)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
    );

    const unresolvedYesterdayLineageIds = new Set();

    tasks
      .filter(
        (item) =>
          item.status === "Pending" &&
          ((item.assigned_at || item.created_at || "").slice(0, 10) === yesterdayText) &&
          !carriedForwardSourceIds.has(Number(item.id))
      )
      .forEach((item) => {
        let currentId = Number(item.id);

        while (currentId && !unresolvedYesterdayLineageIds.has(currentId)) {
          unresolvedYesterdayLineageIds.add(currentId);
          const currentTask = taskById.get(currentId);
          currentId = Number(currentTask?.carried_forward_from_id || 0);
        }
      });

    return notifications.filter((item) => {
      const notificationDate = String(item.created_at || "").slice(0, 10);

      if (notificationDate === todayText) {
        return true;
      }

      return (
        notificationDate === yesterdayText &&
        item.type?.startsWith("task_") &&
        item.reference_id &&
        unresolvedYesterdayLineageIds.has(Number(item.reference_id))
      );
    });
  }, [notifications, tasks, todayText]);

  const unreadCount = useMemo(
    () => visibleNotifications.filter((item) => !item.is_read).length,
    [visibleNotifications]
  );

  const newTaskNotifications = useMemo(
    () => visibleNotifications.filter((item) => ["task_assigned", "task_reassigned", "task_carried_forward"].includes(item.type)),
    [visibleNotifications]
  );

  const weeklyCompletionChart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    const dateKeys = [];
    const labels = [];

    for (let index = 0; index < 6; index += 1) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      dateKeys.push(getLocalDateText(day));
      labels.push(formatChartDateLabel(day));
    }

    const completionMap = new Map(
      timeline.map((point) => [normalizeTimelineDate(point.day), Number(point.completed_count || 0)])
    );

    const values = dateKeys.map((key) => completionMap.get(key) || 0);

    return { labels, values };
  }, [timeline]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await taskApi.createTask({
        ...form,
        assignedTo: user.id,
        type: "self"
      });

      setForm({ client: "", task: "", action: "", dependency: "", deadline: "" });
      await loadData();
      setActiveTab("Tasks");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to create task");
    }
  };

  const handleStatusChange = async (
    task,
    status,
    dependency = task.dependency,
    action = task.action,
    taskTitle = task.task
  ) => {
    setError("");

    try {
      await taskApi.updateTask(task.id, { status, dependency, action, taskTitle });
      setTasks((prev) =>
        prev.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                task: taskTitle,
                status,
                dependency,
                action
              }
            : entry
        )
      );
      void loadData().catch(() => {});
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to update task");
      throw apiError;
    }
  };

  const handleMarkRead = async (id) => {
    await taskApi.markNotificationRead(id);
    await loadData();
  };

  const handleMarkAllRead = async () => {
    await taskApi.markAllNotificationsRead();
    await loadData();
  };

  const handleOpenTaskFromNotification = async (notification) => {
    if (!notification?.reference_id) {
      return;
    }

    if (!notification.type?.startsWith("task_")) {
      return;
    }

    await taskApi.markNotificationRead(notification.id);
    setActiveTab("Tasks");
    setFilters((prev) => ({ ...prev, status: "all", period: "all", date: todayText }));
    setFocusedTaskId(Number(notification.reference_id));
    await loadData();
  };

  const selectedReportDate = useMemo(() => {
    if (filters.period === "today") {
      return todayText;
    }

    if (filters.period === "all") {
      return "";
    }

    if (filters.period === "yesterday") {
      return getLocalDateText(new Date(Date.now() - 24 * 60 * 60 * 1000));
    }

    if (filters.period === "custom") {
      return filters.date || "";
    }

    return "";
  }, [filters.period, filters.date, todayText]);

  const canSubmitReport = Boolean(selectedReportDate) && filters.period !== "last7";

  const periodFieldLabel = useMemo(() => {
    if (filters.period === "custom") {
      return formatDateOptionLabel(filters.date);
    }

    return PERIOD_OPTIONS.find((option) => option.value === filters.period)?.label || "Task Period";
  }, [filters.period, filters.date]);

  const alreadySubmittedForDate = useMemo(() => {
    if (!selectedReportDate) {
      return false;
    }

    return reports.some(
      (entry) =>
        String(entry.date).slice(0, 10) === selectedReportDate &&
        entry.received_status === "Received"
    );
  }, [reports, selectedReportDate]);

  const handleSubmitReport = async () => {
    if (!canSubmitReport) {
      setSubmitMessage("Select a single day (Today, Yesterday, or Custom Date) to submit report.");
      return;
    }

    const confirmed = window.confirm(`Do you want to submit your report for ${selectedReportDate}?`);
    if (!confirmed) {
      return;
    }

    setSubmittingReport(true);
    setSubmitMessage("");
    try {
      const response = await reportApi.submitReportToHr(selectedReportDate);
      setSubmitMessage(response.data?.message || "Report submitted to HR.");
      await loadData();
    } catch (apiError) {
      setSubmitMessage(apiError.response?.data?.message || "Failed to submit report to HR");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage("Password changed successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (apiError) {
      setPasswordError(apiError.response?.data?.message || "Failed to change password");
    }
  };

  const openCustomDatePicker = () => {
    const input = customDateInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const handlePeriodSelect = (period) => {
    setIsPeriodMenuOpen(false);

    if (period === "custom") {
      setFilters((prev) => ({
        ...prev,
        period: "custom",
        date: prev.date || todayText
      }));
      setTimeout(openCustomDatePicker, 0);
      return;
    }

    setFilters((prev) => ({
      ...prev,
      period,
      date:
        period === "today"
          ? todayText
          : period === "yesterday"
            ? getLocalDateText(new Date(Date.now() - 24 * 60 * 60 * 1000))
            : prev.date
    }));
  };

  return (
    <div className="min-h-screen bg-dsr-page text-dsr-ink">
      <header
        className={`sticky top-0 z-30 border-b border-dsr-border bg-[#f3f3f3] transition-transform duration-300 ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-5">
            <img
              src={logo}
              alt="DSR Management Logo"
              className="h-16 w-[220px] shrink-0 object-cover object-left"
            />
          </div>

          <nav className="hidden items-center gap-2 rounded-full border border-dsr-border bg-dsr-soft px-3 py-2 lg:flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-dsr-brand text-white"
                    : "text-dsr-ink hover:bg-white hover:text-dsr-brand"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold capitalize">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{toTeamLabel(user?.team) || "Employee"}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("Notifications")}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-dsr-border bg-dsr-soft text-dsr-ink hover:bg-white"
              aria-label="Open notifications"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M10 17a2 2 0 0 0 4 0" />
              </svg>
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />}
            </button>
            <button className="btn-secondary" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        <div className="grid gap-3 lg:hidden">
          <select
            className="input"
            value={TABS.includes(activeTab) ? activeTab : "Overview"}
            onChange={(event) => setActiveTab(event.target.value)}
          >
            {TABS.map((tab) => (
              <option key={tab} value={tab}>
                {tab}
              </option>
            ))}
          </select>
        </div>

        {activeTab === "Overview" && (
          <section className="card-green">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Total Tasks</p>
                <h3 className="text-3xl font-extrabold">{tasks.length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Completed Tasks</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">{tasks.filter((item) => item.status === "Completed").length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Completed Today</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">{summary.completed_tasks || 0}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Pending Today</p>
                <h3 className="text-3xl font-extrabold text-amber-700">{summary.pending_tasks || 0}</h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Tasks" && (
          <form className="card grid w-full gap-2 md:grid-cols-2" onSubmit={handleCreateTask}>
            <h2 className="md:col-span-2 text-lg font-semibold">Create Task</h2>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Client / Vendor</h3>
              <input
                className="input"
                value={form.client}
                onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
              />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Task Title</h3>
              <input
                className="input"
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                required
              />
            </div>
            <h3 className="md:col-span-2 text-sm font-semibold text-slate-900">Action</h3>
            <textarea
              className="input md:col-span-2"
              rows={3}
              value={form.action}
              onChange={(event) => setForm((prev) => ({ ...prev, action: event.target.value }))}
              required
            />
            
            <button className="btn-primary md:col-span-2" type="submit">
              Add Task
            </button>
            {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
          </form>
        )}

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <section className="card">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Status</label>
                <select
                  className="input"
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
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
                  onClick={() => setIsPeriodMenuOpen((prev) => !prev)}
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
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          filters.period === option.value
                            ? "bg-dsr-soft font-semibold text-dsr-ink"
                            : "text-dsr-ink hover:bg-dsr-soft"
                        }`}
                        onClick={() => handlePeriodSelect(option.value)}
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
                  onChange={(event) => {
                    setFilters((prev) => ({
                      ...prev,
                      period: "custom",
                      date: event.target.value
                    }));
                    setIsPeriodMenuOpen(false);
                  }}
                />
              </div>
              {(yesterdayTaskSummary.pending > 0 || yesterdayTaskSummary.inProgress > 0) && (
                <div className="rounded-xl border border-rose-300 bg-rose-100 p-3 text-sm font-semibold text-rose-800 md:col-start-4">
                  <p>
                    You have {yesterdayTaskSummary.pending} pending {yesterdayTaskSummary.pending === 1 ? "task" : "tasks"} from yesterday.
                  </p>
                  <p className="mt-1">
                    You have {yesterdayTaskSummary.inProgress} in-progress {yesterdayTaskSummary.inProgress === 1 ? "task" : "tasks"} from yesterday.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Task List</h2>
            <TaskTable
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              editableStatus
              showAssigner
              focusedTaskId={focusedTaskId}
            />
            {tasks.length > 0 && filteredTasks.length === 0 && filters.period !== "all" && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No tasks in current day filter. 
                <button
                  type="button"
                  className="ml-1 font-semibold underline"
                  onClick={() => setFilters((prev) => ({ ...prev, period: "all" }))}
                >
                  Show all tasks
                </button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dsr-border bg-dsr-soft p-3">
              <p className="text-sm text-dsr-muted">
                Submit report for: <span className="font-semibold text-dsr-ink">{selectedReportDate || "Select a single day"}</span>
              </p>
              <button
                type="button"
                className={alreadySubmittedForDate ? "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" : "btn-primary"}
                disabled={!canSubmitReport || submittingReport || alreadySubmittedForDate}
                onClick={handleSubmitReport}
              >
                {alreadySubmittedForDate ? "Submitted" : submittingReport ? "Submitting..." : "Submit Report"}
              </button>
            </div>
            {submitMessage && <p className="mt-2 text-sm text-dsr-brand">{submitMessage}</p>}
          </section>
        )}

        {activeTab === "Overview" && (
          <div className="grid gap-2 lg:grid-cols-2">
            <Charts
              type="bar"
              title="Tasks Completed"
              labels={weeklyCompletionChart.labels}
              values={weeklyCompletionChart.values}
              color="rgba(42, 122, 70, 0.8)"
            />
            <div className="card">
              <h2 className="mb-2 text-lg font-semibold">New Assignment Alerts</h2>
              <div className="space-y-2">
                {newTaskNotifications.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-xl border border-dsr-border bg-dsr-soft p-3">
                    <p className="text-sm font-medium">{item.message}</p>
                    <p className="mt-1 text-xs text-dsr-muted">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                ))}
                {newTaskNotifications.length === 0 && (
                  <p className="text-sm text-dsr-muted">No new assignment alerts</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Notifications" && (
          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <button className="btn-secondary" onClick={handleMarkAllRead} type="button">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="space-y-3">
              {visibleNotifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${item.is_read ? "border-dsr-border" : "border-dsr-border bg-dsr-soft"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.message}</p>
                    <div className="flex items-center gap-2">
                      {item.type?.startsWith("task_") && item.reference_id && (
                        <button
                          className="btn-primary"
                          onClick={() => handleOpenTaskFromNotification(item)}
                          type="button"
                        >
                          Open Task
                        </button>
                      )}
                      {!item.is_read && (
                        <button className="btn-secondary" onClick={() => handleMarkRead(item.id)} type="button">
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-dsr-muted">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </p>
                </div>
              ))}
              {visibleNotifications.length === 0 && <p className="text-sm text-dsr-muted">No notifications</p>}
            </div>
          </section>
        )}

        {activeTab === "Profile" && (
          <section className="space-y-4">
            <div className="card-green">
              <h2 className="mb-4 text-2xl font-bold">Profile</h2>
              <div className="grid gap-3 rounded-xl border border-dsr-border/70 bg-white/60 p-4 text-sm md:grid-cols-2">
                <p><span className="font-semibold">Name:</span> {user?.name}</p>
                <p><span className="font-semibold">Role:</span> {String(user?.role || "").toUpperCase()}</p>
                <p><span className="font-semibold">Email:</span> {user?.email}</p>
                <p><span className="font-semibold">Department:</span> {toTeamLabel(user?.team) || "-"}</p>
              </div>
            </div>

            <form className="card" onSubmit={handlePasswordChange}>
              <h2 className="mb-4 text-2xl font-bold">Settings - Change Password</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="input md:col-span-2"
                  type="password"
                  placeholder="Current password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  required
                />
                <input
                  className="input"
                  type="password"
                  placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  required
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  required
                />

                {passwordError && <p className="md:col-span-2 text-sm text-rose-600">{passwordError}</p>}
                {passwordMessage && <p className="md:col-span-2 text-sm text-emerald-700">{passwordMessage}</p>}

                <button className="btn-primary md:col-span-2 w-fit" type="submit">
                  Update Password
                </button>
              </div>
            </form>
          </section>
        )}

        {loading && <p className="text-sm text-dsr-muted">Refreshing dashboard data...</p>}
      </main>
    </div>
  );
};

export default EmployeeDashboard;
