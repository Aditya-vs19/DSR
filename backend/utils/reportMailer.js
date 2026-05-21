import nodemailer from "nodemailer";
import { generateDailyReports, getAutomatedReportEmailSummary } from "../models/reportModel.js";

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Kolkata";
const REPORT_DETAILS_URL = "http://192.168.1.14:5173/login";

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const smtpUser = String(process.env.REPORT_EMAIL_USER || "").trim();
  const smtpPass = String(process.env.REPORT_EMAIL_APP_PASSWORD || "").trim();
  const smtpHost = String(process.env.REPORT_EMAIL_HOST || "").trim();
  const smtpPort = Number(process.env.REPORT_EMAIL_PORT || 587);
  const secure = String(process.env.REPORT_EMAIL_SECURE || "").trim() === "true";

  if (!smtpUser || !smtpPass) {
    return null;
  }

  transporter = smtpHost
    ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })
    : nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

  return transporter;
};

const formatDateText = (dateText) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateText}T00:00:00`));

const getRangeLabel = (startDate, endDate) =>
  startDate === endDate
    ? formatDateText(startDate)
    : `${formatDateText(startDate)} to ${formatDateText(endDate)}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getStatusBadgeStyles = (status) => {
  if (status === "Received") {
    return "background:#e7f7ee;border:1px solid #bde5ca;color:#157347;";
  }

  if (status === "Leave") {
    return "background:#fff4d6;border:1px solid #f3d37a;color:#9a6700;";
  }

  if (status === "On Site") {
    return "background:#e8f3ff;border:1px solid #b8d9ff;color:#0f5ea8;";
  }

  if (status === "Holiday" || status === "Weekly Off") {
    return "background:#eef2f7;border:1px solid #d7dee8;color:#425466;";
  }

  return "background:#fdecec;border:1px solid #f1c2c2;color:#b42318;";
};

const isDailyReport = ({ reportType, summary }) =>
  String(reportType || "").toLowerCase() === "daily" || summary.startDate === summary.endDate;

const formatDailyYesNo = (value) => (Number(value || 0) > 0 ? "Yes" : "No");

const buildSummaryText = ({ reportType, summary }) => {
  const rangeLabel = getRangeLabel(summary.startDate, summary.endDate);
  const useDailyYesNo = isDailyReport({ reportType, summary });
  const lines = [
    `DSR ${reportType} summary for ${rangeLabel}`,
    `Employees: ${summary.totals.employees}`,
    `Submitted days: ${summary.totals.submittedDays}`,
    `Not submitted days: ${summary.totals.notSubmittedDays}`,
    `Leave days: ${summary.totals.leaveDays}`,
    `On site days: ${summary.totals.onSiteDays}`,
    `Completed tasks: ${summary.totals.completedTasks}`,
    `Pending tasks: ${summary.totals.pendingTasks}`,
    `For more precise details visit ${REPORT_DETAILS_URL}`,
    ""
  ];

  summary.employees.forEach((employee) => {
    const submittedValue = useDailyYesNo ? formatDailyYesNo(employee.submittedDays) : employee.submittedDays;
    const notSubmittedValue = useDailyYesNo ? formatDailyYesNo(employee.notSubmittedDays) : employee.notSubmittedDays;
    const leaveValue = useDailyYesNo ? formatDailyYesNo(employee.leaveDays) : employee.leaveDays;

    lines.push(
      `${employee.name} (${employee.team}, ${employee.role}) | ` +
      (useDailyYesNo
        ? `Report Submitted: ${submittedValue} | `
        : `Submitted: ${submittedValue} | Not Submitted: ${notSubmittedValue} | `) +
      `Leave: ${leaveValue} | ` +
      `On Site: ${employee.onSiteDays}` +
      (summary.startDate === summary.endDate ? ` | Status: ${employee.dailyStatus}` : "")
    );
  });

  return lines.join("\n");
};

const buildSummaryHtml = ({ reportType, summary }) => {
  const rangeLabel = escapeHtml(getRangeLabel(summary.startDate, summary.endDate));
  const useDailyYesNo = isDailyReport({ reportType, summary });

  const overviewRowsHtml = [
    { label: "Employees", value: summary.totals.employees },
    { label: "Submitted", value: summary.totals.submittedDays },
    { label: "Not Submitted", value: summary.totals.notSubmittedDays },
    { label: "Leave", value: summary.totals.leaveDays },
    { label: "On Site", value: summary.totals.onSiteDays },
    { label: "Completed Tasks", value: summary.totals.completedTasks },
    { label: "Pending Tasks", value: summary.totals.pendingTasks }
  ]
    .map(
      (item) => `
        <tr>
          <td style="border:1px solid #d6e1d8;background:#edf4ee;padding:10px 12px;font-size:12px;font-weight:700;color:#63756a;text-transform:uppercase;">${escapeHtml(item.label)}</td>
          <td style="border:1px solid #d6e1d8;padding:10px 12px;font-size:14px;font-weight:700;color:#1f2a22;">${item.value}</td>
        </tr>
      `
    )
    .join("");

  const employeeHeaderHtml = useDailyYesNo
    ? `
      <tr>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Name</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Department</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Role</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Status</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Report Submitted</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Leave</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">On Site</th>
      </tr>
    `
    : `
      <tr>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Name</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Department</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Role</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Submitted</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Not Submitted</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">Leave</th>
        <th style="border:1px solid #d6e1d8;background:#2f7f4f;color:#ffffff;padding:10px 8px;font-size:12px;text-align:left;">On Site</th>
      </tr>
    `;

  const employeeRowsHtml = summary.employees
    .map((employee) => {
      const submittedValue = useDailyYesNo ? formatDailyYesNo(employee.submittedDays) : employee.submittedDays;
      const notSubmittedValue = useDailyYesNo ? formatDailyYesNo(employee.notSubmittedDays) : employee.notSubmittedDays;
      const leaveValue = useDailyYesNo ? formatDailyYesNo(employee.leaveDays) : employee.leaveDays;

      if (useDailyYesNo) {
        return `
          <tr>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;font-weight:700;">${escapeHtml(employee.name)}</td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${escapeHtml(employee.team)}</td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;text-transform:capitalize;">${escapeHtml(employee.role)}</td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;"><span style="${getStatusBadgeStyles(employee.dailyStatus)}padding:4px 7px;font-weight:700;">${escapeHtml(employee.dailyStatus)}</span></td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;font-weight:700;">${submittedValue}</td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;font-weight:700;">${leaveValue}</td>
            <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${employee.onSiteDays}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;font-weight:700;">${escapeHtml(employee.name)}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${escapeHtml(employee.team)}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;text-transform:capitalize;">${escapeHtml(employee.role)}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${submittedValue}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${notSubmittedValue}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${leaveValue}</td>
          <td style="border:1px solid #d6e1d8;padding:9px 8px;font-size:12px;color:#1f2a22;">${employee.onSiteDays}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f7f4;padding:24px;color:#1f2a22;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d6e1d8;border-radius:16px;overflow:hidden;">
        <div style="background:#2f7f4f;color:#ffffff;padding:20px 24px;">
          <h2 style="margin:0 0 8px;font-size:24px;">DSR ${escapeHtml(reportType)} Summary</h2>
          <p style="margin:0;font-size:14px;">Report window: ${rangeLabel}</p>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#1f2a22;">
            For more precise details visit
            <a href="${REPORT_DETAILS_URL}" style="color:#2f7f4f;font-weight:700;text-decoration:none;">${REPORT_DETAILS_URL}</a>
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 22px;width:100%;">
            <tbody>${overviewRowsHtml}</tbody>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
            <thead>${employeeHeaderHtml}</thead>
            <tbody>${employeeRowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

export const sendAutomatedReportEmail = async ({ reportType, startDate, endDate, ensureDailyReport = false }) => {
  const recipients = String(process.env.REPORT_EMAIL_TO || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn(`[CRON] ${reportType} report email skipped because REPORT_EMAIL_TO is not configured.`);
    return { skipped: true, reason: "missing-recipient" };
  }

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.warn(`[CRON] ${reportType} report email skipped because email sender credentials are missing.`);
    return { skipped: true, reason: "missing-sender-config" };
  }

  if (ensureDailyReport && startDate === endDate) {
    await generateDailyReports(startDate);
  }

  const summary = await getAutomatedReportEmailSummary({ startDate, endDate });
  const subject = `DSR ${reportType} Summary - ${getRangeLabel(summary.startDate, summary.endDate)}`;
  const fromEmail = String(process.env.REPORT_EMAIL_USER || "").trim();
  const fromName = String(process.env.REPORT_EMAIL_FROM_NAME || "DSR Reports").trim();

  await mailTransporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: recipients.join(", "),
    subject,
    text: buildSummaryText({ reportType, summary }),
    html: buildSummaryHtml({ reportType, summary })
  });

  return {
    skipped: false,
    recipientCount: recipients.length,
    employeeCount: summary.employees.length,
    startDate: summary.startDate,
    endDate: summary.endDate
  };
};
