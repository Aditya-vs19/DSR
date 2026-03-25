import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.jpeg";
import { useAuth } from "../context/AuthContext";
import { authApi, reportApi, taskApi } from "../services/api";

const TABS = ["Overview", "Tasks", "Profile"];

const getLocalDateText = (date = new Date()) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
};

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const todayText = getLocalDateText();
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total_tasks: 0, completed_tasks: 0, pending_tasks: 0 });
  const [timeline, setTimeline] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
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

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const newTaskNotifications = useMemo(
    () => notifications.filter((item) => item.type === "task_assigned"),
    [notifications]
  );

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

  const handleStatusChange = async (task, status, dependency = task.dependency) => {
    await taskApi.updateTask(task.id, { status, dependency });
    await loadData();
  };

  const handleMarkRead = async (id) => {
    await taskApi.markNotificationRead(id);
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

  return (
    <div className="min-h-screen bg-dsr-page text-dsr-ink">
      <header className="sticky top-0 z-30 border-b border-dsr-border bg-[#f3f3f3]">
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{user?.team || "Employee"}</p>
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
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Task Period</label>
                <select
                  className="input"
                  value={filters.period}
                  onChange={(event) => {
                    const period = event.target.value;
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
                  }}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today (Default)</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Custom Date</label>
                <input
                  className="input"
                  type="date"
                  disabled={filters.period !== "custom"}
                  value={filters.date}
                  onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
              <div className="rounded-xl border border-dsr-border bg-dsr-soft p-3 text-sm text-dsr-muted">
                Status updates are live. Admin and SuperAdmin dashboards receive updates automatically.
              </div>
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
                className="btn-primary"
                disabled={!canSubmitReport || submittingReport || alreadySubmittedForDate}
                onClick={handleSubmitReport}
              >
                {alreadySubmittedForDate ? "Submitted" : submittingReport ? "Submitting..." : "Submit Report"}
              </button>
            </div>
            {submitMessage && <p className="mt-2 text-sm text-dsr-brand">{submitMessage}</p>}
          </section>
        )}

        {activeTab === "Tasks" && (
          <form className="card grid gap-3 md:grid-cols-2" onSubmit={handleCreateTask}>
            <h2 className="md:col-span-2 text-lg font-semibold">Create Task</h2>
            <input
              className="input"
              placeholder="Client"
              value={form.client}
              onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Task title"
              value={form.task}
              onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
              required
            />
            <textarea
              className="input md:col-span-2"
              placeholder="Action"
              value={form.action}
              onChange={(event) => setForm((prev) => ({ ...prev, action: event.target.value }))}
              required
            />
            <input
              className="input"
              placeholder="Dependency"
              value={form.dependency}
              onChange={(event) => setForm((prev) => ({ ...prev, dependency: event.target.value }))}
            />
            <input
              className="input"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
            />
            <button className="btn-primary md:col-span-2" type="submit">
              Add Task
            </button>
            {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
          </form>
        )}

        {activeTab === "Overview" && (
          <div className="grid gap-2 lg:grid-cols-2">
            <Charts
              type="bar"
              title="Tasks Completed Per Day"
              labels={timeline.map((point) => point.day)}
              values={timeline.map((point) => point.completed_count)}
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
            <h2 className="mb-3 text-lg font-semibold">Notifications</h2>
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${item.is_read ? "border-dsr-border" : "border-dsr-border bg-dsr-soft"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.message}</p>
                    {!item.is_read && (
                      <button className="btn-secondary" onClick={() => handleMarkRead(item.id)} type="button">
                        Mark Read
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-dsr-muted">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </p>
                </div>
              ))}
              {notifications.length === 0 && <p className="text-sm text-dsr-muted">No notifications</p>}
            </div>
          </section>
        )}

        {activeTab === "Profile" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card-green">
              <h2 className="mb-3 text-xl font-bold">Profile</h2>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Name:</span> {user?.name}</p>
                <p><span className="font-semibold">Role:</span> {String(user?.role || "").toUpperCase()}</p>
                <p><span className="font-semibold">Email:</span> {user?.email}</p>
                <p><span className="font-semibold">Department:</span> {user?.team || "-"}</p>
              </div>
            </div>

            <form className="card" onSubmit={handlePasswordChange}>
              <h2 className="mb-3 text-xl font-bold">Settings - Change Password</h2>
              <div className="space-y-3">
                <input
                  className="input"
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

                {passwordError && <p className="text-sm text-rose-600">{passwordError}</p>}
                {passwordMessage && <p className="text-sm text-emerald-700">{passwordMessage}</p>}

                <button className="btn-primary" type="submit">
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
