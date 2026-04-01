import { useEffect, useRef, useState } from "react";
import { toTeamLabel } from "../utils/teamLabel";

const ProfileMenu = ({ user, onOpenProfile, onLogout, label, badgeClassName = "" }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const badgeText = String(user?.name || label || "").trim();
  const departmentText = String(label || "").trim() || toTeamLabel(user?.team) || String(user?.role || "").toUpperCase() || "Dashboard";

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (menuRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const handleProfileClick = () => {
    setOpen(false);
    onOpenProfile?.();
  };

  const handleLogoutClick = () => {
    setOpen(false);
    onLogout?.();
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-3">
        {badgeText ? (
          <span
            className={`hidden rounded-full border border-dsr-border bg-dsr-soft px-4 py-2 text-sm font-semibold text-dsr-brand lg:inline-flex ${badgeClassName}`}
          >
            {badgeText}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dsr-border bg-white text-dsr-ink shadow-[0_12px_28px_rgba(47,127,79,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(47,127,79,0.14)]"
          aria-label="Open profile menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[280px] rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,246,0.96))] p-3 shadow-[0_24px_48px_rgba(31,42,34,0.14)] backdrop-blur">
          <div className="rounded-[18px] border border-white/70 bg-[linear-gradient(180deg,#f7fbf8,#eef5f0)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-2xl font-bold text-dsr-ink">{user?.name || "User"}</p>
            <p className="mt-1.5 text-sm text-dsr-muted">{user?.email || "-"}</p>
            <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-dsr-brand">
              {departmentText}
            </p>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-dsr-border/80 pt-3">
            <button
              type="button"
              onClick={handleProfileClick}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-dsr-ink transition hover:bg-dsr-soft/70"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-dsr-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
              </svg>
              <span className="text-base font-medium">Profile</span>
            </button>
          </div>

          <div className="mt-3 border-t border-dsr-border/80 pt-3">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-600 transition hover:bg-rose-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" strokeLinecap="round" />
                <path d="m16 17 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12H9" strokeLinecap="round" />
              </svg>
              <span className="text-base font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProfileMenu;
