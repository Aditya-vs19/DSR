import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import AdminTaskFilters from "../components/AdminTaskFilters";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateTaskModal from "../components/CreateTaskModal";
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

const TABS = ["Overview", "Tasks", "Employees", "Reports"];

const getTabLabel = (tab) => (tab === "Employees" ? "Team" : tab);

const getManagedDepartmentLabel = (currentUser) => {
  const name = String(currentUser?.name || "").trim().toLowerCase();
  const team = String(currentUser?.team || "").trim();

  if (name === "snigdha" && team === "Sales") {
    return "Sales & Logistics";
  }

  return toTeamLabel(team) || "-";
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const isHeaderVisible = useScrollHeader();
  const todayText = getTodayText();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "all", date: "", employeeId: "all" });
  const [form, setForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    assignedTo: "",
    deadline: "",
    priority: "Medium",
    taskDepartment: String(user?.team || "").trim(),
    taskDate: todayText
  });
  const [selfAssign, setSelfAssign] = useState(false);
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [reassigningTaskId, setReassigningTaskId] = useState(null);
  const [submittingOwnReport, setSubmittingOwnReport] = useState(false);
  const [isOwnSubmitConfirmOpen, setIsOwnSubmitConfirmOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [ownSubmitMessage, setOwnSubmitMessage] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [comparisonFilter, setComparisonFilter] = useState({ mode: "overall", date: todayText });
  const managedDepartmentLabel = useMemo(() => getManagedDepartmentLabel(user), [user]);
  const taskDepartmentOptions = useMemo(
    () =>
      TASK_DEPARTMENTS.filter(Boolean).sort((left, right) => {
        if (left === user?.team) return -1;
        if (right === user?.team) return 1;
        return left.localeCompare(right);
      }),
    [user?.team]
  );
  const taskDepartmentSelectOptions = useMemo(
    () => taskDepartmentOptions.map((department) => ({ value: department, label: toTeamLabel(department) })),
    [taskDepartmentOptions]
  );
  const reassignOptions = useMemo(() => {
    const teamEmployees = employees.filter((item) => item.role === "employee");
    const adminSelfOption =
      user?.id && !teamEmployees.some((item) => Number(item.id) === Number(user.id))
        ? [
            {
              id: user.id,
              name: `${user.name} (Me)`,
              email: user.email,
              role: user.role,
              team: user.team
            }
          ]
        : [];

    return [...adminSelfOption, ...teamEmployees];
  }, [employees, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, employeesRes, perfRes, reportsRes, notificationRes] = await Promise.all([
        taskApi.getTasks(),
        authApi.getTeamEmployees(),
        taskApi.getTeamPerformance(),
        reportApi.getReports(),
        taskApi.getNotifications()
      ]);

      setTasks(tasksRes.data || []);
      setEmployees(employeesRes.data || []);
      setPerformance(perfRes.data || []);
      setReports(reportsRes.data || []);
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

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || getTaskDateText(item) === filters.date;
      const employeeMatch = filters.employeeId === "all" || String(item.assigned_to) === filters.employeeId;
      return statusMatch && dateMatch && employeeMatch;
    });
  }, [visibleTasks, filters]);

  const overviewDate = useMemo(() => filters.date || todayText, [filters.date, todayText]);

  const dailyOverviewTasks = useMemo(
    () => visibleTasks.filter((item) => getTaskDateText(item) === overviewDate),
    [overviewDate, visibleTasks]
  );

  const dailyOverviewCompletedTasks = useMemo(
    () =>
      dailyOverviewTasks.filter(
        (item) => String(item.raw_status || item.status || "").toLowerCase() === "completed"
      ).length,
    [dailyOverviewTasks]
  );

  const employeeTaskStatusChart = useMemo(() => {
    const employeeRecords = employees.filter((item) => item.role === "employee");
    const chartMembers = [...employeeRecords];

    if (user?.id) {
      chartMembers.push({
        id: user.id,
        name: `${user.name} (Admin)`,
        role: user.role,
        team: user.team
      });
    }

    const memberIdSet = new Set(chartMembers.map((item) => Number(item.id)));
    const chartTaskPool = visibleTasks.filter((item) => {
      const assigneeId = Number(item.assigned_to);
      if (!memberIdSet.has(assigneeId)) {
        return false;
      }

      if (comparisonFilter.mode !== "daywise") {
        return true;
      }

      const statusValue = String(item.raw_status || item.status || "").toLowerCase();
      const taskDate =
        statusValue === "completed"
          ? (item.completed_at || getTaskDateText(item) || item.created_at || "").slice(0, 10)
          : getTaskDateText(item);

      return taskDate === comparisonFilter.date;
    });

    const employeeStatusMap = new Map();

    chartMembers.forEach((item) => {
      employeeStatusMap.set(Number(item.id), {
        name: item.name,
        completed: 0,
        inProgress: 0,
        pending: 0
      });
    });

    chartTaskPool.forEach((task) => {
      const assigneeId = Number(task.assigned_to);
      const target = employeeStatusMap.get(assigneeId);

      if (!target) {
        return;
      }

      const statusValue = String(task.raw_status || task.status || "").toLowerCase();

      if (statusValue === "completed") {
        target.completed += 1;
      } else if (statusValue === "in progress") {
        target.inProgress += 1;
      } else if (statusValue === "pending") {
        target.pending += 1;
      }
    });

    const rows = Array.from(employeeStatusMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      labels: rows.map((item) => item.name),
      datasets: [
        {
          label: "Completed",
          data: rows.map((item) => Number(item.completed || 0)),
          backgroundColor: "#51bb2a",
          borderColor: "#51bb2a",
          borderWidth: 1
        },
        {
          label: "Pending",
          data: rows.map((item) => Number(item.pending || 0)),
          backgroundColor: "#f1dc21",
          borderColor: "#f1dc21",
          borderWidth: 1
        },
        {
          label: "In Progress",
          data: rows.map((item) => Number(item.inProgress || 0)),
          backgroundColor: "#33a8d6",
          borderColor: "#33a8d6",
          borderWidth: 1
        }
      ]
    };
  }, [employees, visibleTasks, comparisonFilter]);

  const yesterdayTaskSummary = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    return visibleTasks.reduce(
      (acc, item) => {
        const isYesterday = (item.assigned_at || getTaskDateText(item) || item.created_at || "").slice(0, 10) === yesterdayText;
        const isOwnTask = Number(item.assigned_to) === Number(user?.id);

        if (!isYesterday || !isOwnTask) {
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
  }, [visibleTasks, user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const adminReportDate = useMemo(() => filters.date || todayText, [filters.date, todayText]);

  const alreadySubmittedOwnForDate = useMemo(() => {
    if (!adminReportDate) {
      return false;
    }

    return reports.some(
      (entry) =>
        String(entry.date).slice(0, 10) === adminReportDate &&
        Number(entry.employee_id) === Number(user?.id) &&
        entry.received_status === "Received"
    );
  }, [adminReportDate, reports, user?.id]);

  const alreadySubmittedOwnToday = useMemo(
    () =>
      reports.some(
        (entry) =>
          String(entry.date).slice(0, 10) === todayText &&
          Number(entry.employee_id) === Number(user?.id) &&
          entry.received_status === "Received"
      ),
    [reports, todayText, user?.id]
  );

  const createTaskLockedForSelectedDate = useMemo(
    () => form.taskDate === todayText && alreadySubmittedOwnToday,
    [alreadySubmittedOwnToday, form.taskDate, todayText]
  );

  const handleAssign = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const assignedToId = selfAssign ? Number(user.id) : Number(form.assignedTo);
      const selectedTaskDepartment = String(form.taskDepartment || "").trim();

      if (!selectedTaskDepartment) {
        setError("Select task department");
        return;
      }

      await taskApi.createTask({
        ...form,
        taskDepartment: selectedTaskDepartment || undefined,
        taskDate: form.taskDate,
        assignedTo: assignedToId,
        type: selfAssign ? "self" : "assigned"
      });

      setForm({
        client: "",
        task: "",
        action: "",
        dependency: "",
        assignedTo: "",
        deadline: "",
        priority: "Medium",
        taskDepartment: String(user?.team || "").trim(),
        taskDate: todayText
      });
      setSelfAssign(false);
      setIsCreateTaskModalOpen(false);
      await loadData();
      setActiveTab("Tasks");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to assign task");
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

  const handleReassign = async (task, nextAssigneeId) => {
    setError("");
    setReassigningTaskId(task.id);

    try {
      const response = await taskApi.reassignTask(task.id, { assignedTo: nextAssigneeId });
      const updatedTask = response.data?.task;

      if (updatedTask) {
        setTasks((prev) => prev.map((entry) => (entry.id === task.id ? { ...entry, ...updatedTask } : entry)));
      }

      await loadData();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to reassign task");
    } finally {
      setReassigningTaskId(null);
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

  const handleSubmitOwnReport = async () => {
    if (alreadySubmittedOwnForDate) {
      setOwnSubmitMessage("You can only submit the report once in a day.");
      return;
    }

    setIsOwnSubmitConfirmOpen(true);
  };

  const handleConfirmSubmitOwnReport = async () => {
    setIsOwnSubmitConfirmOpen(false);
    setSubmittingOwnReport(true);
    setOwnSubmitMessage("");
    try {
      const response = await reportApi.submitReportToHr(adminReportDate);
      setOwnSubmitMessage(response.data?.message || "Self-task report submitted to HR.");
      await loadData();
    } catch (apiError) {
      setOwnSubmitMessage(apiError.response?.data?.message || "Failed to submit self-task report to HR");
    } finally {
      setSubmittingOwnReport(false);
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
    setFilters((prev) => ({ ...prev, status: "all", date: "", employeeId: "all" }));
    setFocusedTaskId(Number(notification.reference_id));
    await loadData();
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

  return (
    <div className="min-h-screen bg-dsr-page text-dsr-ink">
      <CreateTaskModal
        open={isCreateTaskModalOpen}
        title="Create Task"
        form={form}
        onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleAssign}
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
        showAssignment
        employees={employees}
        selfAssign={selfAssign}
        onSelfAssignChange={(checked) => {
          setSelfAssign(checked);
          if (checked) {
            setForm((prev) => ({ ...prev, assignedTo: String(user?.id || "") }));
          } else {
            setForm((prev) => ({ ...prev, assignedTo: "" }));
          }
        }}
        currentUserId={user?.id}
        currentUserName={user?.name}
      />
      <ConfirmDialog
        open={isOwnSubmitConfirmOpen}
        title="Submit Self-Task Report"
        message={`Do you want to submit your self-task report for ${adminReportDate}?`}
        confirmText="Submit"
        cancelText="Cancel"
        loading={submittingOwnReport}
        onCancel={() => setIsOwnSubmitConfirmOpen(false)}
        onConfirm={() => void handleConfirmSubmitOwnReport()}
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
                {getTabLabel(tab)}
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
              label={managedDepartmentLabel}
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
                {getTabLabel(tab)}
              </option>
            ))}
            <option value="Profile">Profile</option>
          </select>
        </div>

        {activeTab === "Overview" && (
          <section className="card-green">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Department</p>
                <h3 className="text-3xl font-extrabold">{managedDepartmentLabel}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Team Members</p>
                <h3 className="text-3xl font-extrabold">{employees.length}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Tasks</p>
                <h3 className="text-3xl font-extrabold">{dailyOverviewTasks.length}</h3>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Completed Tasks</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">
                  {dailyOverviewCompletedTasks}
                </h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Tasks" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-stretch">
            <section className="card h-full">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-dsr-ink">Tasks</h2>
                <button type="button" className="btn-primary" onClick={() => setIsCreateTaskModalOpen(true)}>
                  Create Task
                </button>
              </div>
              <AdminTaskFilters
                filters={filters}
                employees={employees}
                user={user}
                onStatusChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                onEmployeeChange={(value) => setFilters((prev) => ({ ...prev, employeeId: value }))}
                onDateChange={(value) => setFilters((prev) => ({ ...prev, date: value }))}
              />
              {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            </section>

            <PendingTasksSummary
              pending={yesterdayTaskSummary.pending}
              inProgress={yesterdayTaskSummary.inProgress}
              className="h-full xl:justify-self-end xl:self-stretch"
            />
          </div>
        )}

        {activeTab === "Overview" && (
          <>
            <section className="card">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">
                    Comparison View
                  </label>
                  <select
                    className="input"
                    value={comparisonFilter.mode}
                    onChange={(event) =>
                      setComparisonFilter((prev) => ({
                        ...prev,
                        mode: event.target.value
                      }))
                    }
                  >
                    <option value="overall">Overall Tasks</option>
                    <option value="daywise">Day-wise Tasks</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">
                    Comparison Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={comparisonFilter.date}
                    disabled={comparisonFilter.mode !== "daywise"}
                    onChange={(event) =>
                      setComparisonFilter((prev) => ({
                        ...prev,
                        date: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="rounded-xl border border-dsr-border bg-dsr-soft p-3 text-sm text-dsr-muted">
                  {comparisonFilter.mode === "overall"
                    ? "Showing overall completed, in-progress and pending tasks for all department employees."
                    : `Showing completed, in-progress and pending tasks for ${comparisonFilter.date || "selected date"}.`}
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Charts
                type="bar"
                title="Team Performance (%)"
                labels={performance.map((item) => item.name)}
                values={performance.map((item) => Number(item.completion_rate || 0))}
                color="rgba(42, 122, 70, 0.8)"
              />
              <Charts
                type="bar"
                title={
                  comparisonFilter.mode === "overall"
                    ? "Employee Tasks (Completed vs In Progress vs Pending) - Overall"
                    : `Employee Tasks (Completed vs In Progress vs Pending) - ${comparisonFilter.date}`
                }
                labels={employeeTaskStatusChart.labels}
                datasets={employeeTaskStatusChart.datasets}
              />
            </div>
          </>
        )}

        {activeTab === "Tasks" && (
          <>
            <TaskTable
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onDeleteTask={handleDeleteTask}
              canDeleteTask={(task) => Number(task.assigned_by) === Number(user?.id)}
              editableStatus
              showAssignee
              showReassign
              reassignOptions={reassignOptions}
              onReassign={handleReassign}
              reassigningTaskId={reassigningTaskId}
              focusedTaskId={focusedTaskId}
              setFocusedTaskId={setFocusedTaskId}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dsr-border bg-dsr-soft p-3">
              <p className="text-sm text-dsr-muted">
                Submit self-task report for: <span className="font-semibold text-dsr-ink">{adminReportDate}</span>
              </p>
              <button
                type="button"
                className={alreadySubmittedOwnForDate ? "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" : "btn-primary"}
                disabled={submittingOwnReport}
                onClick={handleSubmitOwnReport}
              >
                {alreadySubmittedOwnForDate ? "Submitted" : submittingOwnReport ? "Submitting..." : "Submit Report"}
              </button>
            </div>
            {ownSubmitMessage && <p className="mt-2 text-sm text-dsr-brand">{ownSubmitMessage}</p>}
          </>
        )}

        {activeTab === "Employees" && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Department Employees</h2>
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-dsr-soft text-left">
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((entry) => (
                      <tr key={entry.id} className="border-b border-dsr-border/70">
                        <td className="p-3 font-semibold">{entry.name}</td>
                        <td className="p-3">{entry.email}</td>
                        <td className="p-3 uppercase">{entry.role}</td>
                        <td className="p-3">{toTeamLabel(entry.team) || "-"}</td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-dsr-muted">
                          No employees found in this department
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Reports" && (
          <section className="space-y-4">
            <ReportPage role="admin" />
          </section>
        )}

        {activeTab === "Notifications" && (
          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Team Notifications</h2>
              {unreadCount > 0 && (
                <button className="btn-secondary" type="button" onClick={handleMarkAllRead}>
                  Mark all as read
                </button>
              )}
            </div>
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${item.is_read ? "border-dsr-border" : "border-dsr-border bg-dsr-soft"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.message}</p>
                    <div className="flex items-center gap-2">
                      {item.type?.startsWith("task_") && item.reference_id && (
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() => handleOpenTaskFromNotification(item)}
                        >
                          Open Task
                        </button>
                      )}
                      {!item.is_read && (
                        <button className="btn-secondary" type="button" onClick={() => handleMarkRead(item.id)}>
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
              {notifications.length === 0 && <p className="text-sm text-dsr-muted">No notifications yet</p>}
            </div>
          </section>
        )}

        {activeTab === "Profile" && (
          <ProfileSection
            user={user}
            departmentLabel={managedDepartmentLabel}
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

export default AdminDashboard;
