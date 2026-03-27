import React, { useEffect, useMemo, useRef, useState } from "react";
import { toTeamLabel } from "../utils/teamLabel";

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
  selectedEmployeeIds,
  onEmployeeSelectionChange,
  employeeOptions,
  onGenerate,
  onExportXlsx,
  loading,
  summary,
  totalTasks,
  detailedSummary
}) {
  const [isEmployeeMenuOpen, setIsEmployeeMenuOpen] = useState(false);
  const employeeMenuRef = useRef(null);

  useEffect(() => {
    if (!isEmployeeMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (employeeMenuRef.current && !employeeMenuRef.current.contains(event.target)) {
        setIsEmployeeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEmployeeMenuOpen]);

  const selectedEmployeeSummary = useMemo(() => {
    if (!selectedEmployeeIds.length) {
      return "All Employees";
    }

    if (selectedEmployeeIds.length === 1) {
      const selected = employeeOptions.find((entry) => String(entry.id) === String(selectedEmployeeIds[0]));
      return selected ? `${selected.name} (${toTeamLabel(selected.team)})` : "1 employee selected";
    }

    return `${selectedEmployeeIds.length} employees selected`;
  }, [employeeOptions, selectedEmployeeIds]);

  const toggleEmployeeSelection = (id) => {
    const normalizedId = String(id);
    const alreadySelected = selectedEmployeeIds.includes(normalizedId);

    if (alreadySelected) {
      onEmployeeSelectionChange(selectedEmployeeIds.filter((entry) => String(entry) !== normalizedId));
      return;
    }

    onEmployeeSelectionChange([...selectedEmployeeIds, normalizedId]);
  };

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
                {toTeamLabel(entry)}
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-1" ref={employeeMenuRef}>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Employees</span>
          <button
            type="button"
            onClick={() => setIsEmployeeMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <span className="truncate text-slate-700">{selectedEmployeeSummary}</span>
            <span className="ml-2 text-slate-500">▾</span>
          </button>

          {isEmployeeMenuOpen && (
            <div className="absolute z-20 mt-1 max-h-60 w-[220px] overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 shadow-lg">
              <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => onEmployeeSelectionChange(employeeOptions.map((entry) => String(entry.id)))}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => onEmployeeSelectionChange([])}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>

              {employeeOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-500">No employees found</p>
              ) : (
                employeeOptions.map((entry) => {
                  const isChecked = selectedEmployeeIds.includes(String(entry.id));

                  return (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployeeSelection(entry.id)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                      />
                      <span className="truncate text-slate-700">
                        {entry.name} ({toTeamLabel(entry.team)})
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}

          <span className="mt-1 block text-[11px] text-slate-500">
            {selectedEmployeeIds.length > 0
              ? `${selectedEmployeeIds.length} selected`
              : "No selection = all employees"}
          </span>
        </div>

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
