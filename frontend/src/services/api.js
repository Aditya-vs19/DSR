import axios from "axios";

const resolveApiBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const { protocol, hostname } = window.location;
  const devTunnelMatch = hostname.match(/^(.*)-\d+(\..*devtunnels\.ms)$/);

  if (devTunnelMatch) {
    return `${protocol}//${devTunnelMatch[1]}-5000${devTunnelMatch[2]}/api`;
  }

  return `${protocol}//${hostname}:5000/api`;
};

const apiBaseURL = resolveApiBaseURL();

const api = axios.create({
  baseURL: apiBaseURL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dsr_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  changePassword: (payload) => api.post("/auth/change-password", payload),
  resetManagedPassword: (payload) => api.post("/auth/reset-managed-password", payload),
  register: (payload) => api.post("/auth/register", payload),
  getEmployees: () => api.get("/auth/employees"),
  getDepartmentEmployees: (team) => api.get("/auth/employees/team", { params: { team } }),
  // Backward-compatible aliases; prefer getEmployees/getDepartmentEmployees.
  getUsers: () => api.get("/auth/users"),
  getTeamEmployees: (team) => api.get("/auth/users/team", { params: { team } })
};

export const taskApi = {
  createTask: (payload) => api.post("/tasks", payload),
  getTasks: () => api.get("/tasks"),
  updateTask: (id, payload) => api.put(`/tasks/${id}`, payload),
  reassignTask: (id, payload) => api.put(`/tasks/${id}/reassign`, payload),
  submitTaskToHr: (id) => api.put(`/tasks/${id}/submit-hr`),
  getDailySummary: (date) => api.get("/tasks/summary/daily", { params: { date } }),
  getTimeline: (days = 7) => api.get("/tasks/timeline", { params: { days } }),
  getTeamPerformance: (team) => api.get("/tasks/performance/team", { params: { team } }),
  getAdminPerformance: (team) => api.get("/tasks/performance/admins", { params: { team } }),
  getNotifications: () => api.get("/tasks/notifications/me"),
  markNotificationRead: (id) => api.put(`/tasks/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put("/tasks/notifications/read-all")
};

export const reportApi = {
  getReports: (params = {}) => api.get("/reports", { params }),
  getDailyReportGrid: (params = {}) => api.get("/reports", { params }),
  getHolidays: (params = {}) => api.get("/reports/holidays", { params }),
  saveHoliday: (payload) => api.post("/reports/holidays", payload),
  deleteHoliday: (id) => api.delete(`/reports/holidays/${id}`),
  submitReportToHr: (date) => api.post("/reports/submit", { date }),
  getReportDetails: (id) => api.get(`/reports/${id}/details`),
  updateDailyReportCell: (id, status) => api.put(`/reports/${id}`, { status }),
  generateReports: (date) => api.post("/reports/generate", { date }),
  validateReport: (id, status) => api.put(`/reports/${id}/validate`, { status }),
  getAnalytics: (params = {}) => api.get("/reports/analytics/superadmin", { params })
};

export default api;
