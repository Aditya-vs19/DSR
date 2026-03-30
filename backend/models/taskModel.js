import { query } from "../config/db.js";

let taskSubmissionColumnsEnsured = false;
let dailyReportTableEnsured = false;
let taskCarryForwardColumnsEnsured = false;
let taskReassignmentColumnsEnsured = false;
let taskPriorityColumnEnsured = false;
let taskDepartmentColumnEnsured = false;

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

const ensureTaskCarryForwardColumns = async () => {
  if (taskCarryForwardColumnsEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME IN ('carried_forward_from_id')
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("carried_forward_from_id")) {
    await query("ALTER TABLE tasks ADD COLUMN carried_forward_from_id INT NULL");
  }

  taskCarryForwardColumnsEnsured = true;
};

const ensureTaskReassignmentColumns = async () => {
  if (taskReassignmentColumnsEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME IN ('reassigned_at')
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("reassigned_at")) {
    await query("ALTER TABLE tasks ADD COLUMN reassigned_at TIMESTAMP NULL");
  }

  taskReassignmentColumnsEnsured = true;
};

const ensureTaskPriorityColumn = async () => {
  if (taskPriorityColumnEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME = 'priority'
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("priority")) {
    await query("ALTER TABLE tasks ADD COLUMN priority ENUM('Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium'");
  } else {
    // Modify the existing column to update the ENUM values
    await query("ALTER TABLE tasks MODIFY COLUMN priority ENUM('Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium'");
  }

  taskPriorityColumnEnsured = true;
};

const ensureTaskDepartmentColumn = async () => {
  if (taskDepartmentColumnEnsured) return;

  const existingColumns = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tasks'
        AND COLUMN_NAME = 'task_department'
    `
  );

  const columnSet = new Set(existingColumns.map((entry) => entry.COLUMN_NAME));

  if (!columnSet.has("task_department")) {
    await query("ALTER TABLE tasks ADD COLUMN task_department VARCHAR(80) NULL");
  }

  taskDepartmentColumnEnsured = true;
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

export const createTask = async ({
  client,
  task,
  action,
  status = "Pending",
  dependency,
  assignedTo,
  assignedBy,
  type,
  deadline,
  carriedForwardFromId = null,
  priority = "Medium",
  taskDepartment = null
}) => {
  await ensureTaskSubmissionColumns();
  await ensureTaskCarryForwardColumns();
  await ensureTaskReassignmentColumns();
  await ensureTaskPriorityColumn();
  await ensureTaskDepartmentColumn();

  const sql = `
    INSERT INTO tasks (
      client, task, action, status, dependency,
      assigned_to, assigned_by, type, deadline, carried_forward_from_id, priority, task_department
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    deadline || null,
    carriedForwardFromId,
    priority,
    taskDepartment || null
  ]);

  return result.insertId;
};

export const getTasksByRole = async ({ role, userId, team, managedTeams = [] }) => {
  await ensureTaskSubmissionColumns();
  await ensureTaskCarryForwardColumns();
  await ensureTaskReassignmentColumns();
  await ensureTaskPriorityColumn();
  await ensureTaskDepartmentColumn();

  const baseSql = `
    SELECT
      t.id,
      t.client,
      t.task,
      t.action,
      t.status AS raw_status,
      t.status AS status,
      t.priority,
      t.task_department,
      t.dependency,
      t.assigned_to,
      t.assigned_by,
      t.type,
      t.carried_forward_from_id,
      t.submitted_to_hr,
      t.submitted_to_hr_at,
      DATE_FORMAT(COALESCE(sourceTask.created_at, t.created_at), '%Y-%m-%d %H:%i:%s') AS assigned_at,
      DATE_FORMAT(t.reassigned_at, '%Y-%m-%d %H:%i:%s') AS reassigned_at,
      DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
      t.deadline,
      assignTo.name AS assigned_to_name,
      assignBy.name AS assigned_by_name
    FROM tasks t
    LEFT JOIN users assignTo ON assignTo.id = t.assigned_to
    LEFT JOIN users assignBy ON assignBy.id = t.assigned_by
    LEFT JOIN tasks sourceTask ON sourceTask.id = t.carried_forward_from_id
  `;

  if (role === "employee") {
    return query(`${baseSql} WHERE t.assigned_to = ? ORDER BY t.created_at DESC`, [userId]);
  }

  if (role === "admin") {
    const teams = Array.isArray(managedTeams) && managedTeams.length > 0 ? managedTeams : [team];
    const placeholders = teams.map(() => "?").join(",");

    return query(
      `${baseSql} WHERE assignTo.team IN (${placeholders}) OR t.assigned_by = ? ORDER BY t.created_at DESC`,
      [...teams, userId]
    );
  }

  return query(`${baseSql} ORDER BY t.created_at DESC`);
};

export const getTaskById = async (id) => {
  await ensureTaskSubmissionColumns();
  await ensureTaskCarryForwardColumns();
  await ensureTaskReassignmentColumns();
  await ensureTaskPriorityColumn();
  await ensureTaskDepartmentColumn();

  const rows = await query("SELECT * FROM tasks WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

export const updateTaskStatus = async ({ id, status, dependency, action, taskTitle }) => {
  await ensureTaskSubmissionColumns();

  const completedAt = status === "Completed" ? new Date() : null;
  const resolvedDependency = dependency || null;
  const normalizedAction = String(action || "").trim();
  const normalizedTaskTitle = String(taskTitle || "").trim();

  const sql = `
    UPDATE tasks
    SET task = ?,
        status = ?,
        action = ?,
        dependency = ?,
        completed_at = CASE
          WHEN ? = 'Completed' THEN ?
          ELSE NULL
        END
    WHERE id = ?
  `;

  await query(sql, [normalizedTaskTitle, status, normalizedAction, resolvedDependency, status, completedAt, id]);
};

export const updateTaskPriority = async ({ id, priority }) => {
  await ensureTaskPriorityColumn();

  const sql = `
    UPDATE tasks
    SET priority = ?
    WHERE id = ?
  `;

  await query(sql, [priority, id]);
};

export const reassignTask = async ({ id, assignedTo, assignedBy }) => {
  await ensureTaskSubmissionColumns();
  await ensureTaskReassignmentColumns();

  const sql = `
    UPDATE tasks
    SET assigned_to = ?,
        assigned_by = ?,
        created_at = CURRENT_TIMESTAMP,
      reassigned_at = CURRENT_TIMESTAMP,
        submitted_to_hr = 0,
        submitted_to_hr_at = NULL
    WHERE id = ?
  `;

  await query(sql, [assignedTo, assignedBy, id]);
};

export const getEmployeeDailySummary = async (employeeId, date) => {
  await ensureTaskSubmissionColumns();

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
  await ensureTaskSubmissionColumns();

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
  await ensureTaskSubmissionColumns();

  const teamList = Array.isArray(team) ? team.filter(Boolean) : team ? [team] : [];

  if (teamList.length === 0) {
    return [];
  }

  const placeholders = teamList.map(() => "?").join(",");

  const sql = `
    SELECT
      u.id,
      u.name,
      u.role,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN t.status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks,
      ROUND(
        (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)) * 100,
        2
      ) AS completion_rate
    FROM users u
    LEFT JOIN tasks t ON t.assigned_to = u.id
    WHERE u.team IN (${placeholders}) AND u.role IN ('employee', 'admin')
    GROUP BY u.id, u.name, u.role
    ORDER BY completion_rate DESC
  `;

  return query(sql, teamList);
};

export const getDepartmentAdminPerformance = async (team = null) => {
  await ensureTaskSubmissionColumns();

  const sql = `
    SELECT
      u.id,
      u.name,
      u.team,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
      SUM(CASE WHEN t.status <> 'Completed' THEN 1 ELSE 0 END) AS pending_tasks,
      ROUND(
        (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0)) * 100,
        2
      ) AS completion_rate
    FROM users u
    LEFT JOIN tasks t ON t.assigned_to = u.id
    WHERE u.role = 'admin'
      AND (? IS NULL OR u.team = ?)
    GROUP BY u.id, u.name, u.team
    ORDER BY completion_rate DESC
  `;

  return query(sql, [team, team]);
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

export const markAllNotificationsAsRead = async (userId) => {
  await query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
};

export const getTaskUpdateNotificationRecipients = async ({ assignedBy, actorId }) => {
  const rows = await query(
    `
      SELECT DISTINCT id
      FROM users
      WHERE (id = ? OR role IN ('superadmin', 'hr'))
        AND id <> ?
    `,
    [assignedBy, actorId]
  );

  return rows.map((row) => row.id);
};

export const getHrUserIds = async () => {
  const rows = await query("SELECT id FROM users WHERE role = 'hr'");
  return rows.map((row) => row.id);
};

export const submitTaskToHr = async ({ id, employeeId }) => {
  await ensureTaskSubmissionColumns();

  const taskRows = await query(
    `
      SELECT id, task, assigned_to, submitted_to_hr, DATE(created_at) AS task_date
      FROM tasks
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  const task = taskRows[0] || null;
  if (!task) {
    return { task: null, changed: false };
  }

  if (Number(task.assigned_to) !== Number(employeeId)) {
    return { task, changed: false, forbidden: true };
  }

  if (Number(task.submitted_to_hr) === 1) {
    return { task, changed: false };
  }

  await query(
    "UPDATE tasks SET submitted_to_hr = 1, submitted_to_hr_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );

  return { task, changed: true };
};

export const carryForwardPendingTasks = async (targetDate = null) => {
  await ensureTaskSubmissionColumns();
  await ensureTaskCarryForwardColumns();
  await ensureTaskPriorityColumn();
  await ensureTaskDepartmentColumn();

  let effectiveTargetDate = targetDate;

  if (!effectiveTargetDate) {
    const dateRows = await query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
    effectiveTargetDate = dateRows[0]?.today || null;
  }

  if (!effectiveTargetDate) {
    throw new Error("Unable to resolve target date for carry forward");
  }

  const parsedTargetDate = new Date(`${effectiveTargetDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedTargetDate.getTime())) {
    throw new Error("Invalid target date for carry forward");
  }

  const sourceDate = new Date(parsedTargetDate);
  sourceDate.setUTCDate(sourceDate.getUTCDate() - 1);

  const sourceDateString = sourceDate.toISOString().slice(0, 10);

  const pendingTasks = await query(
    `
      SELECT
        id,
        client,
        task,
        action,
        status,
        priority,
        task_department,
        dependency,
        assigned_to,
        assigned_by,
        type,
        deadline
      FROM tasks
      WHERE status IN ('Pending', 'In Progress')
        AND DATE(created_at) = ?
      ORDER BY id ASC
    `,
    [sourceDateString]
  );

  let createdCount = 0;

  for (const sourceTask of pendingTasks) {
    const existingCarryForwardTask = await query(
      `
        SELECT id
        FROM tasks
        WHERE carried_forward_from_id = ?
          AND DATE(created_at) = ?
        LIMIT 1
      `,
      [sourceTask.id, effectiveTargetDate]
    );

    if (existingCarryForwardTask.length > 0) {
      continue;
    }

    const newTaskId = await createTask({
      client: sourceTask.client,
      task: sourceTask.task,
      action: sourceTask.action,
      status: sourceTask.status,
      priority: sourceTask.priority || "Medium",
      taskDepartment: sourceTask.task_department || null,
      dependency: sourceTask.dependency,
      assignedTo: sourceTask.assigned_to,
      assignedBy: sourceTask.assigned_by,
      type: sourceTask.type,
      deadline: sourceTask.deadline,
      carriedForwardFromId: sourceTask.id
    });

    await createNotification({
      userId: sourceTask.assigned_to,
      message: `${sourceTask.status} task carried forward from ${sourceDateString}: ${sourceTask.task}`,
      type: "task_carried_forward",
      refId: newTaskId
    });

    createdCount += 1;
  }

  return {
    sourceDate: sourceDateString,
    targetDate: effectiveTargetDate,
    createdCount
  };
};
