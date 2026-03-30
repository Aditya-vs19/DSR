create database dsr_db;
use dsr_db;

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
  priority ENUM('Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  dependency TEXT,
  assigned_to INT NOT NULL,
  assigned_by INT NOT NULL,
  type ENUM('self', 'assigned') NOT NULL,
  submitted_to_hr TINYINT(1) NOT NULL DEFAULT 0,
  submitted_to_hr_at TIMESTAMP NULL,
  carried_forward_from_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reassigned_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  deadline DATETIME NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  pending_tasks INT DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  validated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employee_date (employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE daily_employee_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL,
  user_id INT NOT NULL,
  status ENUM('Received', 'Not Received', 'Leave') NOT NULL DEFAULT 'Not Received',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_daily_report_user_date (report_date, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE report_holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  title VARCHAR(140) NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);



CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  type VARCHAR(80) DEFAULT 'task_assigned',
  reference_id INT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);



INSERT INTO users (name, email, password, role, team) VALUES

-- SUPER ADMINS
('Vijay', 'vijay@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'superadmin', 'Management'),
('Samiksha', 'samiksha@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'superadmin', 'Management'),

-- ADMINS
('Snigdha', 'snigdha@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'admin', 'Sales'),
('Namrata', 'namrata@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'admin', 'Operations'),
('Kartik', 'kartik@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'admin', 'Technical'),
('Manorama', 'manorama@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'admin', 'Finance'),

-- SALES TEAM
('Sakshi', 'sakshi@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Sales'),
('Rajashree', 'rajashree@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Sales'),

-- OPERATIONS TEAM
('Soham', 'soham@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Operations'),
('Nitin', 'nitin@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Operations'),
('Sneha', 'sneha@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Operations'),

-- TECH TEAM
('Ravindra', 'ravindra@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Technical'),
('Kavita', 'kavita@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Technical'),
('Avinash', 'avinash@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Logistics'),

-- FINANCE TEAM
('Apurva', 'apurva@cludobits.com', '$2a$10$9uM6P6pMpT2FQm40XW5GFutxuxMxDPZWS9Vyuk3F7S3w7Dnk3a1lW', 'employee', 'Finance');



CREATE USER 'teamuser'@'%' IDENTIFIED BY '123456';
GRANT ALL PRIVILEGES ON dsr_db.* TO 'teamuser'@'%';
FLUSH PRIVILEGES;