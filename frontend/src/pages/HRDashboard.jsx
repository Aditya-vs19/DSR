import { useEffect, useMemo, useState } from "react";
import Charts from "../components/Charts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { authApi, reportApi, taskApi } from "../services/api";

const HRDashboard = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const loadData = async () => {
    const [reportsRes, notificationRes] = await Promise.all([reportApi.getReports(), taskApi.getNotifications()]);
    setReports(reportsRes.data || []);
    setNotifications(notificationRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = reports.length;
    const approved = reports.filter((item) => item.status === "approved").length;
    const rejected = reports.filter((item) => item.status === "rejected").length;
    const pending = reports.filter((item) => item.status === "pending").length;
    return { total, approved, rejected, pending };
  }, [reports]);

  const validate = async (id, status) => {
    await reportApi.validateReport(id, status);
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

  const employeeMap = reports.reduce((acc, report) => {
    const existing = acc[report.employee_name] || 0;
    acc[report.employee_name] = existing + Number(report.completed_tasks || 0);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-64">
        <Navbar
          title="HR Dashboard"
          notifications={notifications}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="card"><p className="text-xs text-slate-500">Total Reports</p><h3 className="text-2xl font-bold">{stats.total}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Approved</p><h3 className="text-2xl font-bold text-green-600">{stats.approved}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Rejected</p><h3 className="text-2xl font-bold text-rose-600">{stats.rejected}</h3></div>
            <div className="card"><p className="text-xs text-slate-500">Pending</p><h3 className="text-2xl font-bold text-yellow-600">{stats.pending}</h3></div>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-lg font-semibold">Employee Reports</h2>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="p-2">Employee</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Completed</th>
                  <th className="p-2">Pending</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b">
                    <td className="p-2">{report.employee_name}</td>
                    <td className="p-2">{report.date}</td>
                    <td className="p-2">{report.total_tasks}</td>
                    <td className="p-2 text-green-600">{report.completed_tasks}</td>
                    <td className="p-2 text-yellow-600">{report.pending_tasks}</td>
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
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-500">
                      No reports available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Charts
            type="bar"
            title="Completed Tasks by Employee"
            labels={Object.keys(employeeMap)}
            values={Object.values(employeeMap)}
            color="rgba(16, 185, 129, 0.8)"
          />

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
        </main>
      </div>
    </div>
  );
};

export default HRDashboard;
