import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import ReportPage from "./ReportPage";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import useScrollHeader from "../hooks/useScrollHeader";
import { authApi, reportApi, taskApi } from "../services/api";

const TABS = ["Overview", "Tasks", "Users", "Reports", "Profile"];

const getManagedDepartmentLabel = (currentUser) => {
  const name = String(currentUser?.name || "").trim().toLowerCase();
  const team = String(currentUser?.team || "").trim();

  if (name === "snigdha" && team === "Sales") {
    return "Sales & Logistics";
  }

  return team || "-";
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const isHeaderVisible = useScrollHeader();
  const todayText = new Date().toISOString().slice(0, 10);
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
    deadline: ""
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
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [comparisonFilter, setComparisonFilter] = useState({ mode: "overall", date: todayText });
  const managedDepartmentLabel = useMemo(() => getManagedDepartmentLabel(user), [user]);

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      const employeeMatch = filters.employeeId === "all" || String(item.assigned_to) === filters.employeeId;
      return statusMatch && dateMatch && employeeMatch;
    });
  }, [tasks, filters]);

  const employeeTaskStatusChart = useMemo(() => {
    const employeeRecords = employees.filter((item) => item.role === "employee");
    const employeeIdSet = new Set(employeeRecords.map((item) => Number(item.id)));
    const chartTaskPool = tasks.filter((item) => {
      const assigneeId = Number(item.assigned_to);
      if (!employeeIdSet.has(assigneeId)) {
        return false;
      }

      if (comparisonFilter.mode !== "daywise") {
        return true;
      }

      const statusValue = String(item.raw_status || item.status || "").toLowerCase();
      const taskDate =
        statusValue === "completed"
          ? (item.completed_at || item.created_at || "").slice(0, 10)
          : (item.created_at || "").slice(0, 10);

      return taskDate === comparisonFilter.date;
    });

    const employeeStatusMap = new Map();

    employeeRecords.forEach((item) => {
      employeeStatusMap.set(Number(item.id), {
        name: item.name,
        completed: 0,
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
          backgroundColor: "rgba(33, 128, 70, 0.85)",
          borderColor: "rgba(33, 128, 70, 1)",
          borderWidth: 1
        },
        {
          label: "Pending",
          data: rows.map((item) => Number(item.pending || 0)),
          backgroundColor: "rgba(220, 38, 38, 0.8)",
          borderColor: "rgba(220, 38, 38, 1)",
          borderWidth: 1
        }
      ]
    };
  }, [employees, tasks, comparisonFilter]);

  const pendingTasksFromYesterday = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayText = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    const carriedForwardSourceIds = new Set(
      tasks
        .map((item) => item.carried_forward_from_id)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
    );

    return tasks.filter(
      (item) =>
        item.status === "Pending" &&
        ((item.assigned_at || item.created_at || "").slice(0, 10) === yesterdayText) &&
        !carriedForwardSourceIds.has(Number(item.id))
    ).length;
  }, [tasks]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const handleAssign = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const assignedToId = selfAssign ? Number(user.id) : Number(form.assignedTo);

      await taskApi.createTask({
        ...form,
        assignedTo: assignedToId,
        type: selfAssign ? "self" : "assigned"
      });

      setForm({ client: "", task: "", action: "", dependency: "", assignedTo: "", deadline: "" });
      setSelfAssign(false);
      await loadData();
      setActiveTab("Tasks");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Failed to assign task");
    }
  };

  const handleStatusChange = async (task, status, dependency = task.dependency) => {
    setError("");

    try {
      await taskApi.updateTask(task.id, { status, dependency });
      setTasks((prev) =>
        prev.map((entry) =>
          entry.id === task.id
            ? {
                ...entry,
                status,
                dependency
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{managedDepartmentLabel} Admin</p>
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
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Department</p>
                <h3 className="text-3xl font-extrabold">{managedDepartmentLabel}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Team Members</p>
                <h3 className="text-3xl font-extrabold">{employees.length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Tasks</p>
                <h3 className="text-3xl font-extrabold">{tasks.length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Reports</p>
                <h3 className="text-3xl font-extrabold text-dsr-brand">{reports.length}</h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Tasks" && (
          <form className="card grid w-full gap-2 md:grid-cols-2" onSubmit={handleAssign}>
            <h2 className="md:col-span-2 text-lg font-semibold">Create Task</h2>
            <div>
              <h2 className="mb-1 text-sm text-dsr-muted">Client / Vendor</h2>
              <input
                className="input"
                value={form.client}
                onChange={(event) => setForm((prev) => ({ ...prev, client: event.target.value }))}
              />
            </div>
            <div>
              <h2 className="mb-1 text-sm text-dsr-muted">Task</h2>
              <input
                className="input"
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                required
              />
            </div>
            <h2 className="md:col-span-2 text-sm text-dsr-muted">Assign</h2>
            <select
              className="input"
              value={form.assignedTo}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
              disabled={selfAssign}
              required
            >
              <option value="">Assign to team employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-dsr-border bg-dsr-soft px-3 py-2 text-sm text-dsr-muted">
              <input
                type="checkbox"
                checked={selfAssign}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelfAssign(checked);
                  if (checked) {
                    setForm((prev) => ({ ...prev, assignedTo: String(user?.id || "") }));
                  } else {
                    setForm((prev) => ({ ...prev, assignedTo: "" }));
                  }
                }}
              />
              Self assign (assign to me)
            </label>
            <h2 className="md:col-span-2 text-sm text-dsr-muted">Action</h2>
            <textarea
              className="input md:col-span-2"
              placeholder="Action"
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

        {activeTab === "Tasks" && (
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
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Employee</label>
                <select
                  className="input"
                  value={filters.employeeId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}
                >
                  <option value="all">All Team Members</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={String(employee.id)}>
                      {employee.name}
                    </option>
                  ))}
                  <option value={String(user?.id || "")}>Self ({user?.name})</option>
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
              {pendingTasksFromYesterday > 0 && (
                <div className="rounded-xl border border-rose-300 bg-rose-100 p-3 text-sm font-semibold text-rose-800 md:col-start-4">
                  You have {pendingTasksFromYesterday} pending {pendingTasksFromYesterday === 1 ? "task" : "tasks"} from yesterday.
                </div>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </section>
        )}

        {activeTab === "Overview" && (
          <>
            <section className="card">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">
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
                    ? "Showing overall completed vs pending tasks for all department employees."
                    : `Showing completed vs pending tasks for ${comparisonFilter.date || "selected date"}.`}
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
                    ? "Employee Tasks (Completed vs Pending) - Overall"
                    : `Employee Tasks (Completed vs Pending) - ${comparisonFilter.date}`
                }
                labels={employeeTaskStatusChart.labels}
                datasets={employeeTaskStatusChart.datasets}
              />
            </div>
            <TaskTable
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              editableStatus
              showAssignee
              showReassign
              reassignOptions={employees}
              onReassign={handleReassign}
              reassigningTaskId={reassigningTaskId}
              focusedTaskId={focusedTaskId}
            />
          </>
        )}

        {activeTab === "Tasks" && (
          <TaskTable
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            editableStatus
            showAssignee
            showReassign
            reassignOptions={employees}
            onReassign={handleReassign}
            reassigningTaskId={reassigningTaskId}
            focusedTaskId={focusedTaskId}
          />
        )}

        {activeTab === "Users" && (
          <section className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-semibold">Department Users</h2>
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
                    <td className="p-3">{entry.team || "-"}</td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-dsr-muted">
                      No users found in this department
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
          <section className="space-y-4">
            <div className="card-green">
              <h2 className="mb-4 text-2xl font-bold">Profile</h2>
              <div className="grid gap-3 rounded-xl border border-dsr-border/70 bg-white/60 p-4 text-sm md:grid-cols-2">
                <p><span className="font-semibold">Name:</span> {user?.name}</p>
                <p><span className="font-semibold">Role:</span> {String(user?.role || "").toUpperCase()}</p>
                <p><span className="font-semibold">Email:</span> {user?.email}</p>
                <p><span className="font-semibold">Department:</span> {managedDepartmentLabel}</p>
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

export default AdminDashboard;
