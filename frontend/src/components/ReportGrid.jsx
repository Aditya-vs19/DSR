import React from "react";
import ReportCell from "./ReportCell";

function ReportGrid({ rows = [], employees = [], onCellChange, loadingCellId = null }) {
  if (!rows.length || !employees.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Generate a report to view the daily grid.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
              Date
            </th>
            {employees.map((employee) => (
              <th
                key={employee.id}
                className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700"
                title={employee.team}
              >
                <span className="block leading-tight">{employee.name}</span>
                <span className="text-xs font-normal text-slate-500">{employee.team}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const showWeekHeader = index === 0 || rows[index - 1].weekLabel !== row.weekLabel;

            return (
              <React.Fragment key={row.date}>
                {showWeekHeader && (
                  <tr className="bg-amber-100">
                    <td
                      colSpan={employees.length + 1}
                      className="border-t border-b border-slate-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                    >
                      {row.weekLabel}
                    </td>
                  </tr>
                )}

                <tr className={row.isWeekend ? "bg-sky-50/70" : "bg-white"}>
                  <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-inherit px-3 py-2 align-top">
                    <div className="font-semibold text-slate-700">{row.day}</div>
                    <div className="text-xs text-slate-500">{row.date}</div>
                    {row.holidayTitle ? (
                      <div className="mt-1 inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-semibold text-pink-700">
                        {row.holidayTitle}
                      </div>
                    ) : null}
                  </td>
                  {row.employees.map((entry) => (
                    <td key={`${row.date}-${entry.userId}`} className="border-t border-slate-200 px-2 py-2">
                      {entry.status === "Holiday" ? (
                        <div className="flex min-h-[30px] min-w-[120px] items-center justify-center rounded-md border border-pink-200 bg-pink-100 px-2 py-1 text-xs font-semibold text-pink-700">
                          Holiday
                        </div>
                      ) : (
                        <ReportCell
                          value={entry.status}
                          disabled={!entry.reportId || loadingCellId === entry.reportId}
                          onChange={(status) => onCellChange(entry.reportId, status)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ReportGrid;
