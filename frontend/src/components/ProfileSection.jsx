import { toTeamLabel } from "../utils/teamLabel";

const ProfileSection = ({
  user,
  departmentLabel,
  showDepartment = true,
  passwordForm,
  onPasswordFormChange,
  onSubmit,
  passwordError,
  passwordMessage
}) => {
  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[30px] border border-dsr-border bg-[linear-gradient(135deg,#f8fbf8,#eef5f0)] shadow-sm">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)] lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-dsr-brand">Profile</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-dsr-ink">{user?.name || "-"}</h2>
            <p className="mt-3 text-lg text-dsr-muted">{user?.email || "-"}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-dsr-border bg-white/80 px-4 py-2 text-sm font-semibold text-dsr-ink">
                {String(user?.role || "").toUpperCase()}
              </span>
              {showDepartment ? (
                <span className="rounded-full border border-dsr-border bg-white/80 px-4 py-2 text-sm font-semibold text-dsr-brand">
                  {departmentLabel || toTeamLabel(user?.team) || "-"}
                </span>
              ) : null}
            </div>
          </div>

          <div className={`rounded-[26px] border border-white/80 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${showDepartment ? "" : "max-w-[360px]"}`}>
            <div className={`grid gap-4 ${showDepartment ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
              <div className={`rounded-2xl border border-dsr-border bg-dsr-soft/45 p-4 ${showDepartment ? "" : "max-w-[320px]"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dsr-muted">Role</p>
                <p className="mt-3 text-lg font-semibold text-dsr-ink">{String(user?.role || "").toUpperCase()}</p>
              </div>
              {showDepartment ? (
                <div className="rounded-2xl border border-dsr-border bg-dsr-soft/45 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dsr-muted">Department</p>
                  <p className="mt-3 text-lg font-semibold text-dsr-ink">{departmentLabel || toTeamLabel(user?.team) || "-"}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <form className="rounded-[30px] border border-dsr-border bg-white p-6 shadow-sm lg:p-7" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-dsr-brand">Security</p>
            <h3 className="mt-2 text-2xl font-bold text-dsr-ink">Change Password</h3>
            <p className="mt-2 text-sm text-dsr-muted">Keep your account secure with a shorter, cleaner update form.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Current Password</span>
            <input
              className="input h-12"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => onPasswordFormChange("currentPassword", event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">New Password</span>
            <input
              className="input h-12"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => onPasswordFormChange("newPassword", event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Confirm Password</span>
            <input
              className="input h-12"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => onPasswordFormChange("confirmPassword", event.target.value)}
              required
            />
          </label>
          <button className="btn-primary h-12 px-6 lg:min-w-[150px]" type="submit">
            Update
          </button>
        </div>

        {passwordError ? <p className="mt-4 text-sm text-rose-600">{passwordError}</p> : null}
        {passwordMessage ? <p className="mt-4 text-sm text-emerald-700">{passwordMessage}</p> : null}
      </form>
    </section>
  );
};

export default ProfileSection;
