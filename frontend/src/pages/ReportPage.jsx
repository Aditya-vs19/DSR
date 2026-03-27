import React, { useCallback, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import ReportHeader from "../components/ReportHeader";
import ReportGrid from "../components/ReportGrid";
import ReportTaskDetailTable from "../components/ReportTaskDetailTable";
import { authApi, reportApi, taskApi } from "../services/api";
import { toTeamLabel } from "../utils/teamLabel";

const COLOR = {
  white: "FFFFFFFF",
  headerGray: "FFE5E7EB",
  weekYellow: "FFFDE047",
  sectionBeige: "FFF3E6B3",
  todayGreen: "FF7CB342",
  receivedGreen: "FF6AA84F",
  completedGreen: "FF34A853",
  inProgressBlue: "FF3B82F6",
  pendingAmber: "FFF59E0B",
  leaveBlue: "FF4FC3F7",
  notReceivedRed: "FFFF0000",
  holidayPink: "FFE88CE8",
  weeklyOffGray: "FFE5E7EB"
};

const RECEIVED_STATUSES = new Set(["Received", "Not Received", "Leave"]);

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
  if (status === "-") return "-";
  if (status === "Received") return "Received";
  if (status === "Completed") return "Completed";
  if (status === "Pending") return "Pending";
  if (status === "Leave") return "No / On Leave";
  if (status === "Holiday") return "Holiday";
  if (status === "Weekly Off") return "Weekly Off";
  return "Not Received";
};

const OFF_DAY_STATUSES = new Set(["Holiday", "Weekly Off"]);

const getDateBounds = (dateRange, anchorDateText) => {
  const anchor = anchorDateText ? new Date(`${anchorDateText}T00:00:00`) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return { startDate: fallback, endDate: fallback };
  }

  anchor.setHours(0, 0, 0, 0);

  if (dateRange === "today") {
    return { startDate: anchor, endDate: anchor };
  }

  if (dateRange === "month") {
    return {
      startDate: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      endDate: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    };
  }

  const day = anchor.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startDate: start, endDate: end };
};

const toDateText = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const taskFallsWithinRange = (task, rangeStart, rangeEnd) => {
  const taskDateValue = new Date(task.created_at);
  if (Number.isNaN(taskDateValue.getTime())) {
    return false;
  }

  const taskDate = new Date(taskDateValue.getFullYear(), taskDateValue.getMonth(), taskDateValue.getDate());
  return taskDate >= rangeStart && taskDate <= rangeEnd;
};

const formatDateTimeText = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatUtcDateTimeText = (value) => {
  if (!value) return "-";

  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(rawValue)
    ? `${rawValue.replace(" ", "T")}Z`
    : rawValue;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const formatDayText = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const getWeekLabelForDate = (value, rangeStart) => {
  if (!value || !rangeStart) {
    return "Week 1";
  }

  const targetDate = new Date(value);
  const startDate = new Date(rangeStart);
  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(startDate.getTime())) {
    return "Week 1";
  }

  targetDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  if (targetDate < startDate) {
    return "Week 1";
  }

  const cursor = new Date(startDate);
  let weekNumber = 1;

  while (cursor < targetDate) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor <= targetDate && cursor.getDay() === 1) {
      weekNumber += 1;
    }
  }

  return `Week ${weekNumber}`;
};

const getDetailedGroupKey = (task, dateRange) => {
  if (dateRange === "month") {
    return task.groupLabel || `week-unknown-${task.id}`;
  }

  return String(task.created_at || "").slice(0, 10) || `unknown-${task.id}`;
};

const getDetailedGroupLabel = (task, dateRange) => {
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

const shouldIncludeRowInExport = (row) => {
  if (!row) {
    return false;
  }

  const isHolidayOrSunday = Boolean(row.holidayTitle) || String(row.day).toLowerCase() === "sunday";
  if (!isHolidayOrSunday) {
    return true;
  }

  return (row.employees || []).some((entry) => !OFF_DAY_STATUSES.has(normalizeStatus(entry.status)));
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
  const [reportType, setReportType] = useState("received");
  const [team, setTeam] = useState(initialTeam);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(() => {
    if (!initialEmployeeId || initialEmployeeId === "all") {
      return [];
    }

    return [String(initialEmployeeId)];
  });
  const [gridData, setGridData] = useState({ employees: [], rows: [], summary: { received: 0, notReceived: 0, leave: 0 } });
  const [detailedTasks, setDetailedTasks] = useState([]);
  const [detailedSummary, setDetailedSummary] = useState({ total: 0, completed: 0, inProgress: 0, pending: 0 });
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCellId, setLoadingCellId] = useState(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [message, setMessage] = useState("");
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: ""
  });
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayRemovingId, setHolidayRemovingId] = useState(null);

  const employeeOptions = useMemo(() => {
    const scoped =
      role === "admin" || team === "all"
        ? directoryUsers
        : directoryUsers.filter((item) => item.team === team);

    return scoped.map((entry) => ({
      id: entry.id,
      name: entry.name,
      team: toTeamLabel(entry.team)
    }));
  }, [directoryUsers, role, team]);

  const teamOptions = useMemo(() => {
    const entries = new Set(directoryUsers.map((item) => item.team).filter(Boolean));
    return Array.from(entries).sort((a, b) => a.localeCompare(b));
  }, [directoryUsers]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const usersRes = role === "admin" ? await authApi.getDepartmentEmployees() : await authApi.getEmployees();
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
    if (!selectedEmployeeIds.length) {
      return;
    }

    const employeeSet = new Set(employeeOptions.map((entry) => String(entry.id)));
    const scopedSelection = selectedEmployeeIds.filter((entry) => employeeSet.has(String(entry)));

    if (scopedSelection.length !== selectedEmployeeIds.length) {
      setSelectedEmployeeIds(scopedSelection);
    }
  }, [employeeOptions, selectedEmployeeIds]);

  const loadHolidays = useCallback(async () => {
    if (role !== "superadmin") return;

    try {
      const response = await reportApi.getHolidays();
      setHolidays(Array.isArray(response.data) ? response.data : []);
    } catch {
      setHolidays([]);
    }
  }, [role]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [tasksRes, usersRes] = await Promise.all([
        taskApi.getTasks(),
        role === "admin" ? authApi.getDepartmentEmployees() : authApi.getEmployees()
      ]);

      const allTasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const users = Array.isArray(usersRes.data) ? usersRes.data : [];

      const teamByUserId = new Map(users.map((entry) => [String(entry.id), entry.team || "-"]));

      const { startDate, endDate } = getDateBounds(dateRange, date);

      const scopedDetailedTasks = allTasks
        .filter((entry) => taskFallsWithinRange(entry, startDate, endDate))
        .filter((entry) => {
          if (team === "all") return true;
          return teamByUserId.get(String(entry.assigned_to)) === team;
        })
        .filter((entry) => {
          if (!selectedEmployeeIds.length) return true;
          return selectedEmployeeIds.includes(String(entry.assigned_to));
        })
        .sort((left, right) => {
          const leftTime = new Date(left.created_at).getTime();
          const rightTime = new Date(right.created_at).getTime();

          if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
            return 0;
          }

          return leftTime - rightTime;
        })
        .map((entry) => ({
          ...entry,
          assigned_to_team: toTeamLabel(teamByUserId.get(String(entry.assigned_to))) || "-",
          day: formatDayText(entry.created_at),
          groupLabel:
            dateRange === "month"
              ? getWeekLabelForDate(entry.created_at, startDate)
              : formatDayText(entry.created_at)
        }));

      setDetailedTasks(scopedDetailedTasks);

      const taskSummary = scopedDetailedTasks.reduce(
        (acc, entry) => {
          acc.total += 1;
          if (entry.status === "Completed") acc.completed += 1;
          else if (entry.status === "In Progress") acc.inProgress += 1;
          else acc.pending += 1;
          return acc;
        },
        { total: 0, completed: 0, inProgress: 0, pending: 0 }
      );

      setDetailedSummary(taskSummary);
      setTotalTasks(allTasks.length);

      if (reportType === "detailed") {
        const startText = toDateText(startDate);
        const endText = toDateText(endDate);
        const reportLabel = startText === endText ? startText : `${startText} to ${endText}`;
        setMessage(`Detailed task report loaded for ${reportLabel}`);
        return;
      }

      const reportParams = {
        dateRange,
        date,
        employeeIds: selectedEmployeeIds.join(",")
      };

      if (role !== "admin") {
        reportParams.team = team;
      }

      const gridRes = await reportApi.getDailyReportGrid(reportParams);

      setGridData(gridRes.data);
      if (role === "superadmin") {
        setHolidays(Array.isArray(gridRes.data?.holidays) ? gridRes.data.holidays : []);
      }
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
  }, [date, dateRange, reportType, role, selectedEmployeeIds, team]);

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
                if (!RECEIVED_STATUSES.has(entry.status)) {
                  return;
                }

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
    if (reportType === "detailed") {
      if (!detailedTasks.length) {
        setMessage("Generate detailed report data before exporting.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Detailed Tasks");
      const headers = [
        "Employee",
        "Team",
        "Client",
        "Task",
        "Action",
        "Status",
        "Dependency",
        "Assigned By",
        "Created At",
        "Completed At"
      ];
      const groupedDetailedTasks = [];
      const groupIndexByKey = new Map();

      detailedTasks.forEach((entry) => {
        const groupKey = getDetailedGroupKey(entry, dateRange);

        if (!groupIndexByKey.has(groupKey)) {
          groupIndexByKey.set(groupKey, groupedDetailedTasks.length);
          groupedDetailedTasks.push({
            key: groupKey,
            label: getDetailedGroupLabel(entry, dateRange),
            tasks: [entry]
          });
          return;
        }

        groupedDetailedTasks[groupIndexByKey.get(groupKey)].tasks.push(entry);
      });

      sheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: header === "Task" || header === "Action" ? 32 : 20
      }));

      sheet.getRow(1).font = { name: "Calibri", size: 11, bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR.headerGray }
      };
      sheet.getRow(1).eachCell((cell) => {
        applyCellStyle(cell, { fillColor: COLOR.headerGray, bold: true });
      });

      groupedDetailedTasks.forEach((group) => {
        const groupRow = sheet.addRow([group.label]);
        sheet.mergeCells(groupRow.number, 1, groupRow.number, headers.length);
        applyCellStyle(groupRow.getCell(1), { fillColor: COLOR.weekYellow, bold: true, align: "left" });

        group.tasks.forEach((entry) => {
          const row = sheet.addRow({
            Employee: entry.assigned_to_name || "-",
            Team: entry.assigned_to_team || "-",
            Client: entry.client || "-",
            Task: entry.task || "-",
            Action: entry.action || "-",
            Status: entry.status || "-",
            Dependency: entry.dependency || "-",
            "Assigned By": entry.assigned_by_name || "-",
            "Created At": formatDateTimeText(entry.created_at),
            "Completed At": formatUtcDateTimeText(entry.completed_at)
          });

          row.eachCell((cell) => {
            applyCellStyle(cell, { fillColor: COLOR.white, align: "left" });
          });

          const statusCell = row.getCell(6);
          if (entry.status === "Completed") {
            applyCellStyle(statusCell, { fillColor: COLOR.completedGreen, bold: true });
          } else if (entry.status === "In Progress") {
            applyCellStyle(statusCell, { fillColor: COLOR.inProgressBlue, bold: true });
          } else if (entry.status === "Pending") {
            applyCellStyle(statusCell, { fillColor: COLOR.pendingAmber, bold: true });
          } else {
            applyCellStyle(statusCell, { fillColor: COLOR.headerGray, bold: true });
          }
        });
      });

      workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([
          buffer
        ], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `detailed-task-report-${date}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });

      return;
    }

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
    applyCellStyle(sheet.getCell(rowCursor, 2), { bold: true });

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

    const exportRows = gridData.rows.filter(shouldIncludeRowInExport);

    const weekMap = new Map();
    exportRows.forEach((row) => {
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
          if (statusValue === "Completed") fillColor = COLOR.completedGreen;
          if (statusValue === "Pending") fillColor = COLOR.pendingAmber;
          if (statusValue === "No / On Leave") fillColor = COLOR.leaveBlue;
          if (statusValue === "Not Received") fillColor = COLOR.notReceivedRed;
          if (statusValue === "Holiday") fillColor = COLOR.holidayPink;
          if (statusValue === "Weekly Off") fillColor = COLOR.weeklyOffGray;

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
  }, [date, dateRange, detailedTasks, gridData.employees, gridData.rows, gridData.startDate, gridData.summary, reportType, totalTasks]);

  const handleSaveHoliday = useCallback(async () => {
    const dateValue = String(holidayForm.date || "").slice(0, 10);
    const titleValue = String(holidayForm.title || "").trim();

    if (!dateValue) {
      setMessage("Please select a holiday date.");
      return;
    }

    if (!titleValue) {
      setMessage("Please enter a holiday title/reason.");
      return;
    }

    setHolidaySaving(true);
    try {
      await reportApi.saveHoliday({ date: dateValue, title: titleValue });
      setMessage(`Holiday saved for ${dateValue}`);
      setHolidayForm((prev) => ({ ...prev, title: "" }));
      await loadHolidays();

      if (gridData.rows.length > 0) {
        await handleGenerate();
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to save holiday.");
    } finally {
      setHolidaySaving(false);
    }
  }, [gridData.rows.length, handleGenerate, holidayForm.date, holidayForm.title, loadHolidays]);

  const handleDeleteHoliday = useCallback(
    async (id) => {
      setHolidayRemovingId(id);
      try {
        await reportApi.deleteHoliday(id);
        setMessage("Holiday removed");
        await loadHolidays();

        if (gridData.rows.length > 0) {
          await handleGenerate();
        }
      } catch (error) {
        setMessage(error?.response?.data?.message || "Failed to remove holiday.");
      } finally {
        setHolidayRemovingId(null);
      }
    },
    [gridData.rows.length, handleGenerate, loadHolidays]
  );

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
    if (!initialEmployeeId || initialEmployeeId === "all") {
      setSelectedEmployeeIds([]);
      return;
    }

    setSelectedEmployeeIds([String(initialEmployeeId)]);
  }, [initialEmployeeId]);

  useEffect(() => {
    if (autoGenerateToken > 0) {
      handleGenerate();
    }
  }, [autoGenerateToken, handleGenerate]);

  return (
    <div className="space-y-4">
      <ReportHeader
        reportType={reportType}
        onReportTypeChange={setReportType}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        team={team}
        onTeamChange={setTeam}
        teamOptions={teamOptions}
        selectedEmployeeIds={selectedEmployeeIds}
        onEmployeeSelectionChange={setSelectedEmployeeIds}
        employeeOptions={employeeOptions}
        onGenerate={handleGenerate}
        onExportXlsx={handleExportXlsx}
        loading={loading}
        summary={gridData.summary || { received: 0, notReceived: 0, leave: 0 }}
        totalTasks={totalTasks}
        detailedSummary={detailedSummary}
      />

      {role === "superadmin" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-800">Set Holidays</h3>
          <p className="mt-1 text-sm text-slate-500">
            Select a date and a short title. That date will automatically appear as Holiday in report grid and Excel export.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="md:col-span-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Holiday Date</span>
              <input
                type="date"
                value={holidayForm.date}
                onChange={(event) =>
                  setHolidayForm((prev) => ({
                    ...prev,
                    date: event.target.value
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Holiday Title / Reason</span>
              <input
                type="text"
                maxLength={140}
                placeholder="Example: Holi / Company Offsite"
                value={holidayForm.title}
                onChange={(event) =>
                  setHolidayForm((prev) => ({
                    ...prev,
                    title: event.target.value
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </label>

            <div className="md:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleSaveHoliday}
                disabled={holidaySaving}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {holidaySaving ? "Saving..." : "Set Holiday"}
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
            {holidays.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">No holidays configured yet.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {holidays.map((holiday) => (
                  <li key={holiday.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{holiday.date}</p>
                      <p className="text-xs text-slate-600">{holiday.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      disabled={holidayRemovingId === holiday.id}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {holidayRemovingId === holiday.id ? "Removing..." : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {message ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</div> : null}

      <div className="bg-white">
        {reportType === "received" ? (
          <ReportGrid
            rows={gridData.rows}
            employees={gridData.employees}
            onCellChange={handleCellChange}
            loadingCellId={loadingCellId}
          />
        ) : (
          <ReportTaskDetailTable tasks={detailedTasks} dateRange={dateRange} />
        )}
      </div>
    </div>
  );
}

export default ReportPage;
