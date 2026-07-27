import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateTaskModal from "../components/CreateTaskModal";
import ProfileMenu from "../components/ProfileMenu";
import ProfileSection from "../components/ProfileSection";
import TaskTable from "../components/TaskTable";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";
import useDocumentVisibility from "../hooks/useDocumentVisibility";
import usePolling from "../hooks/usePolling";
import useScrollHeader from "../hooks/useScrollHeader";
import { authApi, reportApi, taskApi } from "../services/api";
import { formatBackendDate } from "../utils/dateTime";
import { collapseTaskLineages } from "../utils/taskLineage";
import { getTaskDateText, getTodayText, TASK_DEPARTMENTS } from "../utils/taskMeta";
import { toTeamLabel } from "../utils/teamLabel";

const TABS = ["Overview", "Tasks", "Employees", "Reports"];
const ReportPage = lazy(() => import("./ReportPage"));
const DASHBOARD_POLL_INTERVAL = 45000;

const getTabLabel = (tab) => (tab === "Employees" ? "Team" : tab);

const defaultAnalytics = { tasksPerTeam: [], completionRate: 0, topPerformers: [] };

const isReportableSuperadmin = (entry) => {
  const name = String(entry?.name || "").trim().toLowerCase();
  const email = String(entry?.email || "").trim().toLowerCase();
  const team = String(entry?.team || "").trim().toLowerCase();
  return (
    entry?.role === "superadmin" &&
    (name === "hr" ||
      email === "hr@cludobits.com" ||
      team === "human resource" ||
      team === "human resources")
  );
};

const isReportableTaskUser = (entry) =>
  ["employee", "admin", "hr"].includes(entry?.role) || isReportableSuperadmin(entry);

const getUserDisplayName = (entry) =>
  String(entry?.full_name || entry?.fullName || [entry?.name, entry?.last_name || entry?.lastName].filter(Boolean).join(" ") || entry?.name || "").trim();

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
  const isDocumentVisible = useDocumentVisibility();
  const todayText = getTodayText();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [adminPerformance, setAdminPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ status: "all", team: "all", employeeId: "all", date: todayText });
  const [usersFilter, setUsersFilter] = useState({ team: "all", role: "all", search: "" });
  const [reportDate, setReportDate] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    lastName: "",
    email: "",
    password: "",
    role: "employee",
    team: ""
  });
  const [newUserMessage, setNewUserMessage] = useState("");
  const [newUserError, setNewUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [ownTaskForm, setOwnTaskForm] = useState({
    client: "",
    task: "",
    action: "",
    dependency: "",
    deadline: "",
    priority: "Medium",
    taskDepartment: "",
    taskDate: todayText
  });
  const [ownTaskFilters, setOwnTaskFilters] = useState({ status: "all", date: todayText });
  const [ownTaskError, setOwnTaskError] = useState("");
  const [ownSubmitMessage, setOwnSubmitMessage] = useState("");
  const [submittingOwnReport, setSubmittingOwnReport] = useState(false);
  const [isOwnSubmitConfirmOpen, setIsOwnSubmitConfirmOpen] = useState(false);
  const [managedUserBusyId, setManagedUserBusyId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    lastName: "",
    email: "",
    role: "employee",
    team: "",
    password: ""
  });
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [managedPasswordError, setManagedPasswordError] = useState("");
  const [managedPasswordToast, setManagedPasswordToast] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const canUseOwnTaskFlow = isReportableSuperadmin(user);
  const visibleTabs = useMemo(
    () => (canUseOwnTaskFlow ? ["Overview", "Tasks", "My Tasks", "Employees", "Reports"] : TABS),
    [canUseOwnTaskFlow]
  );

  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const [usersRes, tasksRes, reportsRes, adminPerfRes, notificationRes] = await Promise.all([
        authApi.getEmployees(),
        taskApi.getTasks(),
        reportApi.getReports(),
        taskApi.getAdminPerformance(),
        taskApi.getNotifications()
      ]);

      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      setAdminPerformance(Array.isArray(adminPerfRes.data) ? adminPerfRes.data : []);
      setNotifications(Array.isArray(notificationRes.data) ? notificationRes.data : []);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    const analyticsRes = await reportApi.getAnalytics({
      team: filters.team,
      date: filters.date || undefined
    });
    setAnalytics(analyticsRes.data || defaultAnalytics);
  }, [filters.date, filters.team]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  usePolling(
    async () => {
      await loadData();
      if (activeTab === "Overview") {
        await loadAnalytics();
      }
    },
    DASHBOARD_POLL_INTERVAL,
    isDocumentVisible && activeTab !== "Reports" && activeTab !== "Profile"
  );

  useEffect(() => {
    void loadAnalytics();
  }, [filters.team, filters.date]);

  const visibleTasks = useMemo(() => collapseTaskLineages(tasks), [tasks]);

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
    if (canUseOwnTaskFlow || activeTab !== "My Tasks") {
      return;
    }

    setActiveTab("Overview");
  }, [activeTab, canUseOwnTaskFlow]);

  useEffect(() => {
    if (!managedPasswordToast) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setManagedPasswordToast("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [managedPasswordToast]);

  const resolveTaskDepartment = (task) => {
    const explicitDepartment = String(task?.task_department || "").trim();
    if (explicitDepartment) {
      return explicitDepartment;
    }

    const assigneeTeam = users.find((entry) => Number(entry.id) === Number(task?.assigned_to))?.team;
    return String(assigneeTeam || "").trim();
  };

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((item) => {
      const statusMatch = filters.status === "all" || item.status === filters.status;
      const taskDepartment = resolveTaskDepartment(item);
      const teamMatch = filters.team === "all" || taskDepartment === filters.team;
      const employeeMatch =
        filters.employeeId === "all" || String(item.assigned_to) === String(filters.employeeId);
      const dateMatch = !filters.date || getTaskDateText(item) === filters.date;
      return statusMatch && teamMatch && employeeMatch && dateMatch;
    });
  }, [visibleTasks, filters, users]);

  const taskEmployeeOptions = useMemo(() => {
    const scopedUsers = users.filter((entry) => {
      if (!isReportableTaskUser(entry)) {
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

  const allDepartmentOptions = useMemo(() => {
    const optionSet = new Set([
      ...TASK_DEPARTMENTS,
      ...users.map((entry) => entry.team).filter(Boolean)
    ]);

    return Array.from(optionSet).sort((left, right) => toTeamLabel(left).localeCompare(toTeamLabel(right)));
  }, [users]);

  const taskDepartmentSelectOptions = useMemo(
    () => TASK_DEPARTMENTS.map((department) => ({ value: department, label: toTeamLabel(department) })),
    []
  );

  const ownTasks = useMemo(
    () => visibleTasks.filter((item) => Number(item.assigned_to) === Number(user?.id)),
    [user?.id, visibleTasks]
  );

  const filteredOwnTasks = useMemo(() => {
    return ownTasks.filter((item) => {
      const statusMatch = ownTaskFilters.status === "all" || item.status === ownTaskFilters.status;
      const dateMatch = !ownTaskFilters.date || getTaskDateText(item) === ownTaskFilters.date;
      return statusMatch && dateMatch;
    });
  }, [ownTaskFilters, ownTasks]);

  const alreadySubmittedOwnReport = useMemo(() => {
    if (!ownTaskFilters.date) {
      return false;
    }

    return reports.some(
      (entry) =>
        String(entry.date).slice(0, 10) === ownTaskFilters.date &&
        Number(entry.employee_id) === Number(user?.id) &&
        entry.received_status === "Received"
    );
  }, [ownTaskFilters.date, reports, user?.id]);

  const filteredUsers = useMemo(() => {
    return users.filter((entry) => {
      const roleMatch = usersFilter.role === "all" || entry.role === usersFilter.role;
      const effectiveTeamFilter = usersFilter.team !== "all" ? usersFilter.team : filters.team;
      const teamMatch = effectiveTeamFilter === "all" || entry.team === effectiveTeamFilter;
      const searchMatch =
        !usersFilter.search ||
        getUserDisplayName(entry).toLowerCase().includes(usersFilter.search.toLowerCase()) ||
        entry.email.toLowerCase().includes(usersFilter.search.toLowerCase());
      return roleMatch && teamMatch && searchMatch;
    });
  }, [users, usersFilter, filters.team]);

  const profileDepartmentLabel = useMemo(() => {
    const normalizedTeam = String(user?.team || "").trim().toLowerCase();

    if (["hr", "human resource", "human resources"].includes(normalizedTeam)) {
      return "Human Resources";
    }

    return "Company Wide Access";
  }, [user?.team]);

  const profileMenuLabel = useMemo(() => {
    const normalizedName = String(user?.name || "").trim().toLowerCase();
    const normalizedEmail = String(user?.email || "").trim().toLowerCase();

    if (normalizedName === "vijay" || normalizedEmail === "vijay@cludobits.com") {
      return "CEO";
    }

    if (isReportableSuperadmin(user)) {
      return "HR";
    }

    return profileDepartmentLabel;
  }, [profileDepartmentLabel, user?.email, user?.name]);

  const overviewScopedUsers = useMemo(() => {
    return users.filter((entry) => {
      if (!isReportableTaskUser(entry)) {
        return false;
      }

      if (filters.team === "all") {
        return true;
      }

      return entry.team === filters.team;
    });
  }, [filters.team, users]);

  const dailyOverviewTasks = useMemo(() => {
    return visibleTasks.filter((item) => {
      const taskDepartment = resolveTaskDepartment(item);
      const teamMatch = filters.team === "all" || taskDepartment === filters.team;
      const taskDate = getTaskDateText(item);
      const dateMatch = !filters.date || taskDate === filters.date;
      return teamMatch && dateMatch;
    });
  }, [filters.date, filters.team, visibleTasks, users]);

  const dailyOverviewCompletedTasks = useMemo(
    () =>
      dailyOverviewTasks.filter(
        (item) => String(item.raw_status || item.status || "").toLowerCase() === "completed"
      ).length,
    [dailyOverviewTasks]
  );

  const dailyOverviewCompletionRate = useMemo(() => {
    if (!dailyOverviewTasks.length) {
      return 0;
    }

    return Number(((dailyOverviewCompletedTasks / dailyOverviewTasks.length) * 100).toFixed(2));
  }, [dailyOverviewCompletedTasks, dailyOverviewTasks.length]);

  const unreadCount = useMemo(
    () => notifications.filter((entry) => !entry.is_read).length,
    [notifications]
  );

  const completedTasksPieData = useMemo(() => {
    const filteredCompletedTasks = visibleTasks.filter((item) => {
      const statusValue = String(item.raw_status || item.status || "").toLowerCase();
      if (statusValue !== "completed") {
        return false;
      }

      if (!filters.date) {
        return true;
      }

      const completedDate = (item.completed_at || getTaskDateText(item) || item.created_at || "").slice(0, 10);
      return completedDate === filters.date;
    });

    if (filters.team && filters.team !== "all") {
      const employeeTotals = new Map();

      users
        .filter((item) => isReportableTaskUser(item) && item.team === filters.team)
        .forEach((item) => {
          employeeTotals.set(item.name, 0);
        });

      filteredCompletedTasks.forEach((task) => {
        const employee = users.find((item) => Number(item.id) === Number(task.assigned_to));
        const taskDepartment = resolveTaskDepartment(task);
        if (!employee || taskDepartment !== filters.team || !isReportableTaskUser(employee)) {
          return;
        }

        employeeTotals.set(employee.name, (employeeTotals.get(employee.name) || 0) + 1);
      });

      return {
        title: `Completed Tasks by Team Members (${toTeamLabel(filters.team)})`,
        labels: Array.from(employeeTotals.keys()),
        values: Array.from(employeeTotals.values()),
        chartValues: Array.from(employeeTotals.values()),
        colors: FALLBACK_DONUT_COLORS
      };
    }

    const teamTotals = new Map();

    filteredCompletedTasks.forEach((task) => {
      const employee = users.find((item) => Number(item.id) === Number(task.assigned_to));
      if (!employee || !isReportableTaskUser(employee)) {
        return;
      }

      const teamName = resolveTaskDepartment(task) || "Unknown";
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
  }, [filters.date, filters.team, visibleTasks, users]);

  const filteredTopPerformers = useMemo(() => {
    const performerMap = new Map();

    users
      .filter((item) => isReportableTaskUser(item) && (filters.team === "all" || item.team === filters.team))
      .forEach((item) => {
        performerMap.set(Number(item.id), {
          id: item.id,
          name: item.name,
          team: item.team,
          completed_tasks: 0,
          total_tasks: 0,
          productivity_score: 0
        });
      });

    visibleTasks.forEach((task) => {
      const assigneeId = Number(task.assigned_to);
      const performer = performerMap.get(assigneeId);
      if (!performer) {
        return;
      }

      performer.total_tasks += 1;

      if (String(task.raw_status || task.status || "").toLowerCase() === "completed") {
        performer.completed_tasks += 1;
      }
    });

    return Array.from(performerMap.values())
      .map((item) => ({
        ...item,
        productivity_score:
          item.total_tasks > 0 ? Number(((item.completed_tasks / item.total_tasks) * 100).toFixed(2)) : 0
      }))
      .sort((left, right) => {
        if (right.productivity_score !== left.productivity_score) {
          return right.productivity_score - left.productivity_score;
        }

        if (right.completed_tasks !== left.completed_tasks) {
          return right.completed_tasks - left.completed_tasks;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 10);
  }, [filters.team, visibleTasks, users]);

  const statusComparisonChartData = useMemo(() => {
    const scopeTasks = visibleTasks.filter((task) => {
      if (filters.date) {
        const statusValue = String(task.raw_status || task.status || "").toLowerCase();
      const taskDate =
          statusValue === "completed"
            ? (task.completed_at || getTaskDateText(task) || task.created_at || "").slice(0, 10)
            : getTaskDateText(task);

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
        .filter((entry) => isReportableTaskUser(entry))
        .forEach((entry) => {
          const teamName = entry.team || "Unknown";
          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, { pending: 0, inProgress: 0, completed: 0 });
          }
        });

      scopeTasks.forEach((task) => {
        const employee = users.find((entry) => Number(entry.id) === Number(task.assigned_to));
        if (!employee || !isReportableTaskUser(employee)) {
          return;
        }

        const teamName = resolveTaskDepartment(task) || "Unknown";
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
          { label: "Pending Tasks", data: values.map((entry) => entry.pending), backgroundColor: "#f1dc21" },
          { label: "In Progress Tasks", data: values.map((entry) => entry.inProgress), backgroundColor: "#33a8d6" },
          { label: "Completed Tasks", data: values.map((entry) => entry.completed), backgroundColor: "#51bb2a" }
        ]
      };
    }

    const employeeMap = new Map();

    users
      .filter((entry) => isReportableTaskUser(entry) && entry.team === filters.team)
      .forEach((entry) => {
        employeeMap.set(entry.name, { pending: 0, inProgress: 0, completed: 0 });
      });

    scopeTasks.forEach((task) => {
      const employee = users.find((entry) => Number(entry.id) === Number(task.assigned_to));
      const taskDepartment = resolveTaskDepartment(task);
      if (!employee || !isReportableTaskUser(employee) || taskDepartment !== filters.team) {
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
  }, [visibleTasks, users, filters.team, filters.date]);

  const handleMarkRead = async (id) => {
    await taskApi.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((item) => (Number(item.id) === Number(id) ? { ...item, is_read: 1 } : item))
    );
  };

  const handleMarkAllRead = async () => {
    await taskApi.markAllNotificationsRead();
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
  };

  const handleOpenTaskFromNotification = async (notification) => {
    if (!notification?.reference_id) {
      return;
    }

    if (!notification.type?.startsWith("task_")) {
      return;
    }

    await taskApi.markNotificationRead(notification.id);
    setNotifications((prev) =>
      prev.map((item) => (Number(item.id) === Number(notification.id) ? { ...item, is_read: 1 } : item))
    );
    setActiveTab("Tasks");
    setFilters((prev) => ({ ...prev, status: "all", team: "all", employeeId: "all", date: todayText }));
    setFocusedTaskId(Number(notification.reference_id));
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

  const handleCreateOwnTask = async (event) => {
    event.preventDefault();
    setOwnTaskError("");

    const selectedTaskDepartment = String(ownTaskForm.taskDepartment || "").trim();
    if (!selectedTaskDepartment) {
      setOwnTaskError("Select task department");
      return;
    }

    try {
      await taskApi.createTask({
        ...ownTaskForm,
        taskDepartment: selectedTaskDepartment,
        taskDate: ownTaskForm.taskDate,
        assignedTo: user.id,
        type: "self"
      });

      setOwnTaskForm({
        client: "",
        task: "",
        action: "",
        dependency: "",
        deadline: "",
        priority: "Medium",
        taskDepartment: "",
        taskDate: todayText
      });
      setIsCreateTaskModalOpen(false);
      await loadData();
      setActiveTab("My Tasks");
    } catch (apiError) {
      setOwnTaskError(apiError.response?.data?.message || "Failed to create task");
    }
  };

  const handleOwnStatusChange = async (
    task,
    status,
    dependency = task.dependency,
    action = task.action,
    taskTitle = task.task,
    client = task.client
  ) => {
    setOwnTaskError("");

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
    } catch (apiError) {
      setOwnTaskError(apiError.response?.data?.message || "Failed to update task");
      throw apiError;
    }
  };

  const handleOwnPriorityChange = async (task, priority) => {
    setOwnTaskError("");

    try {
      await taskApi.updateTaskPriority(task.id, { priority });
      setTasks((prev) =>
        prev.map((entry) => (entry.id === task.id ? { ...entry, priority } : entry))
      );
    } catch (apiError) {
      setOwnTaskError(apiError.response?.data?.message || "Failed to update priority");
    }
  };

  const handleOwnDeleteTask = async (task) => {
    setOwnTaskError("");

    try {
      const response = await taskApi.deleteTask(task.id);
      const deletedIds = Array.isArray(response.data?.deletedIds)
        ? response.data.deletedIds.map((entry) => Number(entry))
        : [Number(task.id)];
      setTasks((prev) => prev.filter((entry) => !deletedIds.includes(Number(entry.id))));
      setFocusedTaskId((current) => (Number(current) === Number(task.id) ? null : current));
    } catch (apiError) {
      setOwnTaskError(apiError.response?.data?.message || "Failed to delete task");
      throw apiError;
    }
  };

  const handleConfirmSubmitOwnReport = async () => {
    setIsOwnSubmitConfirmOpen(false);
    setSubmittingOwnReport(true);
    setOwnSubmitMessage("");

    try {
      const response = await reportApi.submitReportToHr(ownTaskFilters.date);
      setOwnSubmitMessage(response.data?.message || "Self-task report submitted to HR.");
      setReports((prev) => {
        const nextEntry = {
          employee_id: user?.id,
          date: ownTaskFilters.date,
          received_status: "Received"
        };
        const existingIndex = prev.findIndex(
          (entry) =>
            String(entry.date).slice(0, 10) === ownTaskFilters.date &&
            Number(entry.employee_id) === Number(user?.id)
        );

        if (existingIndex === -1) {
          return [nextEntry, ...prev];
        }

        return prev.map((entry, index) =>
          index === existingIndex ? { ...entry, ...nextEntry } : entry
        );
      });
    } catch (apiError) {
      setOwnSubmitMessage(apiError.response?.data?.message || "Failed to submit self-task report to HR");
    } finally {
      setSubmittingOwnReport(false);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setNewUserMessage("");
    setNewUserError("");

    const payload = {
      name: String(newUserForm.name || "").trim(),
      lastName: String(newUserForm.lastName || "").trim(),
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
      const response = await authApi.register(payload);
      setNewUserMessage(response?.data?.message || "Employee created successfully");
      setNewUserForm((prev) => ({
        ...prev,
        name: "",
        lastName: "",
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

  const openEditUserModal = (targetUser) => {
    setManagedPasswordError("");
    setManagedPasswordToast("");
    setEditingUser(targetUser);
    setEditUserForm({
      name: targetUser.name || "",
      lastName: targetUser.lastName || targetUser.last_name || "",
      email: targetUser.email || "",
      role: targetUser.role || "employee",
      team: targetUser.team || "",
      password: ""
    });
  };

  const closeEditUserModal = () => {
    if (managedUserBusyId) {
      return;
    }

    setEditingUser(null);
    setEditUserForm({
      name: "",
      lastName: "",
      email: "",
      role: "employee",
      team: "",
      password: ""
    });
  };

  const handleEditUserFormChange = (field, value) => {
    setEditUserForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdateManagedUser = async (event) => {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    setManagedPasswordError("");
    setManagedPasswordToast("");

    const payload = {
      name: String(editUserForm.name || "").trim(),
      lastName: String(editUserForm.lastName || "").trim(),
      email: String(editUserForm.email || "").trim(),
      role: String(editUserForm.role || "").trim(),
      team: String(editUserForm.team || "").trim()
    };
    const nextPassword = String(editUserForm.password || "");

    if (!payload.name || !payload.email || !payload.role) {
      setManagedPasswordError("Name, email and role are required");
      return;
    }

    if ((payload.role === "employee" || payload.role === "admin") && !payload.team) {
      setManagedPasswordError("Department is required for employee/admin");
      return;
    }

    if (nextPassword && nextPassword.length < 3) {
      setManagedPasswordError("New password must be at least 3 characters");
      return;
    }

    setManagedUserBusyId(editingUser.id);
    try {
      const response = await authApi.updateUser(editingUser.id, {
        ...payload,
        team: payload.team || null
      });

      if (nextPassword) {
        await authApi.resetManagedPassword({
          targetUserId: editingUser.id,
          newPassword: nextPassword
        });
      }

      const updatedUser = response?.data?.user || { ...editingUser, ...payload };
      setUsers((prev) =>
        prev.map((entry) =>
          Number(entry.id) === Number(editingUser.id)
            ? { ...entry, ...updatedUser }
            : entry
        )
      );
      setManagedPasswordToast(nextPassword ? "Employee details and password updated" : response?.data?.message || "Employee details updated");
      setEditingUser(null);
    } catch (error) {
      setManagedPasswordError(error?.response?.data?.message || "Failed to update employee details");
    } finally {
      setManagedUserBusyId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    setManagedPasswordError("");
    setManagedPasswordToast("");

    const confirmed = window.confirm(
      `Delete ${targetUser.name}? Their historical tasks and reports will stay in the database.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(targetUser.id);
    try {
      const response = await authApi.deleteUser(targetUser.id);
      setManagedPasswordToast(response?.data?.message || "Employee deleted. Historical data is preserved.");
      setManagedPasswordDrafts((prev) => {
        const nextDrafts = { ...prev };
        delete nextDrafts[targetUser.id];
        return nextDrafts;
      });
      await loadData();
    } catch (error) {
      setManagedPasswordError(error?.response?.data?.message || "Failed to delete employee");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-dsr-page text-dsr-ink">
      <CreateTaskModal
        open={canUseOwnTaskFlow && isCreateTaskModalOpen}
        title="Create My Task"
        form={ownTaskForm}
        onFieldChange={(field, value) => setOwnTaskForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleCreateOwnTask}
        onClose={() => setIsCreateTaskModalOpen(false)}
        error={ownTaskError}
        locked={false}
        lockedMessage=""
        submitLabel="Add Task"
        todayText={todayText}
        departmentOptions={taskDepartmentSelectOptions}
      />
      <ConfirmDialog
        open={canUseOwnTaskFlow && isOwnSubmitConfirmOpen}
        title="Submit Self-Task Report"
        message={`Do you want to ${alreadySubmittedOwnReport ? "resubmit" : "submit"} your self-task report for ${ownTaskFilters.date}?`}
        confirmText={alreadySubmittedOwnReport ? "Resubmit" : "Submit"}
        cancelText="Cancel"
        loading={submittingOwnReport}
        onCancel={() => setIsOwnSubmitConfirmOpen(false)}
        onConfirm={() => void handleConfirmSubmitOwnReport()}
      />
      {editingUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,246,0.96))] p-4 shadow-[0_28px_60px_rgba(31,42,34,0.16)]">
            <div className="flex items-start justify-between gap-4 rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,#f7fbf8,#eef5f0)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div>
                <h2 className="text-xl font-bold text-dsr-ink">Edit Employee</h2>
                <p className="mt-1 text-sm text-dsr-muted">Update profile fields and set a new password when needed.</p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dsr-border bg-white text-slate-500 transition hover:text-slate-700"
                onClick={closeEditUserModal}
                aria-label="Close edit employee modal"
              >
                <span className="text-xl leading-none">x</span>
              </button>
            </div>

            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleUpdateManagedUser}>
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">First Name / Username</span>
                <input
                  className="input"
                  value={editUserForm.name}
                  onChange={(event) => handleEditUserFormChange("name", event.target.value)}
                  required
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">Last Name</span>
                <input
                  className="input"
                  value={editUserForm.lastName}
                  onChange={(event) => handleEditUserFormChange("lastName", event.target.value)}
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">Email</span>
                <input
                  className="input"
                  type="email"
                  value={editUserForm.email}
                  onChange={(event) => handleEditUserFormChange("email", event.target.value)}
                  required
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">Role</span>
                <select
                  className="input"
                  value={editUserForm.role}
                  onChange={(event) => handleEditUserFormChange("role", event.target.value)}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="hr">HR</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-900">Department</span>
                <select
                  className="input"
                  value={editUserForm.team}
                  onChange={(event) => handleEditUserFormChange("team", event.target.value)}
                  required={editUserForm.role === "employee" || editUserForm.role === "admin"}
                >
                  <option value="">No Department</option>
                  {allDepartmentOptions.map((team) => (
                    <option key={team} value={team}>
                      {toTeamLabel(team)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-900">New Password</span>
                <input
                  className="input"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editUserForm.password}
                  onChange={(event) => handleEditUserFormChange("password", event.target.value)}
                />
              </label>

              {managedPasswordError ? (
                <p className="md:col-span-2 text-sm text-rose-600">{managedPasswordError}</p>
              ) : null}

              <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={closeEditUserModal}>
                  Cancel
                </button>
                <button className="btn-primary min-w-[150px]" type="submit" disabled={managedUserBusyId === editingUser.id}>
                  {managedUserBusyId === editingUser.id ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <header
        className={`sticky top-0 z-30 border-b border-dsr-border bg-[#f3f3f3] transition-transform duration-300 ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-4 lg:px-8">
          <BrandMark />

          <nav className="hidden items-center gap-2 rounded-full border border-dsr-border bg-dsr-soft px-3 py-2 lg:flex">
            {visibleTabs.map((tab) => (
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
              label={profileMenuLabel}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        <div className="grid gap-3 lg:hidden">
          <select
            className="input"
            value={visibleTabs.includes(activeTab) || activeTab === "Profile" ? activeTab : "Overview"}
            onChange={(event) => setActiveTab(event.target.value)}
          >
            {visibleTabs.map((tab) => (
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
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Employees</p>
                <h3 className="text-3xl font-extrabold">{overviewScopedUsers.length}</h3>
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
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900">Completion Rate</p>
                <h3 className="text-3xl font-extrabold text-dsr-brand">{dailyOverviewCompletionRate}%</h3>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Overview" && (
          <section className="card shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Department</label>
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Task Date</label>
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Status</label>
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Department</label>
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Employee</label>
                <select
                  className="input"
                  value={filters.employeeId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, employeeId: event.target.value }))}
                >
                  <option value="all">All Team Members</option>
                  {taskEmployeeOptions.map((employee) => (
                    <option key={employee.id} value={String(employee.id)}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Task Date</label>
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
                yAxisTitle="Productivity Score"
                yTickStep={5}
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

        {canUseOwnTaskFlow && activeTab === "My Tasks" && (
          <div className="space-y-4">
            <section className="card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-dsr-ink">My Tasks</h2>
                  <p className="text-sm text-dsr-muted">Create and submit only your own self-assigned tasks.</p>
                </div>
                <button type="button" className="btn-primary" onClick={() => setIsCreateTaskModalOpen(true)}>
                  Create Task
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Status</span>
                  <select
                    className="input"
                    value={ownTaskFilters.status}
                    onChange={(event) => setOwnTaskFilters((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="all">All</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Task Date</span>
                  <input
                    className="input"
                    type="date"
                    value={ownTaskFilters.date}
                    onChange={(event) => setOwnTaskFilters((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold">My Task List</h2>
              <TaskTable
                tasks={filteredOwnTasks}
                onStatusChange={handleOwnStatusChange}
                onPriorityChange={handleOwnPriorityChange}
                onDeleteTask={handleOwnDeleteTask}
                canDeleteTask={(task) => Number(task.assigned_by) === Number(user?.id)}
                editableStatus
                showAssigner
                focusedTaskId={focusedTaskId}
                setFocusedTaskId={setFocusedTaskId}
              />
              {ownTasks.length > 0 && filteredOwnTasks.length === 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No tasks in the current filters.
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dsr-border bg-dsr-soft p-3">
                <p className="text-sm text-dsr-muted">
                  Submit report for: <span className="font-semibold text-dsr-ink">{ownTaskFilters.date || "Select a date"}</span>
                </p>
                <button
                  type="button"
                  className={alreadySubmittedOwnReport ? "rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white" : "btn-primary"}
                  disabled={!ownTaskFilters.date || submittingOwnReport}
                  onClick={() => setIsOwnSubmitConfirmOpen(true)}
                >
                  {submittingOwnReport
                    ? alreadySubmittedOwnReport
                      ? "Resubmitting..."
                      : "Submitting..."
                    : alreadySubmittedOwnReport
                      ? "Resubmit Report"
                      : "Submit Report"}
                </button>
              </div>
              {ownTaskError && <p className="mt-2 text-sm text-rose-600">{ownTaskError}</p>}
              {ownSubmitMessage && <p className="mt-2 text-sm text-dsr-brand">{ownSubmitMessage}</p>}
            </section>
          </div>
        )}

        {activeTab === "Employees" && (
          <section className="card overflow-x-auto">
            <form className="mb-4 grid gap-3 rounded-xl border border-dsr-border/70 bg-dsr-soft p-3 md:grid-cols-2 xl:grid-cols-7" onSubmit={handleCreateUser}>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">First Name / Username</span>
                <input
                  className="input"
                  value={newUserForm.name}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Last Name</span>
                <input
                  className="input"
                  value={newUserForm.lastName}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Email</span>
                <input
                  className="input"
                  type="email"
                  value={newUserForm.email}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Password</span>
                <input
                  className="input"
                  type="password"
                  value={newUserForm.password}
                  onChange={(event) => setNewUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Role</span>
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
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Department</span>
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
                <p className={`text-sm md:col-span-2 xl:col-span-7 ${newUserError ? "text-rose-600" : "text-emerald-700"}`}>
                  {newUserError || newUserMessage}
                </p>
              )}
            </form>

            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Search (Name / Email)</span>
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

            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[33%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-dsr-soft text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry) => {
                  const canDeleteUser = Number(entry.id) !== Number(user?.id);
                  return (
                    <tr key={entry.id} className="border-b border-dsr-border/70">
                      <td className="truncate p-3 font-semibold" title={getUserDisplayName(entry)}>{getUserDisplayName(entry)}</td>
                      <td className="truncate p-3" title={entry.email}>{entry.email}</td>
                      <td className="p-3 uppercase">{entry.role}</td>
                      <td className="truncate p-3" title={toTeamLabel(entry.team) || "-"}>{toTeamLabel(entry.team) || "-"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="btn-primary whitespace-nowrap"
                            disabled={managedUserBusyId === entry.id || deletingUserId === entry.id}
                            onClick={() => openEditUserModal(entry)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!canDeleteUser || managedUserBusyId === entry.id || deletingUserId === entry.id}
                            onClick={() => handleDeleteUser(entry)}
                          >
                            {canDeleteUser ? (deletingUserId === entry.id ? "Deleting..." : "Delete") : "Current User"}
                          </button>
                        </div>
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
            <Suspense fallback={<div className="card text-sm text-dsr-muted">Loading reports...</div>}>
              <ReportPage
                role="superadmin"
                initialTeam={filters.team}
                initialDate={reportDate}
              />
            </Suspense>
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
                      {item.type !== "task_status_updated" ? (
                        <span className="rounded-full bg-white px-2 py-1 text-xs uppercase text-dsr-muted">
                          {item.type || "update"}
                        </span>
                      ) : null}
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
                  <p className="mt-1 text-xs text-dsr-muted">{formatBackendDate(item.created_at)}</p>
                </div>
              ))}
              {notifications.length === 0 && <p className="text-sm text-dsr-muted">No notifications yet</p>}
            </div>
          </section>
        )}

        {activeTab === "Profile" && (
          <ProfileSection
            user={user}
            departmentLabel={profileDepartmentLabel}
            showDepartment={false}
            passwordForm={passwordForm}
            onPasswordFormChange={(field, value) => setPasswordForm((prev) => ({ ...prev, [field]: value }))}
            onSubmit={handlePasswordChange}
            passwordError={passwordError}
            passwordMessage={passwordMessage}
          />
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
