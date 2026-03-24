import { query } from "../config/db.js";

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
      u.name AS employee_name,
      u.team AS employee_team,
      validator.name AS validated_by_name
    FROM reports r
    JOIN users u ON u.id = r.employee_id
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
