import React from "react";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

function ReportTaskDetailTable({ tasks = [] }) {
  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Generate detailed report to view task list.
      </div>
    );
  }

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
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-slate-200/80">
              <td className="px-3 py-2 text-slate-600">{task.id}</td>
              <td className="px-3 py-2 font-medium text-slate-700">{task.assigned_to_name || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{task.assigned_to_team || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{task.client || "-"}</td>
              <td className="px-3 py-2 text-slate-700">{task.task || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{task.action || "-"}</td>
              <td className="px-3 py-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {task.status || "-"}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-600">{task.dependency || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{task.assigned_by_name || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{formatDateTime(task.created_at)}</td>
              <td className="px-3 py-2 text-slate-600">{formatDateTime(task.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportTaskDetailTable;