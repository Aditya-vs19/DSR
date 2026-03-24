import { useMemo } from "react";
import logo from "../assets/logo.jpeg";
import { useAuth } from "../context/AuthContext";

const Navbar = ({ title, notifications = [], onToggleSidebar }) => {
  const { user, logout } = useAuth();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#f7f7f7]">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm md:hidden"
            onClick={onToggleSidebar}
            type="button"
          >
            Menu
          </button>
          <img src={logo} alt="DSR Management Logo" className="h-11 w-auto object-contain" />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-500">{user?.team || user?.role || "Workspace"} workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="text-sm font-medium text-slate-600">Notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -right-4 -top-2 rounded-full bg-rose-500 px-2 text-xs text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold capitalize">{user?.name}</p>
            <p className="text-xs text-slate-500 uppercase">{user?.role}</p>
          </div>
          <button className="btn-secondary" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
