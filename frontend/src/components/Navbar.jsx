import { useMemo } from "react";
import logo from "../assets/logo.png";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "../context/AuthContext";
import useScrollHeader from "../hooks/useScrollHeader";

const Navbar = ({ notifications = [], onToggleSidebar, onOpenProfile, profileLabel }) => {
  const { user, logout } = useAuth();
  const isHeaderVisible = useScrollHeader();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  return (
    <header
      className={`sticky top-0 z-30 border-b border-slate-200 bg-[#f3f3f3] transition-transform duration-300 ${
        isHeaderVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between gap-6 px-4 py-4">
        <div className="flex items-center gap-5">
          <button
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm md:hidden"
            onClick={onToggleSidebar}
            type="button"
          >
            Menu
          </button>
          <img
            src={logo}
            alt="DSR Management Logo"
            className="h-14 w-[260px] shrink-0 object-contain object-left"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Open notifications"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M10 17a2 2 0 0 0 4 0" />
            </svg>
            {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />}
          </button>
          <ProfileMenu user={user} onOpenProfile={onOpenProfile} onLogout={logout} label={profileLabel} />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
