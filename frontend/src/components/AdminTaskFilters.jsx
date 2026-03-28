const AdminTaskFilters = ({ filters, employees, user, onStatusChange, onEmployeeChange, onDateChange }) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Status</label>
        <select className="input" value={filters.status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="all">All</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Employee</label>
        <select className="input" value={filters.employeeId} onChange={(event) => onEmployeeChange(event.target.value)}>
          <option value="all">All Team Members</option>
          {employees.map((employee) => (
            <option key={employee.id} value={String(employee.id)}>
              {employee.name}
            </option>
          ))}
          <option value={String(user?.id || "")}>Self ({user?.name})</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dsr-muted">Date</label>
        <input className="input" type="date" value={filters.date} onChange={(event) => onDateChange(event.target.value)} />
      </div>
    </div>
  );
};

export default AdminTaskFilters;