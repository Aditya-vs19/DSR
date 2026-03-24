import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import TaskTable from "../components/TaskTable";
import { useAuth } from "../context/AuthContext";
import { taskApi } from "../services/api";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total_tasks: 0, completed_tasks: 0, pending_tasks: 0 });
  const [timeline, setTimeline] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "all", date: "" });
  const [form, setForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    deadline: ""
  });

  const loadData = async () => {
    const [tasksRes, summaryRes, timelineRes, notificationRes] = await Promise.all([
      taskApi.getTasks(),
      taskApi.getDailySummary(),
      taskApi.getTimeline(14),
      taskApi.getNotifications()
    ]);

    setTasks(tasksRes.data);
    setSummary(summaryRes.data || {});
    setTimeline(timelineRes.data || []);
    setNotifications(notificationRes.data || []);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && dateMatch;
    });
  }, [tasks, filters]);

  const handleCreateTask = async (event) => {
    event.preventDefault();

    await taskApi.createTask({
      ...form,
      assignedTo: user.id,
      type: "self"
    });

    setForm({ client: "", task: "", action: "", dependency: "", deadline: "" });
    await loadData();
  };

  const handleStatusChange = async (task, status) => {
    await taskApi.updateTask(task.id, { status, dependency: task.dependency });
    await loadData();
  };

  const handleMarkRead = async (id) => {
    await taskApi.markNotificationRead(id);
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64">
        <Navbar
          title="Employee Dashboard"
          notifications={notifications}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card">
              <p className="text-sm text-slate-500">Total Tasks Today</p>
              <h3 className="text-2xl font-bold">{summary.total_tasks || 0}</h3>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Completed</p>
              <h3 className="text-2xl font-bold text-green-600">{summary.completed_tasks || 0}</h3>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Pending</p>
              <h3 className="text-2xl font-bold text-yellow-600">{summary.pending_tasks || 0}</h3>
            </div>
          </div>

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
              Add Task
            </button>
          </form>

          <div className="card flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs">Status</label>
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
              <label className="mb-1 block text-xs">Date</label>
              <input
                className="input"
                type="date"
                value={filters.date}
                onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
          </div>

          <TaskTable tasks={filteredTasks} onStatusChange={handleStatusChange} editableStatus />

          <Charts
            type="line"
            title="Tasks Completed Per Day"
            labels={timeline.map((point) => point.day)}
            values={timeline.map((point) => point.completed_count)}
            color="rgba(34, 197, 94, 0.8)"
          />

          <div className="card">
            <h2 className="mb-2 text-lg font-semibold">Notifications</h2>
            <div className="space-y-2">
              {notifications.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                  <p className="text-sm">{item.message}</p>
                  {!item.is_read && (
                    <button className="btn-secondary" onClick={() => handleMarkRead(item.id)} type="button">
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
              {notifications.length === 0 && <p className="text-sm text-slate-500">No notifications</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
