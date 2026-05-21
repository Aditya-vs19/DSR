import FilterSelect from "./FilterSelect";

const AdminTaskFilters = ({ filters, employees, user, onStatusChange, onEmployeeChange, onDateChange }) => {
  const statusOptions = [
    { value: "all", label: "All" },
    { value: "Pending", label: "Pending" },
    { value: "In Progress", label: "In Progress" },
    { value: "Completed", label: "Completed" }
  ];

  const employeeOptions = [
    { value: "all", label: "All Team Members" },
    ...employees.map((employee) => ({
      value: String(employee.id),
      label: employee.name
    })),
    { value: String(user?.id || ""), label: `Self (${user?.name})` }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Status</label>
        <FilterSelect value={filters.status} options={statusOptions} onChange={onStatusChange} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Employee</label>
        <FilterSelect value={filters.employeeId} options={employeeOptions} onChange={onEmployeeChange} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-900">Date</label>
        <input className="input" type="date" value={filters.date} onChange={(event) => onDateChange(event.target.value)} />
      </div>
    </div>
  );
};

export default AdminTaskFilters;
