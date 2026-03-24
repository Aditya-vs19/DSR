# Daily Service Report (DSR) Management System

This workspace now contains a full-stack DSR system with role-based access:

- **Backend:** Node.js, Express, MySQL, JWT
- **Frontend:** React (JSX), Tailwind CSS, Axios, Chart.js
- **Roles:** `superadmin`, `hr`, `admin`, `employee`

## Project Structure

```text
backend/
	config/db.js
	controllers/
		authController.js
		taskController.js
		reportController.js
	middleware/authMiddleware.js
	routes/
		authRoutes.js
		taskRoutes.js
		reportRoutes.js
	models/
		userModel.js
		taskModel.js
		reportModel.js
	utils/cronJobs.js
	sql/schema.sql
	server.js

frontend/
	src/
		components/
			Navbar.jsx
			Sidebar.jsx
			TaskTable.jsx
			Charts.jsx
		pages/
			Login.jsx
			EmployeeDashboard.jsx
			AdminDashboard.jsx
			HRDashboard.jsx
			SuperAdminDashboard.jsx
		services/api.js
		context/AuthContext.jsx
		App.jsx
```

## Features Implemented

### Core
- JWT authentication (`/api/auth/login`, `/api/auth/register`)
- Role-based route protection in backend and frontend
- Task creation and assignment (admin/employee self-task)
- DSR table format with columns:
	- Sr No
	- Client
	- Task
	- Action
	- Status (editable dropdown)
	- Dependency
- Status tracking with automatic `completed_at` timestamp

### Dashboards
- **Employee:** own tasks, self-task creation, status update, daily summary, timeline chart
- **Admin:** assign tasks, team task monitoring, team performance chart
- **HR:** view all reports, validate reports (approve/reject)
- **SuperAdmin:** users/tasks/reports visibility, analytics (tasks per team, completion rate, top performers)

### Bonus
- Task assignment notifications
- Overdue task highlighting
- Productivity score in analytics
- Task filters by date/team/status (role dependent)

### Cron Job
- Daily auto report generation at **6:30 PM** (`30 18 * * *`)

## MySQL Setup

1. Create database/tables + sample data:
	 - Run: `backend/sql/schema.sql`
2. Sample users in SQL use password:
	 - `Password@123`

## Backend Setup

```bash
cd backend
cp .env.example .env
# update DB credentials + JWT secret
npm install
npm run dev
```

Server runs on: `http://localhost:5000`

## Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`

### Tasks
- `POST /api/tasks`
- `GET /api/tasks`
- `PUT /api/tasks/:id`

### Reports
- `GET /api/reports`
- `POST /api/reports/generate`
- `PUT /api/reports/:id/validate`

### Additional (implemented)
- `GET /api/tasks/summary/daily`
- `GET /api/tasks/timeline`
- `GET /api/tasks/performance/team`
- `GET /api/tasks/notifications/me`
- `PUT /api/tasks/notifications/:id/read`
- `GET /api/reports/analytics/superadmin`
- `GET /api/auth/users`
- `GET /api/auth/users/team`

## Notes
- CORS is configurable via `backend/.env` (`CORS_ORIGIN`).
- Tailwind warnings in editor can appear until frontend dependencies/extensions are active.
- `frontend` build is validated and working.
