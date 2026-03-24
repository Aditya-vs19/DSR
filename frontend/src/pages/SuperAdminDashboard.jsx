import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import TaskTable from "../components/TaskTable";
import { useAuth } from "../context/AuthContext";
import { authApi, reportApi, taskApi } from "../services/api";

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState({ tasksPerTeam: [], completionRate: 0, topPerformers: [] });
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "all", team: "all", date: "" });

  const loadData = async () => {
    const [usersRes, tasksRes, reportsRes, analyticsRes, notificationRes] = await Promise.all([
      authApi.getUsers(),
      taskApi.getTasks(),
      reportApi.getReports(),
      reportApi.getAnalytics(),
      taskApi.getNotifications()
    ]);

    setUsers(usersRes.data || []);
    setTasks(tasksRes.data || []);
    setReports(reportsRes.data || []);
    setAnalytics(analyticsRes.data || { tasksPerTeam: [], completionRate: 0, topPerformers: [] });
    setNotifications(notificationRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const teamMatch =
        filters.team === "all" ||
        users.find((entry) => entry.id === item.assigned_to)?.team === filters.team;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && teamMatch && dateMatch;
    });
  }, [tasks, filters, users]);

  const teams = useMemo(() => [...new Set(users.map((item) => item.team).filter(Boolean))], [users]);

  const handleGenerateReports = async () => {
    await reportApi.generateReports();
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64">
        <Navbar
          title="SuperAdmin Dashboard"
          notifications={notifications}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="card"><p className="text-xs text-slate-500">Users</p><h3 className="text-2xl font-bold">{users.length}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Tasks</p><h3 className="text-2xl font-bold">{tasks.length}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Reports</p><h3 className="text-2xl font-bold">{reports.length}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Completion Rate</p><h3 className="text-2xl font-bold text-indigo-600">{analytics.completionRate}%</h3></div>
          </div>

          <div className="card flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs">Status</label>
              <select className="input" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="all">All</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs">Team</label>
              <select className="input" value={filters.team} onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value }))}>
                <option value="all">All Teams</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs">Date</label>
              <input className="input" type="date" value={filters.date} onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))} />
            </div>
            <button className="btn-primary" onClick={handleGenerateReports} type="button">
              Generate Reports Now
            </button>
          </div>

          <TaskTable tasks={filteredTasks} editableStatus={false} />

          <div className="grid gap-4 md:grid-cols-2">
            <Charts
              type="bar"
              title="Tasks Per Team"
              labels={analytics.tasksPerTeam?.map((item) => item.team) || []}
              values={analytics.tasksPerTeam?.map((item) => item.total_tasks) || []}
              color="rgba(59, 130, 246, 0.8)"
            />
            <Charts
              type="bar"
              title="Top Performers (Productivity Score)"
              labels={analytics.topPerformers?.map((item) => item.name) || []}
              values={analytics.topPerformers?.map((item) => Number(item.productivity_score || 0)) || []}
              color="rgba(168, 85, 247, 0.8)"
            />
          </div>

          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-semibold">All Users</h2>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Team</th>
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-2">{entry.name}</td>
                    <td className="p-2">{entry.email}</td>
                    <td className="p-2 uppercase">{entry.role}</td>
                    <td className="p-2">{entry.team || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
