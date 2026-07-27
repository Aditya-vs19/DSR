import React from "react";
import { getTaskDateText } from "../utils/taskMeta";
import { toTeamLabel } from "../utils/teamLabel";

const statusBadgeClass = {
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  "In Progress": "bg-sky-100 text-sky-800 border-sky-200"
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(rawValue)
    ? rawValue.replace(" ", "T")
    : rawValue;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatUtcDateTime = (value) => {
  if (!value) return "-";

  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(rawValue)
    ? `${rawValue.replace(" ", "T")}Z`
    : rawValue;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const formatDaySectionLabel = (task, dateRange) => {
  if (dateRange === "month" && task.groupLabel) {
    return task.groupLabel;
  }

  const parsed = new Date(getTaskDateText(task) ? `${getTaskDateText(task)}T00:00:00` : task.created_at);
  if (Number.isNaN(parsed.getTime())) {
    return task.groupLabel || task.day || "Unknown Day";
  }

  const dayLabel = task.groupLabel || task.day || parsed.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = parsed.toLocaleDateString("en-GB");
  return `${dayLabel} - ${dateLabel}`;
};

function ReportTaskDetailTable({ tasks = [], dateRange = "week", groups = [] }) {
  if (!tasks.length && !groups.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Generate detailed report to view task list.
      </div>
    );
  }

  const groupedTasks = dateRange === "month"
    ? groups.map((group) => ({ ...group, tasks: [] }))
    : [];
  const groupIndexByDate = new Map(groupedTasks.map((group, index) => [group.key, index]));

  tasks.forEach((task) => {
    const dateKey =
      dateRange === "month"
        ? task.groupLabel || `week-unknown-${task.id}`
        : getTaskDateText(task) || `unknown-${task.id}`;

    if (!groupIndexByDate.has(dateKey)) {
      groupIndexByDate.set(dateKey, groupedTasks.length);
      groupedTasks.push({
        key: dateKey,
        label: formatDaySectionLabel(task, dateRange),
        tasks: [task]
      });
      return;
    }

    groupedTasks[groupIndexByDate.get(dateKey)].tasks.push(task);
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-sky-100">
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Employee</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Team</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Client</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Task</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Action</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Status</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Dependency / Remark</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Assigned By</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Assigned At</th>
            <th className="border-b border-sky-200 px-3 py-3 text-left font-semibold text-slate-900">Completed At</th>
          </tr>
        </thead>
        <tbody>
          {groupedTasks.map((group) => (
            <React.Fragment key={group.key}>
              <tr className="bg-amber-100">
                <td colSpan={10} className="px-3 py-2 text-left font-semibold text-amber-900">
                  {group.label}
                </td>
              </tr>
              {group.tasks.length === 0 && (
                <tr className="border-b border-slate-200/80 bg-white">
                  <td colSpan={10} className="px-3 py-3 text-left text-sm font-medium text-slate-500">
                    No tasks in this week
                  </td>
                </tr>
              )}
              {group.tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b border-slate-200/80 ${task.status === "Completed" ? "bg-emerald-50/30" : task.status === "Pending" ? "bg-amber-50/20" : task.status === "In Progress" ? "bg-sky-50/30" : "bg-white"}`}
                >
                  <td className="px-3 py-2 font-semibold text-slate-900">{task.assigned_to_name || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{toTeamLabel(task.assigned_to_team) || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{task.client || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{task.task || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{task.action || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${statusBadgeClass[task.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                      {task.status || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{task.dependency || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{task.assigned_by_name || "-"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{formatDateTime(task.assigned_at || task.created_at)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{formatUtcDateTime(task.completed_at)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportTaskDetailTable;
