import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = ({ title, notifications = [], onToggleSidebar }) => {
  const { user, logout } = useAuth();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm md:hidden"
          onClick={onToggleSidebar}
          type="button"
        >
          ☰
        </button>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
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
    </header>
  );
};

export default Navbar;
