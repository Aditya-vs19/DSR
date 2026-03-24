import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import TaskTable from "../components/TaskTable";
import { useAuth } from "../context/AuthContext";
import { authApi, taskApi } from "../services/api";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "all", date: "" });
  const [form, setForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    assignedTo: "",
    deadline: ""
  });

  const loadData = async () => {
    const [tasksRes, employeesRes, perfRes, notificationRes] = await Promise.all([
      taskApi.getTasks(),
      authApi.getTeamEmployees(),
      taskApi.getTeamPerformance(),
      taskApi.getNotifications()
    ]);

    setTasks(tasksRes.data);
    setEmployees(employeesRes.data || []);
    setPerformance(perfRes.data || []);
    setNotifications(notificationRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && dateMatch;
    });
  }, [tasks, filters]);

  const handleAssign = async (event) => {
    event.preventDefault();

    await taskApi.createTask({
      ...form,
      assignedTo: Number(form.assignedTo),
      type: "assigned"
    });

    setForm({ client: "", task: "", action: "", dependency: "", assignedTo: "", deadline: "" });
    await loadData();
  };

  const handleStatusChange = async (task, status) => {
    await taskApi.updateTask(task.id, { status, dependency: task.dependency });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64">
        <Navbar
          title="Admin Dashboard"
          notifications={notifications}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="space-y-4 p-4">
          <form className="card grid gap-3 md:grid-cols-2" onSubmit={handleAssign}>
            <h2 className="md:col-span-2 text-lg font-semibold">Assign Task</h2>
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
            <select
              className="input"
              value={form.assignedTo}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
              required
            >
              <option value="">Assign to employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.team})
                </option>
              ))}
            </select>
            <input
              className="input md:col-span-2"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))}
            />
            <button className="btn-primary md:col-span-2" type="submit">
              Assign Task
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
            type="bar"
            title="Team Performance (%)"
            labels={performance.map((item) => item.name)}
            values={performance.map((item) => Number(item.completion_rate || 0))}
            color="rgba(59, 130, 246, 0.8)"
          />
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
