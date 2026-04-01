import { useEffect, useMemo, useRef, useState } from "react";
import Charts from "../components/Charts";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateTaskModal from "../components/CreateTaskModal";
import EmployeeTaskFilters from "../components/EmployeeTaskFilters";
import PendingTasksSummary from "../components/PendingTasksSummary";
import ProfileMenu from "../components/ProfileMenu";
import ProfileSection from "../components/ProfileSection";
import ReportPage from "./ReportPage";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import useScrollHeader from "../hooks/useScrollHeader";
import { authApi, reportApi, taskApi } from "../services/api";
import { collapseTaskLineages } from "../utils/taskLineage";
import { getTaskDateText, getTodayText, TASK_DEPARTMENTS } from "../utils/taskMeta";
import { toTeamLabel } from "../utils/teamLabel";

const TABS = ["Overview", "Tasks", "Reports"];
const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today (Default)" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "custom", label: "Custom Date" }
];

const getLocalDateText = (date = new Date()) => getTodayText(date);

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
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [form, setForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    deadline: "",
    priority: "Medium",
    taskDepartment: String(user?.team || "").trim(),
    taskDate: todayText
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
    if (!user?.team) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      taskDepartment: prev.taskDepartment || String(user.team).trim(),
      taskDate: prev.taskDate || todayText
    }));
  }, [todayText, user?.team]);

  const visibleTasks = useMemo(() => collapseTaskLineages(tasks), [tasks]);

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

    return visibleTasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;

      const taskDateText = getTaskDateText(item);
      const taskDate = taskDateText ? new Date(`${taskDateText}T00:00:00`) : null;

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
  }, [visibleTasks, filters, todayText]);

  const yesterdayTaskSummary = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = getLocalDateText(yesterday);
    return visibleTasks.reduce(
      (acc, item) => {
        const isYesterday = (item.assigned_at || getTaskDateText(item) || item.created_at || "").slice(0, 10) === yesterdayText;

        if (!isYesterday) {
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
  }, [visibleTasks]);

  const visibleNotifications = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = getLocalDateText(yesterday);

    const taskById = new Map(visibleTasks.map((item) => [Number(item.id), item]));

    const unresolvedYesterdayLineageIds = new Set();

    visibleTasks
      .filter(
        (item) =>
          item.status === "Pending" &&
          ((item.assigned_at || getTaskDateText(item) || item.created_at || "").slice(0, 10) === yesterdayText)
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
  }, [notifications, visibleTasks, todayText]);

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
        taskDepartment: String(form.taskDepartment || "").trim() || undefined,
        taskDate: form.taskDate,
        assignedTo: user.id,
        type: "self"
      });

      setForm({
        client: "",
        task: "",
        action: "",
        dependency: "",
        deadline: "",
        priority: "Medium",
        taskDepartment: String(user?.team || "").trim(),
        taskDate: todayText
      });
      setIsCreateTaskModalOpen(false);
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
    taskTitle = task.task,
    client = task.client
  ) => {
    setError("");

    try {
      await taskApi.updateTask(task.id, { status, dependency, action, taskTitle, client });
      setTasks((prev) =>
        prev.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                client,
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

  const handlePriorityChange = async (task, priority) => {
    setError("");

    try {
      await taskApi.updateTaskPriority(task.id, { priority });
      setTasks((prev) =>
        prev.map((entry) =>
          entry.id === task.id
            ? { ...entry, priority }
            : entry
        )
      );
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to update priority");
    }
  };

  const handleDeleteTask = async (task) => {
    setError("");

    try {
      await taskApi.deleteTask(task.id);
      setTasks((prev) => prev.filter((entry) => Number(entry.id) !== Number(task.id)));
      setFocusedTaskId((current) => (Number(current) === Number(task.id) ? null : current));
      await loadData();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to delete task");
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

  const alreadySubmittedToday = useMemo(
    () =>
      reports.some(
        (entry) =>
          String(entry.date).slice(0, 10) === todayText &&
          entry.received_status === "Received"
      ),
    [reports, todayText]
  );

  const createTaskLockedForSelectedDate = useMemo(
    () => form.taskDate === todayText && alreadySubmittedToday,
    [alreadySubmittedToday, form.taskDate, todayText]
  );
  const taskDepartmentSelectOptions = useMemo(
    () => TASK_DEPARTMENTS.map((department) => ({ value: department, label: toTeamLabel(department) })),
    []
  );

  const handleSubmitReport = async () => {
    if (!canSubmitReport) {
      setSubmitMessage("Select a single day (Today, Yesterday, or Custom Date) to submit report.");
      return;
    }

    if (alreadySubmittedForDate) {
      setSubmitMessage("You can only submit the report once in a day.");
      return;
    }

    setIsSubmitConfirmOpen(true);
  };

  const handleConfirmSubmitReport = async () => {
    setIsSubmitConfirmOpen(false);
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
      <CreateTaskModal
        open={isCreateTaskModalOpen}
        title="Create Task"
        form={form}
        onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleCreateTask}
        onClose={() => setIsCreateTaskModalOpen(false)}
        error={error}
        locked={createTaskLockedForSelectedDate}
        lockedMessage={
          createTaskLockedForSelectedDate
            ? "You already submitted today's report. Choose tomorrow or a future date to create a task."
            : ""
        }
        submitLabel="Add Task"
        todayText={todayText}
        departmentOptions={taskDepartmentSelectOptions}
      />
      <ConfirmDialog
        open={isSubmitConfirmOpen}
        title="Submit Report"
        message={`Do you want to submit your report for ${selectedReportDate}?`}
        confirmText="Submit"
        cancelText="Cancel"
        loading={submittingReport}
        onCancel={() => setIsSubmitConfirmOpen(false)}
        onConfirm={() => void handleConfirmSubmitReport()}
      />

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
              className="h-14 w-[260px] shrink-0 object-contain object-left"
            />
          </div>

          <nav className="hidden items-center gap-4 rounded-full border border-dsr-border bg-dsr-soft px-4 py-2 lg:flex">
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
            <ProfileMenu
              user={user}
              onOpenProfile={() => setActiveTab("Profile")}
              onLogout={logout}
              label={toTeamLabel(user?.team) || "Employee"}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        <div className="grid gap-3 lg:hidden">
          <select
            className="input"
            value={TABS.includes(activeTab) || activeTab === "Profile" ? activeTab : "Overview"}
            onChange={(event) => setActiveTab(event.target.value)}
          >
            {TABS.map((tab) => (
              <option key={tab} value={tab}>
                {tab}
              </option>
            ))}
            <option value="Profile">Profile</option>
          </select>
        </div>

        {activeTab === "Overview" && (
          <section className="card-green">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Total Tasks</p>
                <h3 className="text-3xl font-extrabold">{visibleTasks.length}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Completed Tasks</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">{visibleTasks.filter((item) => item.status === "Completed").length}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Completed Today</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">{summary.completed_tasks || 0}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Pending Today</p>
                <h3 className="text-3xl font-extrabold text-amber-700">{summary.pending_tasks || 0}</h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Overview" && (
          <div className="space-y-4">
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

            <div className="space-y-2">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-stretch">
                <section className="card h-full">
                  <EmployeeTaskFilters
                    filters={filters}
                    onStatusChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                    onPeriodMenuToggle={() => setIsPeriodMenuOpen((prev) => !prev)}
                    isPeriodMenuOpen={isPeriodMenuOpen}
                    periodFieldLabel={periodFieldLabel}
                    periodOptions={PERIOD_OPTIONS}
                    onPeriodSelect={handlePeriodSelect}
                    periodMenuRef={periodMenuRef}
                    customDateInputRef={customDateInputRef}
                    onCustomDateChange={(value) => {
                      setFilters((prev) => ({
                        ...prev,
                        period: "custom",
                        date: value
                      }));
                      setIsPeriodMenuOpen(false);
                    }}
                    formatDateOptionLabel={formatDateOptionLabel}
                  />
                </section>

                <PendingTasksSummary
                  pending={yesterdayTaskSummary.pending}
                  inProgress={yesterdayTaskSummary.inProgress}
                  className="h-full max-w-[320px] xl:justify-self-end xl:self-stretch xl:w-full"
                />
              </div>

              <section>
                <h2 className="mb-2 text-lg font-semibold">Task List</h2>
                <TaskTable
                  tasks={filteredTasks}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onDeleteTask={handleDeleteTask}
                  canDeleteTask={(task) => Number(task.assigned_by) === Number(user?.id)}
                  editableStatus
                  showAssigner
                  focusedTaskId={focusedTaskId}
                  setFocusedTaskId={setFocusedTaskId}
                />
                {visibleTasks.length > 0 && filteredTasks.length === 0 && filters.period !== "all" && (
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
                    disabled={!canSubmitReport || submittingReport}
                    onClick={handleSubmitReport}
                  >
                    {alreadySubmittedForDate ? "Submitted" : submittingReport ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
                {submitMessage && <p className="mt-2 text-sm text-dsr-brand">{submitMessage}</p>}
              </section>
            </div>
          </div>
        )}

        {activeTab === "Tasks" && (
          <div className="space-y-2">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-stretch">
              <section className="card h-full">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-dsr-ink">Tasks</h2>
                    <p className="text-sm text-dsr-muted">Open a focused modal to create and schedule your next task.</p>
                  </div>
                  <button type="button" className="btn-primary" onClick={() => setIsCreateTaskModalOpen(true)}>
                    Create Task
                  </button>
                </div>
                <EmployeeTaskFilters
                  filters={filters}
                  onStatusChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                  onPeriodMenuToggle={() => setIsPeriodMenuOpen((prev) => !prev)}
                  isPeriodMenuOpen={isPeriodMenuOpen}
                  periodFieldLabel={periodFieldLabel}
                  periodOptions={PERIOD_OPTIONS}
                  onPeriodSelect={handlePeriodSelect}
                  periodMenuRef={periodMenuRef}
                  customDateInputRef={customDateInputRef}
                  onCustomDateChange={(value) => {
                    setFilters((prev) => ({
                      ...prev,
                      period: "custom",
                      date: value
                    }));
                    setIsPeriodMenuOpen(false);
                  }}
                  formatDateOptionLabel={formatDateOptionLabel}
                />
              </section>

              <PendingTasksSummary
                pending={yesterdayTaskSummary.pending}
                inProgress={yesterdayTaskSummary.inProgress}
                className="h-full max-w-[320px] xl:justify-self-end xl:self-stretch xl:w-full"
              />
            </div>

            <section>
              <h2 className="mb-2 text-lg font-semibold">Task List</h2>
              <TaskTable
                tasks={filteredTasks}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDeleteTask={handleDeleteTask}
                canDeleteTask={(task) => Number(task.assigned_by) === Number(user?.id)}
                editableStatus
                showAssigner
                focusedTaskId={focusedTaskId}
                setFocusedTaskId={setFocusedTaskId}
              />
              {visibleTasks.length > 0 && filteredTasks.length === 0 && filters.period !== "all" && (
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
                  disabled={!canSubmitReport || submittingReport}
                  onClick={handleSubmitReport}
                >
                  {alreadySubmittedForDate ? "Submitted" : submittingReport ? "Submitting..." : "Submit Report"}
                </button>
              </div>
              {submitMessage && <p className="mt-2 text-sm text-dsr-brand">{submitMessage}</p>}
            </section>
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

        {activeTab === "Reports" && (
          <section className="space-y-4">
            <ReportPage role="employee" initialDate={todayText} initialDateRange="week" />
          </section>
        )}

        {activeTab === "Profile" && (
          <ProfileSection
            user={user}
            departmentLabel={toTeamLabel(user?.team) || "-"}
            passwordForm={passwordForm}
            onPasswordFormChange={(field, value) => setPasswordForm((prev) => ({ ...prev, [field]: value }))}
            onSubmit={handlePasswordChange}
            passwordError={passwordError}
            passwordMessage={passwordMessage}
          />
        )}

        {loading && <p className="text-sm text-dsr-muted">Refreshing dashboard data...</p>}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

