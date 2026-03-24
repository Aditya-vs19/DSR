import { query } from "../config/db.js";

const CELL_STATUSES = ["Received", "Not Received", "Leave"];
let dailyReportTableEnsured = false;
let taskSubmissionColumnsEnsured = false;

const ensureTaskSubmissionColumns = async () => {
  if (taskSubmissionColumnsEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME IN ('submitted_to_hr', 'submitted_to_hr_at')
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("submitted_to_hr")) {
    await query("ALTER TABLE tasks ADD COLUMN submitted_to_hr TINYINT(1) NOT NULL DEFAULT 0");
  }

  if (!columnSet.has("submitted_to_hr_at")) {
    await query("ALTER TABLE tasks ADD COLUMN submitted_to_hr_at TIMESTAMP NULL");
  }

  taskSubmissionColumnsEnsured = true;
};

const ensureDailyReportTable = async () => {
  if (dailyReportTableEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS daily_employee_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_date DATE NOT NULL,
      user_id INT NOT NULL,
      status ENUM('Received', 'Not Received', 'Leave') NOT NULL DEFAULT 'Not Received',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_daily_report_user_date (report_date, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  dailyReportTableEnsured = true;
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const normalizeSqlDate = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return formatDate(new Date(value));
};

const getDateBounds = (dateRange = "week", baseDate = new Date()) => {
  const current = new Date(baseDate);
  current.setHours(0, 0, 0, 0);

  if (dateRange === "month") {
    const start = new Date(current.getFullYear(), current.getMonth(), 1);
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    return { startDate: start, endDate: end };
  }

  const day = current.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { startDate: start, endDate: end };
};

const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const generateDailyReports = async (reportDate) => {
  const sql = `
    INSERT INTO reports (employee_id, date, total_tasks, completed_tasks, pending_tasks, status)
    SELECT
      t.assigned_to AS employee_id,
      ? AS date,
      COUNT(*) AS total_tasks,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN t.status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks,
      'pending' AS status
    FROM tasks t
    WHERE DATE(t.created_at) = ?
    GROUP BY t.assigned_to
    ON DUPLICATE KEY UPDATE
      total_tasks = VALUES(total_tasks),
      completed_tasks = VALUES(completed_tasks),
      pending_tasks = VALUES(pending_tasks),
      status = 'pending'
  `;

  await query(sql, [reportDate, reportDate]);
};

export const getReportsByRole = async ({ role, userId, team }) => {
  await ensureDailyReportTable();

  const baseSql = `
    SELECT
      r.id,
      r.employee_id,
      r.date,
      r.total_tasks,
      r.completed_tasks,
      r.pending_tasks,
      r.status,
      r.validated_by,
      COALESCE(der.status, 'Not Received') AS received_status,
      u.name AS employee_name,
      u.team AS employee_team,
      validator.name AS validated_by_name
    FROM reports r
    JOIN users u ON u.id = r.employee_id
    LEFT JOIN daily_employee_reports der ON der.user_id = r.employee_id AND der.report_date = r.date
    LEFT JOIN users validator ON validator.id = r.validated_by
  `;

  if (role === "employee") {
    return query(`${baseSql} WHERE r.employee_id = ? ORDER BY r.date DESC`, [userId]);
  }

  if (role === "admin") {
    return query(`${baseSql} WHERE u.team = ? ORDER BY r.date DESC`, [team]);
  }

  return query(`${baseSql} ORDER BY r.date DESC`);
};

export const validateReport = async ({ reportId, status, validatedBy }) => {
  const sql = `
    UPDATE reports
    SET status = ?, validated_by = ?
    WHERE id = ?
  `;

  await query(sql, [status, validatedBy, reportId]);
};

export const getSuperAdminAnalytics = async ({ team = "all", date = "" } = {}) => {
  const taskFilters = [];
  const taskParams = [];

  if (team && team !== "all") {
    taskFilters.push("u.team = ?");
    taskParams.push(team);
  }

  if (date) {
    taskFilters.push("DATE(t.created_at) = ?");
    taskParams.push(date);
  }

  const whereClause = taskFilters.length ? `WHERE ${taskFilters.join(" AND ")}` : "";

  const [tasksPerTeam, completionRate, topPerformers] = await Promise.all([
    query(
      `
      SELECT u.team, COUNT(t.id) AS total_tasks
      FROM tasks t
      JOIN users u ON u.id = t.assigned_to
      ${whereClause}
      GROUP BY u.team
      ORDER BY total_tasks DESC
    `,
      taskParams
    ),
    query(
      `
      SELECT
        ROUND(
          (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)) * 100,
          2
        ) AS completion_rate
      FROM tasks t
      JOIN users u ON u.id = t.assigned_to
      ${whereClause}
    `,
      taskParams
    ),
    query(
      `
      SELECT
        u.id,
        u.name,
        u.team,
        SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
        COUNT(t.id) AS total_tasks,
        ROUND(
          (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)) * 100,
          2
        ) AS productivity_score
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id
      WHERE u.role = 'employee'
        ${team && team !== "all" ? "AND u.team = ?" : ""}
        ${date ? "AND DATE(t.created_at) = ?" : ""}
      GROUP BY u.id, u.name, u.team
      ORDER BY productivity_score DESC
      LIMIT 10
    `,
      [
        ...(team && team !== "all" ? [team] : []),
        ...(date ? [date] : [])
      ]
    )
  ]);

  return {
    tasksPerTeam,
    completionRate: completionRate[0]?.completion_rate || 0,
    topPerformers
  };
};

export const getDailyReportGridByRole = async ({
  role,
  userId,
  team,
  dateRange = "week",
  date,
  teamFilter = "all",
  employeeId = "all"
}) => {
  await ensureDailyReportTable();

  const { startDate, endDate } = getDateBounds(dateRange, date ? new Date(date) : new Date());

  let usersSql = "";
  let usersParams = [];

  if (role === "admin") {
    usersSql = `
      SELECT id, name, email, role, team
      FROM users
      WHERE team = ? AND role IN ('employee', 'admin')
      ORDER BY role DESC, name
    `;
    usersParams = [team];
  } else {
    usersSql = `
      SELECT id, name, email, role, team
      FROM users
      WHERE role IN ('employee', 'admin')
        ${teamFilter && teamFilter !== "all" ? "AND team = ?" : ""}
      ORDER BY team, role DESC, name
    `;
    usersParams = teamFilter && teamFilter !== "all" ? [teamFilter] : [];
  }

  let users = await query(usersSql, usersParams);

  if (employeeId && employeeId !== "all") {
    users = users.filter((entry) => String(entry.id) === String(employeeId));
  }

  const dates = getDatesInRange(startDate, endDate);
  if (users.length === 0 || dates.length === 0) {
    return {
      dateRange,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      employees: [],
      rows: [],
      summary: { received: 0, notReceived: 0, leave: 0 }
    };
  }

  const seedValues = [];
  const seedParams = [];
  for (const day of dates) {
    const dateText = formatDate(day);
    for (const employee of users) {
      seedValues.push("(?, ?, 'Not Received')");
      seedParams.push(dateText, employee.id);
    }
  }

  await query(
    `
      INSERT IGNORE INTO daily_employee_reports (report_date, user_id, status)
      VALUES ${seedValues.join(",")}
    `,
    seedParams
  );

  const idPlaceholders = users.map(() => "?").join(",");
  const cells = await query(
    `
      SELECT
        der.id,
        der.report_date,
        der.user_id,
        der.status,
        u.name,
        u.team
      FROM daily_employee_reports der
      JOIN users u ON u.id = der.user_id
      WHERE der.report_date BETWEEN ? AND ?
        AND der.user_id IN (${idPlaceholders})
      ORDER BY der.report_date, u.name
    `,
    [formatDate(startDate), formatDate(endDate), ...users.map((entry) => entry.id)]
  );

  const cellMap = new Map(
    cells.map((entry) => [
      `${normalizeSqlDate(entry.report_date)}-${entry.user_id}`,
      entry
    ])
  );

  const rows = dates.map((day) => {
    const dateText = formatDate(day);
    const dayName = day.toLocaleDateString("en-US", { weekday: "long" });
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    const employees = users.map((employee) => {
      const cell = cellMap.get(`${dateText}-${employee.id}`);

      return {
        reportId: cell?.id || null,
        userId: employee.id,
        name: employee.name,
        status: CELL_STATUSES.includes(cell?.status) ? cell.status : "Not Received"
      };
    });

    return {
      date: dateText,
      day: dayName,
      isWeekend,
      employees
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      row.employees.forEach((entry) => {
        if (entry.status === "Received") {
          acc.received += 1;
        } else if (entry.status === "Leave") {
          acc.leave += 1;
        } else {
          acc.notReceived += 1;
        }
      });
      return acc;
    },
    { received: 0, notReceived: 0, leave: 0 }
  );

  return {
    dateRange,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    employees: users.map((entry) => ({
      id: entry.id,
      name: entry.name,
      team: entry.team,
      role: entry.role
    })),
    rows,
    summary
  };
};

export const getDailyReportCellById = async (id) => {
  await ensureDailyReportTable();

  const rows = await query(
    `
      SELECT der.id, der.user_id, der.status, der.report_date, u.team
      FROM daily_employee_reports der
      JOIN users u ON u.id = der.user_id
      WHERE der.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

export const updateDailyReportCellStatus = async (id, status) => {
  await ensureDailyReportTable();

  await query(
    "UPDATE daily_employee_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, id]
  );
};

export const submitEmployeeDailyReport = async ({ employeeId, date }) => {
  await ensureDailyReportTable();
  await ensureTaskSubmissionColumns();

  const taskSummaryRows = await query(
    `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks
      FROM tasks
      WHERE assigned_to = ? AND DATE(created_at) = ?
    `,
    [employeeId, date]
  );

  const taskSummary = taskSummaryRows[0] || { total_tasks: 0, completed_tasks: 0, pending_tasks: 0 };
  if (Number(taskSummary.total_tasks) === 0) {
    return { submitted: false, ...taskSummary };
  }

  await query(
    `
      UPDATE tasks
      SET submitted_to_hr = 1,
          submitted_to_hr_at = CURRENT_TIMESTAMP
      WHERE assigned_to = ? AND DATE(created_at) = ?
    `,
    [employeeId, date]
  );

  await query(
    `
      INSERT INTO reports (employee_id, date, total_tasks, completed_tasks, pending_tasks, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
      ON DUPLICATE KEY UPDATE
        total_tasks = VALUES(total_tasks),
        completed_tasks = VALUES(completed_tasks),
        pending_tasks = VALUES(pending_tasks)
    `,
    [
      employeeId,
      date,
      Number(taskSummary.total_tasks || 0),
      Number(taskSummary.completed_tasks || 0),
      Number(taskSummary.pending_tasks || 0)
    ]
  );

  await query(
    `
      INSERT INTO daily_employee_reports (report_date, user_id, status)
      VALUES (?, ?, 'Received')
      ON DUPLICATE KEY UPDATE status = 'Received', updated_at = CURRENT_TIMESTAMP
    `,
    [date, employeeId]
  );

  return { submitted: true, ...taskSummary };
};

export const getReportDetailsById = async (reportId) => {
  await ensureTaskSubmissionColumns();
  await ensureDailyReportTable();

  const reportRows = await query(
    `
      SELECT
        r.id,
        r.employee_id,
        r.date,
        r.total_tasks,
        r.completed_tasks,
        r.pending_tasks,
        r.status,
        COALESCE(der.status, 'Not Received') AS received_status,
        u.name AS employee_name,
        u.team AS employee_team
      FROM reports r
      JOIN users u ON u.id = r.employee_id
      LEFT JOIN daily_employee_reports der ON der.user_id = r.employee_id AND der.report_date = r.date
      WHERE r.id = ?
      LIMIT 1
    `,
    [reportId]
  );

  const report = reportRows[0] || null;
  if (!report) {
    return null;
  }

  const tasks = await query(
    `
      SELECT
        id,
        client,
        task,
        action,
        CASE WHEN status = 'In Progress' THEN 'Pending' ELSE status END AS status,
        dependency,
        created_at,
        completed_at,
        submitted_to_hr,
        submitted_to_hr_at
      FROM tasks
      WHERE assigned_to = ?
        AND DATE(created_at) = ?
      ORDER BY created_at DESC
    `,
    [report.employee_id, report.date]
  );

  return { report, tasks };
};
