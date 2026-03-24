CREATE DATABASE IF NOT EXISTS dsr_management;
USE dsr_management;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('employee', 'admin', 'hr', 'superadmin') NOT NULL DEFAULT 'employee',
  team VARCHAR(80) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client VARCHAR(180) NOT NULL,
  task VARCHAR(255) NOT NULL,
  action TEXT NOT NULL,
  status ENUM('Pending', 'In Progress', 'Completed') NOT NULL DEFAULT 'Pending',
  dependency TEXT,
  assigned_to INT NOT NULL,
  assigned_by INT NOT NULL,
  type ENUM('self', 'assigned') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  deadline DATETIME NULL,
  CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,
  pending_tasks INT NOT NULL DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  validated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_date (employee_id, date),
  CONSTRAINT fk_reports_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_validator FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  type VARCHAR(80) NOT NULL DEFAULT 'task_assigned',
  reference_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sample users (password for all below: Password@123)
INSERT INTO users (name, email, password, role, team) VALUES
('Super Admin', 'superadmin@dsr.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'superadmin', 'Management'),
('HR Manager', 'hr@dsr.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'hr', 'HR'),
('Sales Admin', 'admin.sales@dsr.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'admin', 'Sales'),
('John Employee', 'john@dsr.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Sales'),
('Priya Employee', 'priya@dsr.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Operations');

INSERT INTO tasks (client, task, action, status, dependency, assigned_to, assigned_by, type, deadline) VALUES
('Acme Corp', 'Lead Follow-up', 'Call warm leads and capture responses in CRM', 'In Progress', 'Waiting for call list', 4, 3, 'assigned', DATE_ADD(NOW(), INTERVAL 1 DAY)),
('Acme Corp', 'Demo Preparation', 'Prepare product demo notes for client meeting', 'Pending', 'Need latest deck', 4, 3, 'assigned', DATE_ADD(NOW(), INTERVAL 2 DAY)),
('Internal', 'Self Learning', 'Complete advanced negotiation training module', 'Completed', 'None', 4, 4, 'self', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('Globex', 'Pipeline Audit', 'Review current pipeline and update stages', 'Pending', 'Need latest opportunities export', 5, 1, 'assigned', DATE_ADD(NOW(), INTERVAL 3 DAY));

INSERT INTO reports (employee_id, date, total_tasks, completed_tasks, pending_tasks, status, validated_by) VALUES
(4, CURDATE(), 3, 1, 2, 'pending', NULL),
(5, CURDATE(), 1, 0, 1, 'pending', NULL);

INSERT INTO notifications (user_id, message, type, reference_id) VALUES
(4, 'New task assigned: Demo Preparation', 'task_assigned', 2),
(5, 'New task assigned: Pipeline Audit', 'task_assigned', 4);
