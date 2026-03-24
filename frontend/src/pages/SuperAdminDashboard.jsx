import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import TaskTable from "../components/TaskTable";
import { useAuth } from "../context/AuthContext";
import { authApi, reportApi, taskApi } from "../services/api";

const TABS = ["Overview", "Tasks", "Users", "Notifications", "Profile"];

const defaultAnalytics = { tasksPerTeam: [], completionRate: 0, topPerformers: [] };

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [adminPerformance, setAdminPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ status: "all", team: "all", date: "" });
  const [usersFilter, setUsersFilter] = useState({ team: "all", role: "all", search: "" });
  const [reportDate, setReportDate] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const loadData = async () => {
    setBusy(true);
    try {
      const [usersRes, tasksRes, reportsRes, adminPerfRes, notificationRes] = await Promise.all([
        authApi.getUsers(),
        taskApi.getTasks(),
        reportApi.getReports(),
        taskApi.getAdminPerformance(),
        taskApi.getNotifications()
      ]);

      setUsers(usersRes.data || []);
      setTasks(tasksRes.data || []);
      setReports(reportsRes.data || []);
      setAdminPerformance(adminPerfRes.data || []);
      setNotifications(notificationRes.data || []);
    } finally {
      setBusy(false);
    }
  };

  const loadAnalytics = async () => {
    const analyticsRes = await reportApi.getAnalytics({
      team: filters.team,
      date: filters.date || undefined
    });
    setAnalytics(analyticsRes.data || defaultAnalytics);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
      loadAnalytics();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [filters.team, filters.date]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const userTeam = users.find((entry) => entry.id === item.assigned_to)?.team;
      const teamMatch = filters.team === "all" || userTeam === filters.team;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && teamMatch && dateMatch;
    });
  }, [tasks, filters, users]);

  const teams = useMemo(() => [...new Set(users.map((item) => item.team).filter(Boolean))], [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((entry) => {
      const roleMatch = usersFilter.role === "all" || entry.role === usersFilter.role;
      const teamMatch = usersFilter.team === "all" || entry.team === usersFilter.team;
      const searchMatch =
        !usersFilter.search ||
        entry.name.toLowerCase().includes(usersFilter.search.toLowerCase()) ||
        entry.email.toLowerCase().includes(usersFilter.search.toLowerCase());
      return roleMatch && teamMatch && searchMatch;
    });
  }, [users, usersFilter]);

  const dailyReportByEmployee = useMemo(() => {
    const selectedDate = reportDate || new Date().toISOString().slice(0, 10);
    const map = new Map();

    reports
      .filter((entry) => String(entry.date).slice(0, 10) === selectedDate)
      .forEach((entry) => {
        map.set(entry.employee_name, entry);
      });

    return map;
  }, [reports, reportDate]);

  const unreadCount = useMemo(
    () => notifications.filter((entry) => !entry.is_read).length,
    [notifications]
  );

  const handleGenerateReports = async () => {
    await reportApi.generateReports(reportDate || undefined);
    await loadData();
    await loadAnalytics();
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
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Failed to change password");
    }
  };

  return (
    <div className="min-h-screen bg-dsr-page text-dsr-ink">
      <header className="sticky top-0 z-30 border-b border-dsr-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-dsr-brand px-3 py-2 text-lg font-bold text-white">DSR</div>
            <div>
              <h1 className="text-xl font-extrabold text-dsr-ink">CludoBits SuperAdmin</h1>
              <p className="text-xs text-dsr-muted">Real-time analytics and performance metrics</p>
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
              <p className="text-sm font-bold capitalize text-dsr-ink">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{user?.role}</p>
            </div>
            <button type="button" onClick={logout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        <div className="grid gap-3 lg:hidden">
          <select
            className="input"
            value={activeTab}
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
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Users</p>
              <h3 className="text-3xl font-extrabold">{users.length}</h3>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Tasks</p>
              <h3 className="text-3xl font-extrabold">{tasks.length}</h3>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Reports</p>
              <h3 className="text-3xl font-extrabold">{reports.length}</h3>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">Completion Rate</p>
              <h3 className="text-3xl font-extrabold text-dsr-brand">{analytics.completionRate || 0}%</h3>
            </div>
          </div>
        </section>

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <section className="card">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Department</label>
                <select
                  className="input"
                  value={filters.team}
                  onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value }))}
                >
                  <option value="all">All Departments</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Task Date</label>
                <input
                  className="input"
                  type="date"
                  value={filters.date}
                  onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Report Date</label>
                <input
                  className="input"
                  type="date"
                  value={reportDate}
                  onChange={(event) => setReportDate(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button className="btn-primary w-full" onClick={handleGenerateReports} type="button">
                  Generate Reports
                </button>
              </div>
            </div>
          </section>
        )}

        {(activeTab === "Overview" || activeTab === "Tasks") && (
          <TaskTable
            tasks={filteredTasks}
            editableStatus={false}
            showAssignee
            showAssigner
          />
        )}

        {activeTab === "Overview" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Charts
              type="bar"
              title="Tasks Per Department"
              labels={analytics.tasksPerTeam?.map((item) => item.team) || []}
              values={analytics.tasksPerTeam?.map((item) => Number(item.total_tasks || 0)) || []}
              color="rgba(42, 122, 70, 0.8)"
            />
            <Charts
              type="bar"
              title="Top Performers (Productivity Score)"
              labels={analytics.topPerformers?.map((item) => item.name) || []}
              values={analytics.topPerformers?.map((item) => Number(item.productivity_score || 0)) || []}
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
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                className="input"
                placeholder="Search name or email"
                value={usersFilter.search}
                onChange={(event) => setUsersFilter((prev) => ({ ...prev, search: event.target.value }))}
              />
              <select
                className="input"
                value={usersFilter.team}
                onChange={(event) => setUsersFilter((prev) => ({ ...prev, team: event.target.value }))}
              >
                <option value="all">All Departments</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={usersFilter.role}
                onChange={(event) => setUsersFilter((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="all">All Roles</option>
                <option value="superadmin">Superadmin</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
              </select>
              <input
                className="input"
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
            </div>

            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-dsr-soft text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Daily Total</th>
                  <th className="p-3">Daily Completed</th>
                  <th className="p-3">Daily Pending</th>
                  <th className="p-3">Daily Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry) => {
                  const report = dailyReportByEmployee.get(entry.name);
                  return (
                    <tr key={entry.id} className="border-b border-dsr-border/70">
                      <td className="p-3 font-semibold">{entry.name}</td>
                      <td className="p-3">{entry.email}</td>
                      <td className="p-3 uppercase">{entry.role}</td>
                      <td className="p-3">{entry.team || "-"}</td>
                      <td className="p-3">{report?.total_tasks ?? "-"}</td>
                      <td className="p-3 text-emerald-700">{report?.completed_tasks ?? "-"}</td>
                      <td className="p-3 text-amber-700">{report?.pending_tasks ?? "-"}</td>
                      <td className="p-3 capitalize">{report?.status ?? "-"}</td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-dsr-muted">
                      No users found for current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "Notifications" && (
          <section className="card">
            <h2 className="mb-4 text-xl font-bold">Task Status Notifications</h2>
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${item.is_read ? "border-dsr-border" : "border-dsr-border bg-dsr-soft"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.message}</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-xs uppercase text-dsr-muted">
                        {item.type || "update"}
                      </span>
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

        {busy && <p className="text-sm text-dsr-muted">Refreshing dashboard data...</p>}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
