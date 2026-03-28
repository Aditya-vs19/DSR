import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import ReportPage from "./ReportPage";
import TaskTable from "../components/TaskTable";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import useScrollHeader from "../hooks/useScrollHeader";
import { authApi, reportApi, taskApi } from "../services/api";
import { toTeamLabel } from "../utils/teamLabel";

const TABS = ["Overview", "Tasks", "Employees", "Reports", "Profile"];

const defaultAnalytics = { tasksPerTeam: [], completionRate: 0, topPerformers: [] };

const TEAM_DONUT_COLORS = {
  Operations: "#E67E22",
  Technical: "#3A6FF7",
  Sales: "#8B5CF6",
  Finance: "#E57399",
  Logistics: "#F4C542"
};

const FALLBACK_DONUT_COLORS = [
  "#2A7A46",
  "#5F9D72",
  "#1F5432",
  "#398859",
  "#7AAE89",
  "#166534"
];

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const isHeaderVisible = useScrollHeader();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [adminPerformance, setAdminPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ status: "all", team: "all", employeeId: "all", date: "" });
  const [usersFilter, setUsersFilter] = useState({ team: "all", role: "all", search: "" });
  const [reportDate, setReportDate] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    team: ""
  });
  const [newUserMessage, setNewUserMessage] = useState("");
  const [newUserError, setNewUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [managedPasswordDrafts, setManagedPasswordDrafts] = useState({});
  const [managedPasswordBusyId, setManagedPasswordBusyId] = useState(null);
  const [managedPasswordError, setManagedPasswordError] = useState("");
  const [managedPasswordToast, setManagedPasswordToast] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState(null);

  const loadData = async () => {
    setBusy(true);
    try {
      const [usersRes, tasksRes, reportsRes, adminPerfRes, notificationRes] = await Promise.all([
        authApi.getEmployees(),
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

  useEffect(() => {
    if (activeTab !== "Overview") {
      return;
    }

    setFilters((prev) => ({
      ...prev,
      status: "all",
      employeeId: "all"
    }));
  }, [activeTab]);

  useEffect(() => {
    if (!managedPasswordToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setManagedPasswordToast("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [managedPasswordToast]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const userTeam = users.find((entry) => entry.id === item.assigned_to)?.team;
      const teamMatch = filters.team === "all" || userTeam === filters.team;
      const employeeMatch =
        filters.employeeId === "all" || String(item.assigned_to) === String(filters.employeeId);
      const dateMatch = !filters.date || (item.created_at || "").slice(0, 10) === filters.date;
      return statusMatch && teamMatch && employeeMatch && dateMatch;
    });
  }, [tasks, filters, users]);

  const taskEmployeeOptions = useMemo(() => {
    const scopedUsers = users.filter((entry) => {
      if (entry.role !== "employee") {
        return false;
      }

      if (filters.team === "all") {
        return true;
      }

      return entry.team === filters.team;
    });

    return scopedUsers.sort((a, b) => a.name.localeCompare(b.name));
  }, [filters.team, users]);

  useEffect(() => {
    if (filters.employeeId === "all") {
      return;
    }

    const isValidEmployee = taskEmployeeOptions.some(
      (entry) => String(entry.id) === String(filters.employeeId)
    );

    if (!isValidEmployee) {
      setFilters((prev) => ({ ...prev, employeeId: "all" }));
    }
  }, [filters.employeeId, taskEmployeeOptions]);

  const teams = useMemo(() => [...new Set(users.map((item) => item.team).filter(Boolean))], [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((entry) => {
      const roleMatch = usersFilter.role === "all" || entry.role === usersFilter.role;
      const effectiveTeamFilter = usersFilter.team !== "all" ? usersFilter.team : filters.team;
      const teamMatch = effectiveTeamFilter === "all" || entry.team === effectiveTeamFilter;
      const searchMatch =
        !usersFilter.search ||
        entry.name.toLowerCase().includes(usersFilter.search.toLowerCase()) ||
        entry.email.toLowerCase().includes(usersFilter.search.toLowerCase());
      return roleMatch && teamMatch && searchMatch;
    });
  }, [users, usersFilter, filters.team]);

  const unreadCount = useMemo(
    () => notifications.filter((entry) => !entry.is_read).length,
    [notifications]
  );

  const completedTasksPieData = useMemo(() => {
    const filteredCompletedTasks = tasks.filter((item) => {
      if (item.status !== "Completed") {
        return false;
      }

      if (!filters.date) {
        return true;
      }

      const completedDate = (item.completed_at || item.created_at || "").slice(0, 10);
      return completedDate === filters.date;
    });

    if (filters.team && filters.team !== "all") {
      const employeeTotals = new Map();

      users
        .filter((item) => item.role === "employee" && item.team === filters.team)
        .forEach((item) => {
          employeeTotals.set(item.name, 0);
        });

      filteredCompletedTasks.forEach((task) => {
        const employee = users.find((item) => Number(item.id) === Number(task.assigned_to));
        if (!employee || employee.team !== filters.team || employee.role !== "employee") {
          return;
        }

        employeeTotals.set(employee.name, (employeeTotals.get(employee.name) || 0) + 1);
      });

      return {
        title: `Completed Tasks by Employee (${toTeamLabel(filters.team)})`,
        labels: Array.from(employeeTotals.keys()),
        values: Array.from(employeeTotals.values()),
        chartValues: Array.from(employeeTotals.values()).map((value) => (value === 0 ? 0.05 : value)),
        colors: FALLBACK_DONUT_COLORS
      };
    }

    const teamTotals = new Map();

    filteredCompletedTasks.forEach((task) => {
      const employee = users.find((item) => Number(item.id) === Number(task.assigned_to));
      if (!employee || employee.role !== "employee") {
        return;
      }

      const teamName = employee.team || "Unknown";
      teamTotals.set(teamName, (teamTotals.get(teamName) || 0) + 1);
    });

    return {
      title: "Completed Tasks by Department",
      labels: Array.from(teamTotals.keys()).map((teamName) => toTeamLabel(teamName)),
      values: Array.from(teamTotals.values()),
      chartValues: Array.from(teamTotals.values()),
      colors: Array.from(teamTotals.keys()).map(
        (teamName, index) => TEAM_DONUT_COLORS[teamName] || FALLBACK_DONUT_COLORS[index % FALLBACK_DONUT_COLORS.length]
      )
    };
  }, [filters.date, filters.team, tasks, users]);

  const filteredTopPerformers = useMemo(() => {
    const performers = analytics.topPerformers || [];

    if (filters.team === "all") {
      return performers;
    }

    return performers.filter((item) => item.team === filters.team);
  }, [analytics.topPerformers, filters.team]);

  const statusComparisonChartData = useMemo(() => {
    const scopeTasks = tasks.filter((task) => {
      if (filters.date) {
        const statusValue = String(task.raw_status || task.status || "").toLowerCase();
        const taskDate =
          statusValue === "completed"
            ? (task.completed_at || task.created_at || "").slice(0, 10)
            : (task.created_at || "").slice(0, 10);

        if (taskDate !== filters.date) {
          return false;
        }
      }

      if (filters.team === "all") {
        return true;
      }

      const employee = users.find((entry) => Number(entry.id) === Number(task.assigned_to));
      return employee?.team === filters.team;
    });

    if (filters.team === "all") {
      const teamMap = new Map();

      users
        .filter((entry) => entry.role === "employee")
        .forEach((entry) => {
          const teamName = entry.team || "Unknown";
          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, { pending: 0, inProgress: 0, completed: 0 });
          }
        });

      scopeTasks.forEach((task) => {
        const employee = users.find((entry) => Number(entry.id) === Number(task.assigned_to));
        if (!employee || employee.role !== "employee") {
          return;
        }

        const teamName = employee.team || "Unknown";
        if (!teamMap.has(teamName)) {
          teamMap.set(teamName, { pending: 0, inProgress: 0, completed: 0 });
        }

        const totals = teamMap.get(teamName);
        const statusValue = String(task.raw_status || task.status || "").toLowerCase();

        if (statusValue === "completed") {
          totals.completed += 1;
        } else if (statusValue === "in progress") {
          totals.inProgress += 1;
        } else {
          totals.pending += 1;
        }
      });

      const labels = Array.from(teamMap.keys());
      const values = Array.from(teamMap.values());

      return {
        title: "Task Status Comparison by Department",
        labels: labels.map((label) => toTeamLabel(label)),
        xAxisTitle: "Department",
        yAxisTitle: "Task Count",
        datasets: [
          { label: "Pending Tasks", data: values.map((entry) => entry.pending), backgroundColor: "#94A3B8" },
          { label: "In Progress Tasks", data: values.map((entry) => entry.inProgress), backgroundColor: "#3A6FF7" },
          { label: "Completed Tasks", data: values.map((entry) => entry.completed), backgroundColor: "#2A7A46" }
        ]
      };
    }

    const employeeMap = new Map();

    users
      .filter((entry) => entry.role === "employee" && entry.team === filters.team)
      .forEach((entry) => {
        employeeMap.set(entry.name, { pending: 0, inProgress: 0, completed: 0 });
      });

    scopeTasks.forEach((task) => {
      const employee = users.find((entry) => Number(entry.id) === Number(task.assigned_to));
      if (!employee || employee.role !== "employee" || employee.team !== filters.team) {
        return;
      }

      if (!employeeMap.has(employee.name)) {
        employeeMap.set(employee.name, { pending: 0, inProgress: 0, completed: 0 });
      }

      const totals = employeeMap.get(employee.name);
      const statusValue = String(task.raw_status || task.status || "").toLowerCase();

      if (statusValue === "completed") {
        totals.completed += 1;
      } else if (statusValue === "in progress") {
        totals.inProgress += 1;
      } else {
        totals.pending += 1;
      }
    });

    const labels = Array.from(employeeMap.keys());
    const values = Array.from(employeeMap.values());

    return {
      title: `Task Status Comparison by Employee (${toTeamLabel(filters.team)})`,
      labels,
      xAxisTitle: "Employee",
      yAxisTitle: "Task Count",
      datasets: [
        { label: "Pending Tasks", data: values.map((entry) => entry.pending), backgroundColor: "#94A3B8" },
        { label: "In Progress Tasks", data: values.map((entry) => entry.inProgress), backgroundColor: "#3A6FF7" },
        { label: "Completed Tasks", data: values.map((entry) => entry.completed), backgroundColor: "#2A7A46" }
      ]
    };
  }, [tasks, users, filters.team, filters.date]);

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
    setFilters((prev) => ({ ...prev, status: "all", team: "all", employeeId: "all", date: "" }));
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
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Failed to change password");
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setNewUserMessage("");
    setNewUserError("");

    const payload = {
      name: String(newUserForm.name || "").trim(),
      email: String(newUserForm.email || "").trim(),
      password: String(newUserForm.password || ""),
      role: newUserForm.role,
      team:
        newUserForm.role === "superadmin" || newUserForm.role === "hr"
          ? null
          : String(newUserForm.team || "").trim()
    };

    if (!payload.name || !payload.email || !payload.password) {
      setNewUserError("Name, email and password are required");
      return;
    }

    if ((payload.role === "employee" || payload.role === "admin") && !payload.team) {
      setNewUserError("Department is required for employee/admin");
      return;
    }

    setCreatingUser(true);
    try {
      await authApi.register(payload);
      setNewUserMessage("Employee created successfully");
      setNewUserForm((prev) => ({
        ...prev,
        name: "",
        email: "",
        password: ""
      }));
      await loadData();
    } catch (error) {
      setNewUserError(error?.response?.data?.message || "Failed to create employee");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleManagedPasswordReset = async (targetUser) => {
    setManagedPasswordError("");
    setManagedPasswordToast("");

    const nextPassword = String(managedPasswordDrafts[targetUser.id] || "");
    if (!nextPassword) {
      setManagedPasswordError("Please enter a new password before updating");
      return;
    }

    if (nextPassword.length < 3) {
      setManagedPasswordError("New password must be at least 3 characters");
      return;
    }

    setManagedPasswordBusyId(targetUser.id);
    try {
      await authApi.resetManagedPassword({
        targetUserId: targetUser.id,
        newPassword: nextPassword
      });
      setManagedPasswordToast("Password saved");
      setManagedPasswordDrafts((prev) => ({
        ...prev,
        [targetUser.id]: ""
      }));
    } catch (error) {
      setManagedPasswordError(error?.response?.data?.message || "Failed to update password");
    } finally {
      setManagedPasswordBusyId(null);
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
              <p className="text-sm font-bold capitalize text-dsr-ink">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-dsr-muted">{user?.role}</p>
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
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Employees</p>
                <h3 className="text-3xl font-extrabold">{users.length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Tasks</p>
                <h3 className="text-3xl font-extrabold">{tasks.length}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Completed Tasks</p>
                <h3 className="text-3xl font-extrabold text-emerald-700">
                  {tasks.filter((item) => String(item.raw_status || item.status || "").toLowerCase() === "completed").length}
                </h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-dsr-muted">Completion Rate</p>
                <h3 className="text-3xl font-extrabold text-dsr-brand">{analytics.completionRate || 0}%</h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Overview" && (
          <section className="card">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Department</label>
                <select
                  className="input"
                  value={filters.team}
                  onChange={(event) => {
                    const team = event.target.value;
                    setFilters((prev) => ({ ...prev, team, employeeId: "all" }));
                    setUsersFilter((prev) => ({ ...prev, team }));
                  }}
                >
                  <option value="all">All Departments</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {toTeamLabel(team)}
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
            </div>
          </section>
        )}

        {activeTab === "Tasks" && (
          <section className="card">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Department</label>
                <select
                  className="input"
                  value={filters.team}
                  onChange={(event) => {
                    const team = event.target.value;
                    setFilters((prev) => ({ ...prev, team, employeeId: "all" }));
                    setUsersFilter((prev) => ({ ...prev, team }));
                  }}
                >
                  <option value="all">All Departments</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {toTeamLabel(team)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Employee</label>
                <select
                  className="input"
                  value={filters.employeeId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}
                >
                  <option value="all">All Employees</option>
                  {taskEmployeeOptions.map((employee) => (
                    <option key={employee.id} value={String(employee.id)}>
                      {employee.name}
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
            </div>
          </section>
        )}

        {activeTab === "Overview" && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Charts
                type="donut"
                title={completedTasksPieData.title}
                labels={completedTasksPieData.labels}
                values={completedTasksPieData.values}
                chartValues={completedTasksPieData.chartValues}
                color={completedTasksPieData.colors || FALLBACK_DONUT_COLORS}
              />
              <Charts
                type="bar"
                title={
                  filters.team === "all"
                    ? "Top Performers (Productivity Score)"
                    : `Top Performers (${toTeamLabel(filters.team)})`
                }
                labels={filteredTopPerformers.map((item) => item.name)}
                values={filteredTopPerformers.map((item) => Number(item.productivity_score || 0))}
                color="rgba(95, 157, 114, 0.85)"
              />
              {filters.team === "all" && (
                <Charts
                  type="bar"
                  title="Department Admin Performance (%)"
                  labels={adminPerformance.map((item) => item.name)}
                  values={adminPerformance.map((item) => Number(item.completion_rate || 0))}
                  color="rgba(31, 84, 50, 0.85)"
                />
              )}
              <Charts
                type="bar"
                title={statusComparisonChartData.title}
                labels={statusComparisonChartData.labels}
                datasets={statusComparisonChartData.datasets}
                xAxisTitle={statusComparisonChartData.xAxisTitle}
                yAxisTitle={statusComparisonChartData.yAxisTitle}
              />
            </div>
            <TaskTable
              tasks={filteredTasks}
              editableStatus={false}
              showAssignee
              focusedTaskId={focusedTaskId}
              setFocusedTaskId={setFocusedTaskId}
            />
          </>
        )}

        {activeTab === "Tasks" && (
          <TaskTable
            tasks={filteredTasks}
            editableStatus={false}
            showAssignee
            focusedTaskId={focusedTaskId}
            setFocusedTaskId={setFocusedTaskId}
          />
        )}

        {activeTab === "Employees" && (
          <section className="card overflow-x-auto">
            <form className="mb-4 grid gap-3 rounded-xl border border-dsr-border/70 bg-dsr-soft p-3 md:grid-cols-2 xl:grid-cols-6" onSubmit={handleCreateUser}>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Name</span>
                <input
                  className="input"
                  value={newUserForm.name}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Email</span>
                <input
                  className="input"
                  type="email"
                  value={newUserForm.email}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Password</span>
                <input
                  className="input"
                  type="password"
                  value={newUserForm.password}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Role</span>
                <select
                  className="input"
                  value={newUserForm.role}
                  onChange={(event) =>
                    setNewUserForm((prev) => {
                      const nextRole = event.target.value;
                      if (nextRole === "superadmin" || nextRole === "hr") {
                        return { ...prev, role: nextRole, team: "" };
                      }
                      return { ...prev, role: nextRole };
                    })
                  }
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="hr">HR</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Department</span>
                <input
                  className="input"
                  value={newUserForm.team}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, team: event.target.value }))}
                  disabled={newUserForm.role === "superadmin" || newUserForm.role === "hr"}
                  required={newUserForm.role === "employee" || newUserForm.role === "admin"}
                />
              </label>
              <button className="btn-primary self-end" type="submit" disabled={creatingUser}>
                {creatingUser ? "Creating..." : "Add Employee"}
              </button>

              {(newUserMessage || newUserError) && (
                <p className={`text-sm md:col-span-2 xl:col-span-6 ${newUserError ? "text-rose-600" : "text-emerald-700"}`}>
                  {newUserError || newUserMessage}
                </p>
              )}
            </form>

            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Search (Name / Email)</span>
                <input
                  className="input"
                  value={usersFilter.search}
                  onChange={(event) => setUsersFilter((prev) => ({ ...prev, search: event.target.value }))}
                />
              </label>
              <select
                className="input"
                value={usersFilter.team}
                onChange={(event) => setUsersFilter((prev) => ({ ...prev, team: event.target.value }))}
              >
                <option value="all">All Departments</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {toTeamLabel(team)}
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
                  <th className="p-3">Reset Password</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry) => {
                  const canResetPassword = entry.role === "employee" || entry.role === "admin";
                  return (
                    <tr key={entry.id} className="border-b border-dsr-border/70">
                      <td className="p-3 font-semibold">{entry.name}</td>
                      <td className="p-3">{entry.email}</td>
                      
                      <td className="p-3 uppercase">{entry.role}</td>
                      <td className="p-3">{toTeamLabel(entry.team) || "-"}</td>
                      <td className="p-3">
                        {canResetPassword ? (
                          <div className="flex min-w-[260px] items-center gap-2">
                            <input
                              type="password"
                              className="input"
                              placeholder="New password"
                              value={managedPasswordDrafts[entry.id] || ""}
                              onChange={(event) =>
                                setManagedPasswordDrafts((prev) => ({
                                  ...prev,
                                  [entry.id]: event.target.value
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="btn-primary whitespace-nowrap"
                              disabled={managedPasswordBusyId === entry.id}
                              onClick={() => handleManagedPasswordReset(entry)}
                            >
                              {managedPasswordBusyId === entry.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-dsr-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {managedPasswordError && (
                  <tr>
                    <td colSpan={5} className="p-3 text-sm text-rose-600">
                      {managedPasswordError}
                    </td>
                  </tr>
                )}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-dsr-muted">
                      No employees found for current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "Reports" && (
          <section className="space-y-4">
            <ReportPage
              role="superadmin"
              initialTeam={filters.team}
              initialDate={reportDate}
            />
          </section>
        )}

        {activeTab === "Notifications" && (
          <section className="card">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Task Status Notifications</h2>
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
                      <span className="rounded-full bg-white px-2 py-1 text-xs uppercase text-dsr-muted">
                        {item.type || "update"}
                      </span>
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
                <p><span className="font-semibold">Department:</span> {user?.team || "-"}</p>
              </div>
            </div>

            <form className="card" onSubmit={handlePasswordChange}>
              <h2 className="mb-4 text-2xl font-bold">Settings - Change Password</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Current Password</label>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">New Password</label>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Confirm Password</label>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    required
                  />
                </div>

                {passwordError && <p className="md:col-span-2 text-sm text-rose-600">{passwordError}</p>}
                {passwordMessage && <p className="md:col-span-2 text-sm text-emerald-700">{passwordMessage}</p>}

                <button className="btn-primary md:col-span-2 w-fit" type="submit">
                  Update Password
                </button>
              </div>
            </form>
          </section>
        )}

        {busy && <p className="text-sm text-dsr-muted">Refreshing dashboard data...</p>}
      </main>
      {managedPasswordToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-dsr-border bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          {managedPasswordToast}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
