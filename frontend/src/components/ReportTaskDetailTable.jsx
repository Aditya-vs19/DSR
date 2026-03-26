import React from "react";

const statusBadgeClass = {
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  "In Progress": "bg-sky-100 text-sky-800 border-sky-200"
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
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

  const parsed = new Date(task.created_at);
  if (Number.isNaN(parsed.getTime())) {
    return task.groupLabel || task.day || "Unknown Day";
  }

  const dayLabel = task.groupLabel || task.day || parsed.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = parsed.toLocaleDateString("en-GB");
  return `${dayLabel} - ${dateLabel}`;
};

function ReportTaskDetailTable({ tasks = [], dateRange = "week" }) {
  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Generate detailed report to view task list.
      </div>
    );
  }

  const groupedTasks = [];
  const groupIndexByDate = new Map();

  tasks.forEach((task) => {
    const dateKey =
      dateRange === "month"
        ? task.groupLabel || `week-unknown-${task.id}`
        : String(task.created_at || "").slice(0, 10) || `unknown-${task.id}`;

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
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">ID</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Employee</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Team</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Client</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Task</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Action</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Status</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Dependency</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Assigned By</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Created At</th>
            <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">Completed At</th>
          </tr>
        </thead>
        <tbody>
          {groupedTasks.map((group) => (
            <React.Fragment key={group.key}>
              <tr className="bg-slate-200/70">
                <td colSpan={11} className="px-3 py-2 text-left font-semibold text-slate-800">
                  {group.label}
                </td>
              </tr>
              {group.tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b border-slate-200/80 ${task.status === "Completed" ? "bg-emerald-50/30" : task.status === "Pending" ? "bg-amber-50/20" : task.status === "In Progress" ? "bg-sky-50/30" : "bg-white"}`}
                >
                  <td className="px-3 py-2 text-slate-600">{task.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{task.assigned_to_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.assigned_to_team || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.client || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{task.task || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.action || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${statusBadgeClass[task.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                      {task.status || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{task.dependency || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.assigned_by_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(task.created_at)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatUtcDateTime(task.completed_at)}</td>
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
