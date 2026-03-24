import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
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
  register: (payload) => api.post("/auth/register", payload),
  getUsers: () => api.get("/auth/users"),
  getTeamEmployees: (team) => api.get("/auth/users/team", { params: { team } })
};

export const taskApi = {
  createTask: (payload) => api.post("/tasks", payload),
  getTasks: () => api.get("/tasks"),
  updateTask: (id, payload) => api.put(`/tasks/${id}`, payload),
  getDailySummary: (date) => api.get("/tasks/summary/daily", { params: { date } }),
  getTimeline: (days = 7) => api.get("/tasks/timeline", { params: { days } }),
  getTeamPerformance: (team) => api.get("/tasks/performance/team", { params: { team } }),
  getNotifications: () => api.get("/tasks/notifications/me"),
  markNotificationRead: (id) => api.put(`/tasks/notifications/${id}/read`)
};

export const reportApi = {
  getReports: () => api.get("/reports"),
  generateReports: (date) => api.post("/reports/generate", { date }),
  validateReport: (id, status) => api.put(`/reports/${id}/validate`, { status }),
  getAnalytics: () => api.get("/reports/analytics/superadmin")
};

export default api;
