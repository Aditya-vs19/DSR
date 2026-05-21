import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import useAutoCapitalizeInputs from "./hooks/useAutoCapitalizeInputs";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const Login = lazy(() => import("./pages/Login"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));

const rolePath = {
  employee: "/employee",
  admin: "/admin",
  hr: "/hr",
  superadmin: "/superadmin"
};

const ProtectedRoute = ({ roles, children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={rolePath[user.role]} replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={rolePath[user.role]} replace />;
};

const App = () => {
  useAutoCapitalizeInputs();

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/employee"
          element={
            <ProtectedRoute roles={["employee"]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr"
          element={
            <ProtectedRoute roles={["hr"]}>
              <HRDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute roles={["superadmin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
