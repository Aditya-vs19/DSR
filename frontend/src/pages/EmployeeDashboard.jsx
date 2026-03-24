import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import TaskTable from "../components/TaskTable";
import { useAuth } from "../context/AuthContext";
import { authApi, taskApi } from "../services/api";

const TABS = ["Overview", "Assigned Tasks", "My Tasks", "Notifications", "Profile"];

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total_tasks: 0, completed_tasks: 0, pending_tasks: 0 });
  const [timeline, setTimeline] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "all", date: "" });
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
      const [tasksRes, summaryRes, timelineRes, notificationRes] = await Promise.all([
        taskApi.getTasks(),
        taskApi.getDailySummary(),
        taskApi.getTimeline(14),
        taskApi.getNotifications()
      ]);

      setTasks(tasksRes.data || []);
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

  const assignedTasks = useMemo(() => tasks.filter((item) => item.type === "assigned"), [tasks]);

  const selfTasks = useMemo(() => tasks.filter((item) => item.type === "self"), [tasks]);

  const filteredAssignedTasks = useMemo(() => {
    return assignedTasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && dateMatch;
    });
  }, [assignedTasks, filters]);

  const filteredSelfTasks = useMemo(() => {
    return selfTasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && dateMatch;
    });
  }, [selfTasks, filters]);

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
      setActiveTab("My Tasks");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to create task");
    }
  };

  const handleStatusChange = async (task, status) => {
    await taskApi.updateTask(task.id, { status, dependency: task.dependency });
    await loadData();
  };

  const handleMarkRead = async (id) => {
    await taskApi.markNotificationRead(id);
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
      <header className="sticky top-0 z-30 border-b border-dsr-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-dsr-brand px-3 py-2 text-lg font-bold text-white">DSR</div>
            <div>
              <h1 className="text-xl font-extrabold">Employee Dashboard</h1>
              <p className="text-xs text-dsr-muted">Action your assigned tasks and update status live</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 rounded-full border border-dsr-border bg-dsr-soft px-2 py-1 lg:flex">
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
                {tab === "Notifications" && unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold capitalize">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{user?.team || "Employee"}</p>
            </div>
            <button className="btn-secondary" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        <div className="grid gap-3 lg:hidden">
          <select className="input" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Assigned Tasks</p>
              <h3 className="text-3xl font-extrabold">{assignedTasks.length}</h3>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Self Tasks</p>
              <h3 className="text-3xl font-extrabold">{selfTasks.length}</h3>
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

        {(activeTab === "Overview" || activeTab === "Assigned Tasks" || activeTab === "My Tasks") && (
          <section className="card">
            <div className="grid gap-3 md:grid-cols-3">
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Date</label>
                <input
                  className="input"
                  type="date"
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

        {(activeTab === "Overview" || activeTab === "Assigned Tasks") && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Assigned Task List</h2>
            <TaskTable
              tasks={filteredAssignedTasks}
              onStatusChange={handleStatusChange}
              editableStatus
              showAssigner
            />
          </section>
        )}

        {(activeTab === "Overview" || activeTab === "My Tasks") && (
          <form className="card grid gap-3 md:grid-cols-2" onSubmit={handleCreateTask}>
            <h2 className="md:col-span-2 text-lg font-semibold">Create Self Task</h2>
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
              Add Self Task
            </button>
            {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
          </form>
        )}

        {(activeTab === "Overview" || activeTab === "My Tasks") && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">My Self Tasks</h2>
            <TaskTable tasks={filteredSelfTasks} onStatusChange={handleStatusChange} editableStatus />
          </section>
        )}

        {activeTab === "Overview" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Charts
              type="line"
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
