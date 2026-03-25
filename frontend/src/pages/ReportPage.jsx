import React, { useCallback, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import ReportHeader from "../components/ReportHeader";
import ReportGrid from "../components/ReportGrid";
import { authApi, reportApi, taskApi } from "../services/api";

const COLOR = {
  white: "FFFFFFFF",
  headerGray: "FFE5E7EB",
  weekYellow: "FFFDE047",
  sectionBeige: "FFF3E6B3",
  todayGreen: "FF7CB342",
  receivedGreen: "FF6AA84F",
  leaveBlue: "FF4FC3F7",
  notReceivedRed: "FFFF0000",
  holidayPink: "FFE88CE8"
};

const applyCellStyle = (cell, {
  fillColor = null,
  bold = false,
  align = "center"
} = {}) => {
  cell.font = { name: "Calibri", size: 11, bold };
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FFBDBDBD" } },
    left: { style: "thin", color: { argb: "FFBDBDBD" } },
    bottom: { style: "thin", color: { argb: "FFBDBDBD" } },
    right: { style: "thin", color: { argb: "FFBDBDBD" } }
  };

  if (fillColor) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor }
    };
  }
};

const normalizeStatus = (status) => {
  if (status === "Received") return "Received";
  if (status === "Leave") return "No / On Leave";
  if (status === "Holiday") return "Holiday";
  return "Not Received";
};

const formatDateForSheet = (dateText) => {
  const dateValue = new Date(dateText);
  if (Number.isNaN(dateValue.getTime())) {
    return dateText;
  }

  return dateValue.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit"
  });
};

function ReportPage({
  role = "admin",
  initialDateRange = "week",
  initialDate = "",
  initialTeam = "all",
  initialEmployeeId = "all",
  autoGenerateToken = 0
}) {
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [team, setTeam] = useState(initialTeam);
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [gridData, setGridData] = useState({ employees: [], rows: [], summary: { received: 0, notReceived: 0, leave: 0 } });
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCellId, setLoadingCellId] = useState(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [message, setMessage] = useState("");

  const employeeOptions = useMemo(() => {
    const scoped =
      role === "admin" || team === "all"
        ? directoryUsers
        : directoryUsers.filter((item) => item.team === team);

    return scoped.map((entry) => ({
      id: entry.id,
      name: entry.name,
      team: entry.team
    }));
  }, [directoryUsers, role, team]);

  const teamOptions = useMemo(() => {
    const entries = new Set(directoryUsers.map((item) => item.team).filter(Boolean));
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [directoryUsers]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const usersRes = role === "admin" ? await authApi.getTeamEmployees() : await authApi.getUsers();
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        setDirectoryUsers(
          users.filter((entry) => {
            if (role === "superadmin") {
              return ["employee", "admin"].includes(entry.role);
            }

            return entry.role === "employee";
          })
        );
      } catch {
        setDirectoryUsers([]);
      }
    };

    loadFilterOptions();
  }, [role]);

  useEffect(() => {
    if (employeeId === "all") return;

    const exists = employeeOptions.some((entry) => String(entry.id) === String(employeeId));
    if (!exists) {
      setEmployeeId("all");
    }
  }, [employeeId, employeeOptions]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const reportParams = {
        dateRange,
        date,
        employeeId
      };

      if (role !== "admin") {
        reportParams.team = team;
      }

      const [gridRes, tasksRes] = await Promise.all([
        reportApi.getDailyReportGrid(reportParams),
        taskApi.getTasks()
      ]);

      setGridData(gridRes.data);
      setTotalTasks(Array.isArray(tasksRes.data) ? tasksRes.data.length : 0);
      const reportLabel =
        gridRes.data.startDate === gridRes.data.endDate
          ? gridRes.data.startDate
          : `${gridRes.data.startDate} to ${gridRes.data.endDate}`;
      setMessage(`Report loaded for ${reportLabel}`);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }, [date, dateRange, employeeId, role, team]);

  const handleCellChange = useCallback(
    async (reportId, status) => {
      if (!reportId) return;
      setLoadingCellId(reportId);

      try {
        await reportApi.updateDailyReportCell(reportId, status);
        setGridData((prev) => {
          const rows = prev.rows.map((row) => ({
            ...row,
            employees: row.employees.map((entry) =>
              entry.reportId === reportId ? { ...entry, status } : entry
            )
          }));

          const summary = rows.reduce(
            (acc, row) => {
              row.employees.forEach((entry) => {
                if (entry.status === "Received") acc.received += 1;
                else if (entry.status === "Leave") acc.leave += 1;
                else acc.notReceived += 1;
              });
              return acc;
            },
            { received: 0, notReceived: 0, leave: 0 }
          );

          return { ...prev, rows, summary };
        });
      } catch (error) {
        setMessage(error?.response?.data?.message || "Failed to update cell status.");
      } finally {
        setLoadingCellId(null);
      }
    },
    []
  );

  const handleExportXlsx = useCallback(() => {
    if (!gridData.rows.length || !gridData.employees.length) {
      setMessage("Generate report data before exporting.");
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Daily Report");
    const employeeCount = gridData.employees.length;
    const lastColumn = 2 + employeeCount;
    const todayText = new Date().toISOString().slice(0, 10);
    let rowCursor = 1;

    sheet.columns = [
      { width: 14 },
      { width: 14 },
      ...gridData.employees.map(() => ({ width: 18 }))
    ];

    sheet.getCell(rowCursor, 1).value = "Today";
    applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.todayGreen, bold: true });
    sheet.getCell(rowCursor, 2).value = "Weekly report received";
    applyCellStyle(sheet.getCell(rowCursor, 2), { fillColor: COLOR.holidayPink, bold: true });

    rowCursor += 1;
    sheet.getCell(rowCursor, 1).value = "No / On Leave";
    applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.leaveBlue, bold: true });
    sheet.getCell(rowCursor, 2).value = "Holiday";
    applyCellStyle(sheet.getCell(rowCursor, 2), { fillColor: COLOR.holidayPink, bold: true });

    rowCursor += 1;
    sheet.getCell(rowCursor, 1).value = "Not Received";
    applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.notReceivedRed, bold: true });

    sheet.mergeCells(rowCursor - 2, 4, rowCursor - 1, lastColumn);
    sheet.getCell(rowCursor - 2, 4).value = "Daily Employee Report Tracker";
    applyCellStyle(sheet.getCell(rowCursor - 2, 4), { fillColor: COLOR.headerGray, bold: true });
    sheet.getCell(rowCursor - 2, 4).font = { name: "Calibri", size: 16, bold: true };

    rowCursor += 2;

    const weekMap = new Map();
    gridData.rows.forEach((row) => {
      const weekKey = row.weekLabel || "Week 1";
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey).push(row);
    });

    const weeks = Array.from(weekMap.entries());

    weeks.forEach(([weekLabel, weekRows], weekIndex) => {
      sheet.mergeCells(rowCursor, 1, rowCursor, 2);
      sheet.getCell(rowCursor, 1).value = weekLabel || `Week ${weekIndex + 1}`;
      applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.weekYellow, bold: true });

      sheet.mergeCells(rowCursor, 3, rowCursor, lastColumn);
      sheet.getCell(rowCursor, 3).value = "Employees Name";
      applyCellStyle(sheet.getCell(rowCursor, 3), { fillColor: COLOR.sectionBeige, bold: true });

      rowCursor += 1;

      sheet.getCell(rowCursor, 1).value = "Date";
      sheet.getCell(rowCursor, 2).value = "Day";
      applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.headerGray, bold: true });
      applyCellStyle(sheet.getCell(rowCursor, 2), { fillColor: COLOR.headerGray, bold: true });

      gridData.employees.forEach((employee, employeeIndex) => {
        const cell = sheet.getCell(rowCursor, employeeIndex + 3);
        cell.value = employee.name;
        applyCellStyle(cell, { fillColor: COLOR.headerGray, bold: true });
      });

      rowCursor += 1;

      weekRows.forEach((reportRow) => {
        const dateCell = sheet.getCell(rowCursor, 1);
        const dayCell = sheet.getCell(rowCursor, 2);
        dateCell.value = formatDateForSheet(reportRow.date);
        dayCell.value = reportRow.day;

        const rowIsToday = String(reportRow.date).slice(0, 10) === todayText;
        applyCellStyle(dateCell, { fillColor: rowIsToday ? COLOR.todayGreen : COLOR.white, align: "left" });
        applyCellStyle(dayCell, { fillColor: rowIsToday ? COLOR.todayGreen : COLOR.white, align: "left" });

        const statusByUser = new Map(
          (reportRow.employees || []).map((entry) => [String(entry.userId), normalizeStatus(entry.status)])
        );

        gridData.employees.forEach((employee, employeeIndex) => {
          const statusValue = statusByUser.get(String(employee.id)) || "Not Received";
          const cell = sheet.getCell(rowCursor, employeeIndex + 3);
          cell.value = statusValue;

          let fillColor = COLOR.white;
          if (statusValue === "Received") fillColor = COLOR.receivedGreen;
          if (statusValue === "No / On Leave") fillColor = COLOR.leaveBlue;
          if (statusValue === "Not Received") fillColor = COLOR.notReceivedRed;
          if (statusValue === "Holiday") fillColor = COLOR.holidayPink;

          applyCellStyle(cell, { fillColor });
        });

        rowCursor += 1;
      });

      rowCursor += 1;
    });

    sheet.getCell(rowCursor, 1).value = "Summary";
    sheet.getCell(rowCursor, 2).value = "Count";
    applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: COLOR.headerGray, bold: true });
    applyCellStyle(sheet.getCell(rowCursor, 2), { fillColor: COLOR.headerGray, bold: true });

    rowCursor += 1;
    const summaryItems = [
      ["Received", gridData.summary?.received ?? 0, COLOR.receivedGreen],
      ["Not Received", gridData.summary?.notReceived ?? 0, COLOR.notReceivedRed],
      ["No / On Leave", gridData.summary?.leave ?? 0, COLOR.leaveBlue],
      ["Tasks Tracked", totalTasks, COLOR.headerGray]
    ];

    summaryItems.forEach(([label, value, color]) => {
      sheet.getCell(rowCursor, 1).value = label;
      sheet.getCell(rowCursor, 2).value = value;
      applyCellStyle(sheet.getCell(rowCursor, 1), { fillColor: color, align: "left" });
      applyCellStyle(sheet.getCell(rowCursor, 2), { fillColor: color });
      rowCursor += 1;
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([
        buffer
      ], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `daily-report-${gridData.startDate || date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    });
  }, [date, gridData.employees, gridData.rows, gridData.startDate, gridData.summary, totalTasks]);

  useEffect(() => {
    setDateRange(initialDateRange || "week");
  }, [initialDateRange]);

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    setTeam(initialTeam || "all");
  }, [initialTeam]);

  useEffect(() => {
    setEmployeeId(initialEmployeeId || "all");
  }, [initialEmployeeId]);

  useEffect(() => {
    if (autoGenerateToken > 0) {
      handleGenerate();
    }
  }, [autoGenerateToken, handleGenerate]);

  return (
    <div className="space-y-4">
      <ReportHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        date={date}
        onDateChange={setDate}
        team={team}
        onTeamChange={setTeam}
        teamOptions={teamOptions}
        employeeId={employeeId}
        onEmployeeChange={setEmployeeId}
        employeeOptions={employeeOptions}
        onGenerate={handleGenerate}
        onExportXlsx={handleExportXlsx}
        loading={loading}
        summary={gridData.summary || { received: 0, notReceived: 0, leave: 0 }}
        totalTasks={totalTasks}
      />

      {message ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</div> : null}

      <div className="bg-white">
        <ReportGrid
          rows={gridData.rows}
          employees={gridData.employees}
          onCellChange={handleCellChange}
          loadingCellId={loadingCellId}
        />
      </div>
    </div>
  );
}

export default ReportPage;
