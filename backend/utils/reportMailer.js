import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { generateDailyReports, getAutomatedReportEmailSummary } from "../models/reportModel.js";

const REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Kolkata";
const REPORT_DETAILS_URL = "http://192.168.1.14:5173/login";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_FONT_STACK = "Arial, Helvetica, sans-serif";
const REPORT_BRAND_NAME = "CludoSI 360";
const REPORT_LOGO_PATH = path.resolve(__dirname, "../../frontend/src/assets/logo.png");
const REPORT_WORDMARK_PATH = path.resolve(__dirname, "../assets/cludosi360-wordmark.png");
const REPORT_LOGO_CID = "cludosi360-report-logo";
const REPORT_WORDMARK_CID = "cludosi360-report-wordmark";
const REPORT_LOGO_WIDTH = 168;
const REPORT_WORDMARK_WIDTH = 286;
const TABLE_BORDER_COLOR = "#d7e8e4";
const HEADER_CELL_STYLE = `font-family: ${EMAIL_FONT_STACK}; font-size: 11px; line-height: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; text-align: left; padding: 11px 10px; border: 1px solid #9fcfc8; background-color: #c6e4df;`;
const BODY_CELL_BASE_STYLE = `font-family: ${EMAIL_FONT_STACK}; font-size: 12px; line-height: 17px; color: #0f172a; padding: 10px 10px; border: 1px solid ${TABLE_BORDER_COLOR}; mso-line-height-rule: exactly;`;

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

const getReportTitle = (reportType) => `DSR ${reportType} Summary`;

const getReportSubtitle = ({ rangeLabel }) => `Report window: ${rangeLabel}`;

const buildSummaryText = ({ reportType, summary }) => {
  const rangeLabel = getRangeLabel(summary.startDate, summary.endDate);
  const useDailyYesNo = isDailyReport({ reportType, summary });
  const lines = [
    getReportTitle(reportType),
    getReportSubtitle({ reportType, rangeLabel }),
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
  const rangeLabelText = getRangeLabel(summary.startDate, summary.endDate);
  const rangeLabel = escapeHtml(rangeLabelText);
  const title = escapeHtml(getReportTitle(reportType));
  const subtitle = escapeHtml(getReportSubtitle({ reportType, rangeLabel: rangeLabelText }));
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
          <td style="${HEADER_CELL_STYLE}">${escapeHtml(item.label)}</td>
          <td style="${BODY_CELL_BASE_STYLE}font-size:14px;font-weight:700;">${item.value}</td>
        </tr>
      `
    )
    .join("");

  const employeeHeaderHtml = useDailyYesNo
    ? `
      <tr>
        <th style="${HEADER_CELL_STYLE}">Name</th>
        <th style="${HEADER_CELL_STYLE}">Department</th>
        <th style="${HEADER_CELL_STYLE}">Role</th>
        <th style="${HEADER_CELL_STYLE}">Status</th>
        <th style="${HEADER_CELL_STYLE}">Report Submitted</th>
        <th style="${HEADER_CELL_STYLE}">Leave</th>
        <th style="${HEADER_CELL_STYLE}">On Site</th>
      </tr>
    `
    : `
      <tr>
        <th style="${HEADER_CELL_STYLE}">Name</th>
        <th style="${HEADER_CELL_STYLE}">Department</th>
        <th style="${HEADER_CELL_STYLE}">Role</th>
        <th style="${HEADER_CELL_STYLE}">Submitted</th>
        <th style="${HEADER_CELL_STYLE}">Not Submitted</th>
        <th style="${HEADER_CELL_STYLE}">Leave</th>
        <th style="${HEADER_CELL_STYLE}">On Site</th>
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
            <td style="${BODY_CELL_BASE_STYLE}font-weight:700;">${escapeHtml(employee.name)}</td>
            <td style="${BODY_CELL_BASE_STYLE}">${escapeHtml(employee.team)}</td>
            <td style="${BODY_CELL_BASE_STYLE}text-transform:capitalize;">${escapeHtml(employee.role)}</td>
            <td style="${BODY_CELL_BASE_STYLE}"><span style="${getStatusBadgeStyles(employee.dailyStatus)}padding:4px 7px;font-weight:700;">${escapeHtml(employee.dailyStatus)}</span></td>
            <td style="${BODY_CELL_BASE_STYLE}font-weight:700;">${submittedValue}</td>
            <td style="${BODY_CELL_BASE_STYLE}font-weight:700;">${leaveValue}</td>
            <td style="${BODY_CELL_BASE_STYLE}">${employee.onSiteDays}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td style="${BODY_CELL_BASE_STYLE}font-weight:700;">${escapeHtml(employee.name)}</td>
          <td style="${BODY_CELL_BASE_STYLE}">${escapeHtml(employee.team)}</td>
          <td style="${BODY_CELL_BASE_STYLE}text-transform:capitalize;">${escapeHtml(employee.role)}</td>
          <td style="${BODY_CELL_BASE_STYLE}">${submittedValue}</td>
          <td style="${BODY_CELL_BASE_STYLE}">${notSubmittedValue}</td>
          <td style="${BODY_CELL_BASE_STYLE}">${leaveValue}</td>
          <td style="${BODY_CELL_BASE_STYLE}">${employee.onSiteDays}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;font-family:${EMAIL_FONT_STACK};color:#1f2a22;">
      <tbody>
        <tr>
          <td style="background:#ffffff;color:#1f2a22;padding:20px 24px 18px;border:1px solid ${TABLE_BORDER_COLOR};">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;">
              <tbody>
                <tr>
                  <td style="padding:0 18px 0 0;vertical-align:middle;">
                    <img src="cid:${REPORT_LOGO_CID}" alt="CludoBits" width="${REPORT_LOGO_WIDTH}" style="display:block;width:${REPORT_LOGO_WIDTH}px;max-width:${REPORT_LOGO_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />
                  </td>
                  <td width="1" style="width:1px;padding:0;background:#3f4a54;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="padding:0 0 0 24px;vertical-align:middle;">
                    <img src="cid:${REPORT_WORDMARK_CID}" alt="${REPORT_BRAND_NAME}" width="${REPORT_WORDMARK_WIDTH}" style="display:block;width:${REPORT_WORDMARK_WIDTH}px;max-width:${REPORT_WORDMARK_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />
                  </td>
                </tr>
              </tbody>
            </table>
            <h2 style="margin:0 0 6px;font-size:24px;line-height:1.15;color:#1f2a22;">${title}</h2>
            <p style="margin:0;font-size:14px;line-height:1.4;color:#4b5c52;font-weight:700;">${subtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px;background:#ffffff;">
            <div style="height:1px;line-height:1px;font-size:1px;background:${TABLE_BORDER_COLOR};">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;">
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
          </td>
        </tr>
      </tbody>
    </table>
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
  const subject = `${getReportTitle(reportType)} - ${getRangeLabel(summary.startDate, summary.endDate)}`;
  const fromEmail = String(process.env.REPORT_EMAIL_USER || "").trim();
  const fromName = String(process.env.REPORT_EMAIL_FROM_NAME || "DSR Reports").trim();

  await mailTransporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: recipients.join(", "),
    subject,
    text: buildSummaryText({ reportType, summary }),
    html: buildSummaryHtml({ reportType, summary }),
    attachments: [
      {
        filename: "logo.png",
        path: REPORT_LOGO_PATH,
        cid: REPORT_LOGO_CID
      },
      {
        filename: "cludosi360-wordmark.png",
        path: REPORT_WORDMARK_PATH,
        cid: REPORT_WORDMARK_CID
      }
    ]
  });

  return {
    skipped: false,
    recipientCount: recipients.length,
    employeeCount: summary.employees.length,
    startDate: summary.startDate,
    endDate: summary.endDate
  };
};
