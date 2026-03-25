import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ReportHeader from "../components/ReportHeader";
import ReportGrid from "../components/ReportGrid";
import { authApi, reportApi, taskApi } from "../services/api";

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
  const gridRef = useRef(null);

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

  const handleExportPdf = useCallback(async () => {
    if (!gridRef.current || !gridData.rows.length) {
      setMessage("Generate report data before exporting.");
      return;
    }

    const canvas = await html2canvas(gridRef.current, {
      scale: 2,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;

    pdf.addImage(imgData, "PNG", 5, 5, imgWidth - 10, imgHeight - 10);
    pdf.save(`daily-report-${gridData.startDate || date}.pdf`);
  }, [date, gridData.rows.length, gridData.startDate]);

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
        onExportPdf={handleExportPdf}
        loading={loading}
        summary={gridData.summary || { received: 0, notReceived: 0, leave: 0 }}
        totalTasks={totalTasks}
      />

      {message ? <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</div> : null}

      <div ref={gridRef} className="bg-white">
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
