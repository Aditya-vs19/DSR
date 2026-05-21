import { query } from "../config/db.js";

const CELL_STATUSES = ["Received", "Not Received", "Leave", "On Site"];
const REPORT_TIMEZONE_OFFSET = "+05:30";
let dailyReportTableEnsured = false;
let taskSubmissionColumnsEnsured = false;
let holidaysTableEnsured = false;
let taskDateColumnEnsured = false;
let userLifecycleColumnsEnsured = false;

const ensureUserLifecycleColumns = async () => {
  if (userLifecycleColumnsEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'employment_end_date'
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("employment_end_date")) {
    await query("ALTER TABLE users ADD COLUMN employment_end_date DATE NULL");
  }

  userLifecycleColumnsEnsured = true;
};

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
      status ENUM('Received', 'Not Received', 'Leave', 'On Site') NOT NULL DEFAULT 'Not Received',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_daily_report_user_date (report_date, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const statusColumns = await query(
    `
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'daily_employee_reports'
        AND COLUMN_NAME = 'status'
      LIMIT 1
    `
  );

  const statusColumnType = String(statusColumns[0]?.COLUMN_TYPE || "");
  if (!statusColumnType.includes("'On Site'")) {
    await query(
      "ALTER TABLE daily_employee_reports MODIFY COLUMN status ENUM('Received', 'Not Received', 'Leave', 'On Site') NOT NULL DEFAULT 'Not Received'"
    );
  }

  dailyReportTableEnsured = true;
};

const ensureHolidaysTable = async () => {
  if (holidaysTableEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS report_holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      holiday_date DATE NOT NULL UNIQUE,
      title VARCHAR(140) NOT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  holidaysTableEnsured = true;
};

const ensureTaskDateColumn = async () => {
  if (taskDateColumnEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME = 'task_date'
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("task_date")) {
    await query("ALTER TABLE tasks ADD COLUMN task_date DATE NULL");
    await query("UPDATE tasks SET task_date = DATE(created_at) WHERE task_date IS NULL");
    await query("ALTER TABLE tasks MODIFY COLUMN task_date DATE NOT NULL");
  } else {
    await query("UPDATE tasks SET task_date = DATE(created_at) WHERE task_date IS NULL");
  }

  taskDateColumnEnsured = true;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const getSaturdayOccurrence = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || date.getDay() !== 6) {
    return 0;
  }

  return Math.floor((date.getDate() - 1) / 7) + 1;
};

const isDefaultWeeklyOffDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }

  if (date.getDay() === 0) {
    return true;
  }

  if (date.getDay() !== 6) {
    return false;
  }

  const saturdayOccurrence = getSaturdayOccurrence(date);
  return saturdayOccurrence === 1 || saturdayOccurrence === 3;
};

const getDateBounds = (dateRange = "week", baseDate = new Date(), customStartDate = "", customEndDate = "") => {
  if (dateRange === "custom") {
    const customStart = customStartDate ? new Date(customStartDate) : new Date();
    const customFinish = customEndDate ? new Date(customEndDate) : new Date(customStart);

    customStart.setHours(0, 0, 0, 0);
    customFinish.setHours(0, 0, 0, 0);

    if (Number.isNaN(customStart.getTime()) || Number.isNaN(customFinish.getTime())) {
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return { startDate: fallback, endDate: fallback };
    }

    return customStart <= customFinish
      ? { startDate: customStart, endDate: customFinish }
      : { startDate: customFinish, endDate: customStart };
  }

  const current = new Date(baseDate);
  current.setHours(0, 0, 0, 0);

  if (dateRange === "today") {
    return { startDate: current, endDate: current };
  }

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

const parseDateOnly = (value) => {
  const [year, month, day] = String(value || "").slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const upsertHoliday = async ({ date, title, createdBy }) => {
  await ensureHolidaysTable();

  await query(
    `
      INSERT INTO report_holidays (holiday_date, title, created_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        created_by = VALUES(created_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [date, title, createdBy || null]
  );
};

export const listHolidays = async ({ startDate = "", endDate = "" } = {}) => {
  await ensureHolidaysTable();

  const hasStart = Boolean(startDate);
  const hasEnd = Boolean(endDate);

  if (hasStart && hasEnd) {
    return query(
      `
        SELECT id, holiday_date, title, created_by, created_at, updated_at
        FROM report_holidays
        WHERE holiday_date BETWEEN ? AND ?
        ORDER BY holiday_date ASC
      `,
      [startDate, endDate]
    );
  }

  if (hasStart) {
    return query(
      `
        SELECT id, holiday_date, title, created_by, created_at, updated_at
        FROM report_holidays
        WHERE holiday_date >= ?
        ORDER BY holiday_date ASC
      `,
      [startDate]
    );
  }

  if (hasEnd) {
    return query(
      `
        SELECT id, holiday_date, title, created_by, created_at, updated_at
        FROM report_holidays
        WHERE holiday_date <= ?
        ORDER BY holiday_date ASC
      `,
      [endDate]
    );
  }

  return query(
    `
      SELECT id, holiday_date, title, created_by, created_at, updated_at
      FROM report_holidays
      ORDER BY holiday_date DESC
      LIMIT 200
    `
  );
};

export const deleteHolidayById = async (id) => {
  await ensureHolidaysTable();
  return query("DELETE FROM report_holidays WHERE id = ?", [id]);
};

export const generateDailyReports = async (reportDate) => {
  await ensureTaskDateColumn();

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
    WHERE t.task_date = ?
    GROUP BY t.assigned_to
    ON DUPLICATE KEY UPDATE
      total_tasks = VALUES(total_tasks),
      completed_tasks = VALUES(completed_tasks),
      pending_tasks = VALUES(pending_tasks),
      status = 'pending'
  `;

  await query(sql, [reportDate, reportDate]);
};

export const getReportsByRole = async ({ role, userId, team, managedTeams = [] }) => {
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
    const teams = Array.isArray(managedTeams) && managedTeams.length > 0 ? managedTeams : [team];
    const placeholders = teams.map(() => "?").join(",");
    return query(`${baseSql} WHERE u.team IN (${placeholders}) OR u.id = ? ORDER BY r.date DESC`, [...teams, userId]);
  }

  return query(`${baseSql} ORDER BY r.date DESC`);
};

export const validateReport = async ({ reportId, status, validatedBy }) => {
  const sql = `
    UPDATE reports
    SET status = ?, validated_by = ?
    WHERE id = ?
  `;

  return query(sql, [status, validatedBy, reportId]);
};

export const getSuperAdminAnalytics = async ({ team = "all", date = "" } = {}) => {
  await ensureTaskDateColumn();

  const taskFilters = [];
  const taskParams = [];

  if (team && team !== "all") {
    taskFilters.push("u.team = ?");
    taskParams.push(team);
  }

  if (date) {
    taskFilters.push("t.task_date = ?");
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
        ${date ? "AND t.task_date = ?" : ""}
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
  managedTeams = [],
  dateRange = "week",
  date,
  customStartDate = "",
  customEndDate = "",
  teamFilter = "all",
  employeeId = "all",
  employeeIds = []
}) => {
  await ensureDailyReportTable();
  await ensureHolidaysTable();
  await ensureTaskDateColumn();
  await ensureUserLifecycleColumns();

  const { startDate, endDate } = getDateBounds(
    dateRange,
    date ? new Date(date) : new Date(),
    customStartDate,
    customEndDate
  );
  const superadminRoleFilter = role === "superadmin" ? "('employee', 'admin')" : "('employee')";

  let usersSql = "";
  let usersParams = [];

  if (role === "admin") {
    const teams = Array.isArray(managedTeams) && managedTeams.length > 0 ? managedTeams : [team];
    const scopedTeams =
      teamFilter && teamFilter !== "all" ? teams.filter((entry) => entry === teamFilter) : teams;

    if (scopedTeams.length === 0) {
      return {
        dateRange,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        employees: [],
        rows: [],
        summary: { received: 0, notReceived: 0, leave: 0, onSite: 0 },
        taskSummary: { total: 0, completed: 0, pending: 0 },
        holidays: []
      };
    }

    const placeholders = scopedTeams.map(() => "?").join(",");
    usersSql = `
      SELECT id, name, email, role, team, employment_end_date
      FROM users
      WHERE ((team IN (${placeholders}) AND role = 'employee')
         OR id = ?
      )
        AND (employment_end_date IS NULL OR employment_end_date > ?)
      ORDER BY role DESC, name
    `;
    usersParams = [...scopedTeams, userId, formatDate(startDate)];
  } else {
    usersSql = `
      SELECT id, name, email, role, team, employment_end_date
      FROM users
      WHERE role IN ${superadminRoleFilter}
        ${teamFilter && teamFilter !== "all" ? "AND team = ?" : ""}
        AND (employment_end_date IS NULL OR employment_end_date > ?)
      ORDER BY team, role DESC, name
    `;
    usersParams = [
      ...(teamFilter && teamFilter !== "all" ? [teamFilter] : []),
      formatDate(startDate)
    ];
  }

  let users = await query(usersSql, usersParams);

  const normalizedEmployeeIds = Array.isArray(employeeIds)
    ? employeeIds
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0)
    : [];

  if (normalizedEmployeeIds.length > 0) {
    const employeeIdSet = new Set(normalizedEmployeeIds.map((entry) => String(entry)));
    users = users.filter((entry) => employeeIdSet.has(String(entry.id)));
  } else if (employeeId && employeeId !== "all") {
    users = users.filter((entry) => String(entry.id) === String(employeeId));
  }

  const dates = getDatesInRange(startDate, endDate);

  const todayRows = await query(
    `SELECT DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${REPORT_TIMEZONE_OFFSET}'), '%Y-%m-%d') AS today`
  );
  const todayInReportTimezone = todayRows[0]?.today || formatDate(new Date());

  const holidays = await listHolidays({
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  });
  const holidayByDate = new Map(
    holidays.map((entry) => [normalizeSqlDate(entry.holiday_date), entry])
  );

  if (users.length === 0 || dates.length === 0) {
    return {
      dateRange,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      employees: [],
      rows: [],
      summary: { received: 0, notReceived: 0, leave: 0, onSite: 0 },
      taskSummary: { total: 0, completed: 0, pending: 0 },
      holidays: holidays.map((entry) => ({
        id: entry.id,
        date: normalizeSqlDate(entry.holiday_date),
        title: entry.title
      }))
    };
  }

  const seedValues = [];
  const seedParams = [];
  for (const day of dates) {
    const dateText = formatDate(day);
    if (holidayByDate.has(dateText)) {
      continue;
    }

    for (const employee of users) {
      seedValues.push("(?, ?, 'Not Received')");
      seedParams.push(dateText, employee.id);
    }
  }

  if (seedValues.length > 0) {
    await query(
      `
        INSERT IGNORE INTO daily_employee_reports (report_date, user_id, status)
        VALUES ${seedValues.join(",")}
      `,
      seedParams
    );
  }

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

  let weekNumber = 1;

  const rows = dates.map((day, index) => {
    if (index > 0 && day.getDay() === 1) {
      weekNumber += 1;
    }

    const dateText = formatDate(day);
    const holiday = holidayByDate.get(dateText);
    const dayName = day.toLocaleDateString("en-US", { weekday: "long" });
    const isSunday = day.getDay() === 0;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isHoliday = Boolean(holiday);
    const isDefaultWeeklyOff = isDefaultWeeklyOffDate(day);
    const isFutureDate = dateText > todayInReportTimezone;

    const employees = users.map((employee) => {
      const cell = cellMap.get(`${dateText}-${employee.id}`);
      const cellStatus = CELL_STATUSES.includes(cell?.status) ? cell.status : "Not Received";

      if (isFutureDate) {
        return {
          reportId: null,
          userId: employee.id,
          name: employee.name,
          status: "-"
        };
      }

      if (isDefaultWeeklyOff || isHoliday) {
        if (cellStatus === "Received" || cellStatus === "Leave" || cellStatus === "On Site") {
          return {
            reportId: cell?.id || null,
            userId: employee.id,
            name: employee.name,
            status: cellStatus
          };
        }

        return {
          reportId: null,
          userId: employee.id,
          name: employee.name,
          status: isHoliday ? "Holiday" : "Weekly Off"
        };
      }

      return {
        reportId: cell?.id || null,
        userId: employee.id,
        name: employee.name,
        status: cellStatus
      };
    });

    return {
      date: dateText,
      day: dayName,
      weekLabel: `Week ${weekNumber}`,
      isWeekend,
      isDefaultWeeklyOff,
      holidayTitle: holiday?.title || "",
      employees
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      row.employees.forEach((entry) => {
        if (!CELL_STATUSES.includes(entry.status)) {
          return;
        }

        if (entry.status === "Received") {
          acc.received += 1;
        } else if (entry.status === "Leave") {
          acc.leave += 1;
        } else if (entry.status === "On Site") {
          acc.onSite += 1;
        } else {
          acc.notReceived += 1;
        }
      });
      return acc;
    },
    { received: 0, notReceived: 0, leave: 0, onSite: 0 }
  );

  const taskSummaryRows = await query(
    `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks
      FROM tasks
      WHERE task_date BETWEEN ? AND ?
        AND assigned_to IN (${idPlaceholders})
    `,
    [formatDate(startDate), formatDate(endDate), ...users.map((entry) => entry.id)]
  );

  const taskSummary = taskSummaryRows[0] || {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0
  };

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
    summary,
    taskSummary: {
      total: Number(taskSummary.total_tasks || 0),
      completed: Number(taskSummary.completed_tasks || 0),
      pending: Number(taskSummary.pending_tasks || 0)
    },
    holidays: holidays.map((entry) => ({
      id: entry.id,
      date: normalizeSqlDate(entry.holiday_date),
      title: entry.title
    }))
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

export const hasReceivedDailyReport = async ({ userId, date }) => {
  await ensureDailyReportTable();

  const rows = await query(
    `
      SELECT id
      FROM daily_employee_reports
      WHERE user_id = ?
        AND report_date = ?
        AND status = 'Received'
      LIMIT 1
    `,
    [userId, date]
  );

  return rows.length > 0;
};

export const submitEmployeeDailyReport = async ({ employeeId, date, onlySelfAssigned = false }) => {
  await ensureDailyReportTable();
  await ensureTaskSubmissionColumns();
  await ensureTaskDateColumn();
  const alreadyReceived = await hasReceivedDailyReport({ userId: employeeId, date });

  const selfTaskFilterClause = onlySelfAssigned ? "AND type = 'self'" : "";

  const taskSummaryRows = await query(
    `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks
      FROM tasks
      WHERE assigned_to = ?
        AND task_date = ?
        ${selfTaskFilterClause}
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
      WHERE assigned_to = ?
        AND task_date = ?
        ${selfTaskFilterClause}
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

  return { submitted: true, resubmitted: alreadyReceived, ...taskSummary };
};

export const getReportDetailsById = async (reportId) => {
  await ensureTaskSubmissionColumns();
  await ensureDailyReportTable();
  await ensureTaskDateColumn();

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
      WITH RECURSIVE task_origin AS (
        SELECT
          id,
          carried_forward_from_id,
          created_at AS root_created_at
        FROM tasks

        UNION ALL

        SELECT
          child.id,
          child.carried_forward_from_id,
          task_origin.root_created_at
        FROM tasks child
        INNER JOIN task_origin ON task_origin.id = child.carried_forward_from_id
      )
      SELECT
        t.id,
        t.client,
        t.task,
        t.action,
        t.status,
        t.dependency,
        DATE_FORMAT(COALESCE(task_origin.root_created_at, t.created_at), '%Y-%m-%d %H:%i:%s') AS assigned_at,
        t.created_at,
        t.completed_at,
        t.submitted_to_hr,
        t.submitted_to_hr_at
      FROM tasks t
      LEFT JOIN task_origin ON task_origin.id = t.id
      WHERE t.assigned_to = ?
        AND t.task_date = ?
      ORDER BY t.created_at DESC
    `,
    [report.employee_id, report.date]
  );

  return { report, tasks };
};

export const getAutomatedReportEmailSummary = async ({ startDate, endDate }) => {
  await ensureDailyReportTable();
  await ensureHolidaysTable();
  await ensureTaskDateColumn();
  await ensureUserLifecycleColumns();

  const parsedStartDate = parseDateOnly(startDate);
  const parsedEndDate = parseDateOnly(endDate);

  if (!parsedStartDate || !parsedEndDate) {
    throw new Error("Invalid date range provided for email summary");
  }

  const effectiveStartDate = parsedStartDate <= parsedEndDate ? parsedStartDate : parsedEndDate;
  const effectiveEndDate = parsedStartDate <= parsedEndDate ? parsedEndDate : parsedStartDate;
  const normalizedStartDate = formatDate(effectiveStartDate);
  const normalizedEndDate = formatDate(effectiveEndDate);

  const users = await query(
    `
      SELECT id, name, email, role, team, employment_end_date
      FROM users
      WHERE role IN ('employee', 'admin')
        AND (employment_end_date IS NULL OR employment_end_date > ?)
      ORDER BY team ASC, role DESC, name ASC
    `,
    [normalizedStartDate]
  );

  const dates = getDatesInRange(effectiveStartDate, effectiveEndDate);
  const holidays = await listHolidays({
    startDate: normalizedStartDate,
    endDate: normalizedEndDate
  });
  const holidayByDate = new Map(
    holidays.map((entry) => [normalizeSqlDate(entry.holiday_date), entry])
  );

  if (users.length > 0 && dates.length > 0) {
    const seedValues = [];
    const seedParams = [];

    for (const day of dates) {
      const dateText = formatDate(day);
      if (holidayByDate.has(dateText) || isDefaultWeeklyOffDate(day)) {
        continue;
      }

      for (const user of users) {
        seedValues.push("(?, ?, 'Not Received')");
        seedParams.push(dateText, user.id);
      }
    }

    if (seedValues.length > 0) {
      await query(
        `
          INSERT IGNORE INTO daily_employee_reports (report_date, user_id, status)
          VALUES ${seedValues.join(",")}
        `,
        seedParams
      );
    }
  }

  const userIds = users.map((entry) => entry.id);

  const statusRows = userIds.length > 0
    ? await query(
      `
        SELECT report_date, user_id, status
        FROM daily_employee_reports
        WHERE report_date BETWEEN ? AND ?
          AND user_id IN (${userIds.map(() => "?").join(",")})
      `,
      [normalizedStartDate, normalizedEndDate, ...userIds]
    )
    : [];

  const taskRows = userIds.length > 0
    ? await query(
      `
        SELECT
          assigned_to AS user_id,
          COUNT(*) AS total_tasks,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
          SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks
        FROM tasks
        WHERE task_date BETWEEN ? AND ?
          AND assigned_to IN (${userIds.map(() => "?").join(",")})
        GROUP BY assigned_to
      `,
      [normalizedStartDate, normalizedEndDate, ...userIds]
    )
    : [];

  const statusMap = new Map(
    statusRows.map((entry) => [
      `${normalizeSqlDate(entry.report_date)}-${entry.user_id}`,
      entry.status
    ])
  );

  const taskMap = new Map(
    taskRows.map((entry) => [Number(entry.user_id), entry])
  );

  const employeeSummaries = users.map((user) => {
    const summary = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team || "-",
      submittedDays: 0,
      notSubmittedDays: 0,
      leaveDays: 0,
      onSiteDays: 0,
      weeklyOffDays: 0,
      holidayDays: 0,
      totalTasks: Number(taskMap.get(Number(user.id))?.total_tasks || 0),
      completedTasks: Number(taskMap.get(Number(user.id))?.completed_tasks || 0),
      pendingTasks: Number(taskMap.get(Number(user.id))?.pending_tasks || 0),
      dailyStatus: "Not Received"
    };

    for (const day of dates) {
      const dateText = formatDate(day);
      const explicitStatus = statusMap.get(`${dateText}-${user.id}`) || "Not Received";
      const isHoliday = holidayByDate.has(dateText);
      const isWeeklyOff = isDefaultWeeklyOffDate(day);

      if (isHoliday) {
        if (explicitStatus === "Received") {
          summary.submittedDays += 1;
        } else if (explicitStatus === "Leave") {
          summary.leaveDays += 1;
        } else if (explicitStatus === "On Site") {
          summary.onSiteDays += 1;
        } else {
          summary.holidayDays += 1;
        }
        continue;
      }

      if (isWeeklyOff) {
        if (explicitStatus === "Received") {
          summary.submittedDays += 1;
        } else if (explicitStatus === "Leave") {
          summary.leaveDays += 1;
        } else if (explicitStatus === "On Site") {
          summary.onSiteDays += 1;
        } else {
          summary.weeklyOffDays += 1;
        }
        continue;
      }

      if (explicitStatus === "Received") {
        summary.submittedDays += 1;
      } else if (explicitStatus === "Leave") {
        summary.leaveDays += 1;
      } else if (explicitStatus === "On Site") {
        summary.onSiteDays += 1;
      } else {
        summary.notSubmittedDays += 1;
      }
    }

    if (normalizedStartDate === normalizedEndDate) {
      const status = statusMap.get(`${normalizedStartDate}-${user.id}`) || "Not Received";
      const dayIsHoliday = holidayByDate.has(normalizedStartDate);
      const dayIsWeeklyOff = isDefaultWeeklyOffDate(effectiveStartDate);

      if ((dayIsHoliday || dayIsWeeklyOff) && status === "Not Received") {
        summary.dailyStatus = dayIsHoliday ? "Holiday" : "Weekly Off";
      } else {
        summary.dailyStatus = status;
      }
    }

    return summary;
  });

  const totals = employeeSummaries.reduce(
    (acc, employee) => {
      acc.submittedDays += employee.submittedDays;
      acc.notSubmittedDays += employee.notSubmittedDays;
      acc.leaveDays += employee.leaveDays;
      acc.onSiteDays += employee.onSiteDays;
      acc.weeklyOffDays += employee.weeklyOffDays;
      acc.holidayDays += employee.holidayDays;
      acc.totalTasks += employee.totalTasks;
      acc.completedTasks += employee.completedTasks;
      acc.pendingTasks += employee.pendingTasks;
      return acc;
    },
    {
      employees: employeeSummaries.length,
      submittedDays: 0,
      notSubmittedDays: 0,
      leaveDays: 0,
      onSiteDays: 0,
      weeklyOffDays: 0,
      holidayDays: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0
    }
  );

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    employees: employeeSummaries,
    totals
  };
};
