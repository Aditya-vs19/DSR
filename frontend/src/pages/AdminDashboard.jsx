import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.jpeg";
import { useAuth } from "../context/AuthContext";
import { authApi, reportApi, taskApi } from "../services/api";

const TABS = ["Overview", "Tasks", "Users", "Reports", "Notifications", "Profile"];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [adminPerformance, setAdminPerformance] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "all", date: "", employeeId: "all" });
  const [reportFilterDate, setReportFilterDate] = useState("");
  const [reportGenerateDate, setReportGenerateDate] = useState("");
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, employeesRes, perfRes, adminPerfRes, reportsRes, notificationRes] = await Promise.all([
        taskApi.getTasks(),
        authApi.getTeamEmployees(),
        taskApi.getTeamPerformance(),
        taskApi.getAdminPerformance(),
        reportApi.getReports(),
        taskApi.getNotifications()
      ]);

      setTasks(tasksRes.data || []);
      setEmployees(employeesRes.data || []);
      setPerformance(perfRes.data || []);
      setAdminPerformance(adminPerfRes.data || []);
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

  const filteredReports = useMemo(() => {
    if (!reportFilterDate) {
      return reports;
    }
    return reports.filter((item) => String(item.date).slice(0, 10) === reportFilterDate);
  }, [reports, reportFilterDate]);

  const reportSummary = useMemo(() => {
    const total = filteredReports.length;
    const completed = filteredReports.reduce(
      (sum, item) => sum + Number(item.completed_tasks || 0),
      0
    );
    const pending = filteredReports.reduce((sum, item) => sum + Number(item.pending_tasks || 0), 0);
    return { total, completed, pending };
  }, [filteredReports]);

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

  const handleStatusChange = async (task, status) => {
    await taskApi.updateTask(task.id, { status, dependency: task.dependency });
    await loadData();
  };

  const handleGenerateReports = async () => {
    await reportApi.generateReports(reportGenerateDate || undefined);
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
      <header className="sticky top-0 z-30 border-b border-dsr-border bg-[#f7f7f7] backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-5">
            <img src={logo} alt="DSR Management Logo" className="h-12 w-auto -ml-6 object-contain lg:-ml-10" />
            <div className="ml-4 lg:ml-8">
              <h1 className="text-xl font-extrabold">Department Admin Dashboard</h1>
              <p className="text-xs text-dsr-muted">{user?.team || "Team"} administration workspace</p>
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{user?.team} Admin</p>
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Department</p>
              <h3 className="text-3xl font-extrabold">{user?.team || "-"}</h3>
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

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <form className="card grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleAssign}>
            <h2 className="md:col-span-2 xl:col-span-3 text-lg font-semibold">Create and Assign Task</h2>
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
            <label className="flex items-center gap-2 text-sm text-dsr-muted">
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
            <textarea
              className="input md:col-span-2 xl:col-span-3"
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
            <div className="flex items-end">
              <button className="btn-primary w-full" type="submit">
                Assign Task
              </button>
            </div>
            {error && <p className="md:col-span-2 xl:col-span-3 text-sm text-rose-600">{error}</p>}
          </form>
        )}

        {(activeTab === "Overview" || activeTab === "Tasks") && (
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
            </div>
          </section>
        )}

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <TaskTable
            tasks={filteredTasks}
            onStatusChange={handleStatusChange}
            editableStatus
            showAssignee
            showAssigner
          />
        )}

        {activeTab === "Overview" && (
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
              title="Completed Tasks by Employee"
              labels={filteredReports.map((item) => item.employee_name)}
              values={filteredReports.map((item) => Number(item.completed_tasks || 0))}
              color="rgba(95, 157, 114, 0.85)"
            />
            <Charts
              type="bar"
              title="Department Admin Performance (%)"
              labels={adminPerformance.map((item) => item.name)}
              values={adminPerformance.map((item) => Number(item.completion_rate || 0))}
              color="rgba(31, 84, 50, 0.85)"
            />
          </div>
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
          <section className="card overflow-x-auto">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <input
                className="input"
                type="date"
                value={reportFilterDate}
                onChange={(event) => setReportFilterDate(event.target.value)}
              />
              <input
                className="input"
                type="date"
                value={reportGenerateDate}
                onChange={(event) => setReportGenerateDate(event.target.value)}
              />
              <button className="btn-primary" type="button" onClick={handleGenerateReports}>
                Generate Department Reports
              </button>
            </div>

            <div className="mb-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-dsr-soft p-3">
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Total Reports</p>
                <p className="text-2xl font-bold">{reportSummary.total}</p>
              </div>
              <div className="rounded-xl bg-dsr-soft p-3">
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Completed Tasks</p>
                <p className="text-2xl font-bold text-emerald-700">{reportSummary.completed}</p>
              </div>
              <div className="rounded-xl bg-dsr-soft p-3">
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Pending Tasks</p>
                <p className="text-2xl font-bold text-amber-700">{reportSummary.pending}</p>
              </div>
            </div>

            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-dsr-soft text-left">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Completed</th>
                  <th className="p-3">Pending</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((entry) => (
                  <tr key={entry.id} className="border-b border-dsr-border/70">
                    <td className="p-3 font-semibold">{entry.employee_name}</td>
                    <td className="p-3">{String(entry.date).slice(0, 10)}</td>
                    <td className="p-3">{entry.total_tasks}</td>
                    <td className="p-3 text-emerald-700">{entry.completed_tasks}</td>
                    <td className="p-3 text-amber-700">{entry.pending_tasks}</td>
                    <td className="p-3 capitalize">{entry.status}</td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-dsr-muted">
                      No reports found for selected date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "Notifications" && (
          <section className="card">
            <h2 className="mb-3 text-lg font-semibold">Team Notifications</h2>
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${item.is_read ? "border-dsr-border" : "border-dsr-border bg-dsr-soft"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.message}</p>
                    {!item.is_read && (
                      <button className="btn-secondary" type="button" onClick={() => handleMarkRead(item.id)}>
                        Mark Read
                      </button>
                    )}
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

export default AdminDashboard;
