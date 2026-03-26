import React from "react";

function ReportHeader({
  reportType,
  onReportTypeChange,
  dateRange,
  onDateRangeChange,
  date,
  onDateChange,
  team,
  onTeamChange,
  teamOptions,
  employeeId,
  onEmployeeChange,
  employeeOptions,
  onGenerate,
  onExportXlsx,
  loading,
  summary,
  totalTasks,
  detailedSummary
}) {
  const stats =
    reportType === "detailed"
      ? [
          {
            label: "Total Tasks",
            value: detailedSummary?.total ?? 0,
            className: "bg-slate-100 text-slate-700"
          },
          {
            label: "Completed",
            value: detailedSummary?.completed ?? 0,
            className: "bg-emerald-50 text-emerald-800"
          },
          {
            label: "In Progress",
            value: detailedSummary?.inProgress ?? 0,
            className: "bg-blue-50 text-blue-800"
          },
          {
            label: "Pending",
            value: detailedSummary?.pending ?? 0,
            className: "bg-amber-50 text-amber-800"
          }
        ]
      : [
          { label: "Received", value: summary.received, className: "bg-emerald-50 text-emerald-800" },
          { label: "Not Received", value: summary.notReceived, className: "bg-rose-50 text-rose-800" },
          { label: "Leave", value: summary.leave, className: "bg-amber-50 text-amber-800" },
          { label: "Tasks Tracked", value: totalTasks, className: "bg-slate-100 text-slate-700" }
        ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-7">
        <label className="md:col-span-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Report Type</span>
          <select
            value={reportType}
            onChange={(event) => onReportTypeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="received">Received / Not Received</option>
            <option value="detailed">Detailed Task List</option>
          </select>
        </label>

        <label className="md:col-span-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Range</span>
          <select
            value={dateRange}
            onChange={(event) => onDateRangeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="today">Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>

        <label className="md:col-span-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Anchor Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </label>

        <label className="md:col-span-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Team</span>
          <select
            value={team}
            onChange={(event) => onTeamChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="all">All Departments (Company-Wide)</option>
            {teamOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</span>
          <select
            value={employeeId}
            onChange={(event) => onEmployeeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="all">All Employees</option>
            {employeeOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.team})
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Loading..." : reportType === "detailed" ? "Generate Detailed Report" : "Generate Report"}
          </button>
          <button
            type="button"
            onClick={onExportXlsx}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {reportType === "detailed" ? "Download Task XLSX" : "Download XLSX"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-lg px-3 py-2 text-sm ${item.className}`}>
            {item.label}: {item.value}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReportHeader;
