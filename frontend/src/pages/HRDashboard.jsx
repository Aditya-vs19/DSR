import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Charts from "../components/Charts";
import Navbar from "../components/Navbar";
import ProfileSection from "../components/ProfileSection";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import useDocumentVisibility from "../hooks/useDocumentVisibility";
import usePolling from "../hooks/usePolling";
import { authApi, reportApi, taskApi } from "../services/api";
const DASHBOARD_POLL_INTERVAL = 45000;
const defaultAnalytics = { tasksPerTeam: [], completionRate: 0, topPerformers: [] };

const TEAM_DONUT_COLORS = {
  Operations: "#E67E22",
  Technical: "#3A6FF7",
  Sales: "#8B5CF6",
  Finance: "#E57399",
  Logistics: "#F4C542",
  "Human Resources": "#0F766E"
};

const FALLBACK_DONUT_COLORS = ["#2A7A46", "#5F9D72", "#1F5432", "#398859", "#7AAE89", "#166534"];

const HRDashboard = () => {
  const { user } = useAuth();
  const isDocumentVisible = useDocumentVisibility();
  const todayText = new Date().toISOString().slice(0, 10);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [adminPerformance, setAdminPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedReportDetails, setSelectedReportDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    team: "all",
    day: todayText,
    status: "all",
    received: "all",
    search: ""
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const profileSectionRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, analyticsRes, adminPerfRes, notificationRes] = await Promise.all([
        reportApi.getReports(),
        reportApi.getAnalytics({
          team: filters.team,
          date: filters.day || undefined
        }),
        taskApi.getAdminPerformance(filters.team === "all" ? undefined : filters.team),
        taskApi.getNotifications()
      ]);
      setReports(reportsRes.data || []);
      setAnalytics(analyticsRes.data || defaultAnalytics);
      setAdminPerformance(Array.isArray(adminPerfRes.data) ? adminPerfRes.data : []);
      setNotifications(notificationRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters.day, filters.team]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  usePolling(loadData, DASHBOARD_POLL_INTERVAL, isDocumentVisible);

  const teams = useMemo(
    () => [...new Set(reports.map((report) => report.employee_team).filter(Boolean))],
    [reports]
  );

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const teamMatch = filters.team === "all" || report.employee_team === filters.team;
      const dayMatch = !filters.day || String(report.date).slice(0, 10) === filters.day;
      const statusMatch = filters.status === "all" || report.status === filters.status;
      const receivedMatch = filters.received === "all" || report.received_status === filters.received;
      const searchMatch =
        !filters.search ||
        String(report.employee_name || "").toLowerCase().includes(filters.search.toLowerCase());
      return teamMatch && dayMatch && statusMatch && receivedMatch && searchMatch;
    });
  }, [reports, filters]);

  const stats = useMemo(() => {
    const total = filteredReports.length;
    const approved = filteredReports.filter((item) => item.status === "approved").length;
    const rejected = filteredReports.filter((item) => item.status === "rejected").length;
    const pending = filteredReports.filter((item) => item.status === "pending").length;
    return { total, approved, rejected, pending };
  }, [filteredReports]);

  const validate = async (id, status) => {
    await reportApi.validateReport(id, status);
    setReports((prev) =>
      prev.map((report) =>
        Number(report.id) === Number(id)
          ? { ...report, status }
          : report
      )
    );
  };

  const openReceivedReport = async (reportId) => {
    setDetailsLoading(true);
    try {
      const res = await reportApi.getReportDetails(reportId);
      setSelectedReportDetails(res.data || null);
    } finally {
      setDetailsLoading(false);
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

  const employeeMap = filteredReports.reduce((acc, report) => {
    const existing = acc[report.employee_name] || 0;
    acc[report.employee_name] = existing + Number(report.completed_tasks || 0);
    return acc;
  }, {});

  const completedTasksPieData = useMemo(() => {
    const teamTotals = filteredReports.reduce((acc, report) => {
      const teamName = report.employee_team || "Unknown";
      acc.set(teamName, (acc.get(teamName) || 0) + Number(report.completed_tasks || 0));
      return acc;
    }, new Map());

    const labels = Array.from(teamTotals.keys());

    return {
      labels,
      values: Array.from(teamTotals.values()),
      chartValues: Array.from(teamTotals.values()),
      colors: labels.map((label, index) => TEAM_DONUT_COLORS[label] || FALLBACK_DONUT_COLORS[index % FALLBACK_DONUT_COLORS.length])
    };
  }, [filteredReports]);

  const topPerformers = useMemo(
    () => (Array.isArray(analytics.topPerformers) ? analytics.topPerformers : []),
    [analytics.topPerformers]
  );

  const statusComparisonChartData = useMemo(() => {
    const statusMap = new Map();

    filteredReports.forEach((report) => {
      const teamName = report.employee_team || "Unknown";
      if (!statusMap.has(teamName)) {
        statusMap.set(teamName, { pending: 0, inProgress: 0, completed: 0 });
      }

      const totals = statusMap.get(teamName);
      totals.completed += Number(report.completed_tasks || 0);
      totals.pending += Number(report.pending_tasks || 0);
    });

    const labels = Array.from(statusMap.keys());
    const values = Array.from(statusMap.values());

    return {
      labels,
      datasets: [
        { label: "Pending Tasks", data: values.map((entry) => entry.pending), backgroundColor: "#f1dc21" },
        { label: "In Progress Tasks", data: values.map((entry) => entry.inProgress), backgroundColor: "#33a8d6" },
        { label: "Completed Tasks", data: values.map((entry) => entry.completed), backgroundColor: "#51bb2a" }
      ]
    };
  }, [filteredReports]);

  const handleOpenProfile = () => {
    profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64">
        <Navbar
          title="HR Dashboard"
          notifications={notifications}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenProfile={handleOpenProfile}
          profileLabel="HR"
        />

        <main className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="card"><p className="text-xs text-slate-500">Total Reports</p><h3 className="text-2xl font-bold">{stats.total}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Approved</p><h3 className="text-2xl font-bold text-green-600">{stats.approved}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Rejected</p><h3 className="text-2xl font-bold text-rose-600">{stats.rejected}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Pending</p><h3 className="text-2xl font-bold text-yellow-600">{stats.pending}</h3></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Charts
              type="donut"
              title="Completed Tasks by Department"
              labels={completedTasksPieData.labels}
              values={completedTasksPieData.values}
              chartValues={completedTasksPieData.chartValues}
              color={completedTasksPieData.colors}
            />
            <Charts
              type="bar"
              title="Top Performers (Productivity Score)"
              labels={topPerformers.map((item) => item.name)}
              values={topPerformers.map((item) => Number(item.productivity_score || 0))}
              color="rgba(95, 157, 114, 0.85)"
              yAxisTitle="Productivity Score"
              yTickStep={5}
            />
            <Charts
              type="bar"
              title="Department Admin / HR Performance (%)"
              labels={adminPerformance.map((item) => item.name)}
              values={adminPerformance.map((item) => Number(item.completion_rate || 0))}
              color="rgba(31, 84, 50, 0.85)"
            />
            <Charts
              type="bar"
              title="Task Status Comparison by Department"
              labels={statusComparisonChartData.labels}
              datasets={statusComparisonChartData.datasets}
              xAxisTitle="Department"
              yAxisTitle="Task Count"
            />
          </div>

          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-semibold">Employee Reports</h2>
            <div className="mb-3 grid gap-3 md:grid-cols-5">
              <input
                className="input"
                placeholder="Search employee"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
              <select
                className="input"
                value={filters.team}
                onChange={(event) => setFilters((prev) => ({ ...prev, team: event.target.value }))}
              >
                <option value="all">All Departments</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              <input
                className="input"
                type="date"
                value={filters.day}
                onChange={(event) => setFilters((prev) => ({ ...prev, day: event.target.value }))}
              />
              <select
                className="input"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                className="input"
                value={filters.received}
                onChange={(event) => setFilters((prev) => ({ ...prev, received: event.target.value }))}
              >
                <option value="all">All Received State</option>
                <option value="Received">Received</option>
                <option value="Not Received">Not Received</option>
              </select>
            </div>

            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Completed</th>
                  <th className="p-2">Pending</th>
                  <th className="p-2">Received</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} className="border-b">
                    <td className="p-2">{report.employee_name}</td>
                    <td className="p-2">{report.date}</td>
                    <td className="p-2">{report.total_tasks}</td>
                    <td className="p-2 text-green-600">{report.completed_tasks}</td>
                    <td className="p-2 text-yellow-600">{report.pending_tasks}</td>
                    <td className="p-2">
                      {report.received_status === "Received" ? (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                          onClick={() => openReceivedReport(report.id)}
                        >
                          Received
                        </button>
                      ) : (
                        <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                          Not Received
                        </span>
                      )}
                    </td>
                    <td className="p-2 capitalize">{report.status}</td>
                    <td className="p-2 space-x-2">
                      <button className="btn-primary" onClick={() => validate(report.id, "approved")} type="button">
                        Approve
                      </button>
                      <button className="btn-secondary" onClick={() => validate(report.id, "rejected")} type="button">
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500">
                      No reports available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Live refresh is active every 45 seconds. {loading ? "Refreshing..." : "Up to date"}
            </p>
          </div>

          {(selectedReportDetails || detailsLoading) && (
            <div className="card overflow-x-auto">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Received Report Details</h2>
                <button type="button" className="btn-secondary" onClick={() => setSelectedReportDetails(null)}>
                  Close
                </button>
              </div>

              {detailsLoading ? (
                <p className="text-sm text-slate-500">Loading report details...</p>
              ) : (
                <>
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p><span className="font-semibold">Employee:</span> {selectedReportDetails?.report?.employee_name}</p>
                    <p><span className="font-semibold">Date:</span> {selectedReportDetails?.report?.date}</p>
                    <p><span className="font-semibold">Received:</span> {selectedReportDetails?.report?.received_status}</p>
                  </div>

                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="p-2">Client</th>
                        <th className="p-2">Task</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReportDetails?.tasks || []).map((task) => (
                        <tr key={task.id} className="border-b">
                          <td className="p-2">{task.client}</td>
                          <td className="p-2">{task.task}</td>
                          <td className="p-2">{task.action}</td>
                          <td className="p-2">{task.status}</td>
                          <td className="p-2">
                            {task.submitted_to_hr_at ? new Date(task.submitted_to_hr_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                      {(selectedReportDetails?.tasks || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-3 text-center text-slate-500">
                            No tasks found in this report
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          <Charts
            type="bar"
            title="Completed Tasks by Employee"
            labels={Object.keys(employeeMap)}
            values={Object.values(employeeMap)}
            color="rgba(16, 185, 129, 0.8)"
          />

          <div ref={profileSectionRef}>
            <ProfileSection
              user={user}
              departmentLabel="Human Resources"
              passwordForm={passwordForm}
              onPasswordFormChange={(field, value) => setPasswordForm((prev) => ({ ...prev, [field]: value }))}
              onSubmit={handlePasswordChange}
              passwordError={passwordError}
              passwordMessage={passwordMessage}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default HRDashboard;
