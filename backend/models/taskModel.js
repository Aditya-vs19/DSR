import { query } from "../config/db.js";

export const createTask = async ({
  client,
  task,
  action,
  status = "Pending",
  dependency,
  assignedTo,
  assignedBy,
  type,
  deadline
}) => {
  const sql = `
    INSERT INTO tasks (
      client, task, action, status, dependency,
      assigned_to, assigned_by, type, deadline
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [
    client,
    task,
    action,
    status,
    dependency || null,
    assignedTo,
    assignedBy,
    type,
    deadline || null
  ]);

  return result.insertId;
};

export const getTasksByRole = async ({ role, userId, team }) => {
  const baseSql = `
    SELECT
      t.id,
      t.client,
      t.task,
      t.action,
      t.status,
      t.dependency,
      t.assigned_to,
      t.assigned_by,
      t.type,
      t.created_at,
      t.completed_at,
      t.deadline,
      assignTo.name AS assigned_to_name,
      assignBy.name AS assigned_by_name
    FROM tasks t
    LEFT JOIN users assignTo ON assignTo.id = t.assigned_to
    LEFT JOIN users assignBy ON assignBy.id = t.assigned_by
  `;

  if (role === "employee") {
    return query(`${baseSql} WHERE t.assigned_to = ? ORDER BY t.created_at DESC`, [userId]);
  }

  if (role === "admin") {
    return query(
      `${baseSql} WHERE assignTo.team = ? OR t.assigned_by = ? ORDER BY t.created_at DESC`,
      [team, userId]
    );
  }

  return query(`${baseSql} ORDER BY t.created_at DESC`);
};

export const getTaskById = async (id) => {
  const rows = await query("SELECT * FROM tasks WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

export const updateTaskStatus = async ({ id, status, dependency }) => {
  const completedAt = status === "Completed" ? new Date() : null;

  const sql = `
    UPDATE tasks
    SET status = ?,
        dependency = ?,
        completed_at = CASE
          WHEN ? = 'Completed' THEN ?
          ELSE completed_at
        END
    WHERE id = ?
  `;

  await query(sql, [status, dependency || null, status, completedAt, id]);
};

export const getEmployeeDailySummary = async (employeeId, date) => {
  const sql = `
    SELECT
      COUNT(*) AS total_tasks,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks
    FROM tasks
    WHERE assigned_to = ? AND DATE(created_at) = ?
  `;

  const rows = await query(sql, [employeeId, date]);
  return rows[0];
};

export const getEmployeeTimeline = async (employeeId, days = 7) => {
  const sql = `
    SELECT
      DATE(completed_at) AS day,
      COUNT(*) AS completed_count
    FROM tasks
    WHERE assigned_to = ?
      AND status = 'Completed'
      AND completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(completed_at)
    ORDER BY DATE(completed_at)
  `;

  return query(sql, [employeeId, days]);
};

export const getTeamPerformance = async (team) => {
  const sql = `
    SELECT
      u.id,
      u.name,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
      ROUND(
        (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)) * 100,
        2
      ) AS completion_rate
    FROM users u
    LEFT JOIN tasks t ON t.assigned_to = u.id
    WHERE u.team = ? AND u.role = 'employee'
    GROUP BY u.id, u.name
    ORDER BY completion_rate DESC
  `;

  return query(sql, [team]);
};

export const createNotification = async ({ userId, message, type = "task_assigned", refId = null }) => {
  const sql = `
    INSERT INTO notifications (user_id, message, type, reference_id)
    VALUES (?, ?, ?, ?)
  `;

  const result = await query(sql, [userId, message, type, refId]);
  return result.insertId;
};

export const getUserNotifications = async (userId) => {
  return query(
    `
    SELECT id, message, type, reference_id, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `,
    [userId]
  );
};

export const markNotificationAsRead = async (id, userId) => {
  await query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, userId]);
};
