const statusClass = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800"
};

const TaskTable = ({ tasks = [], onStatusChange, editableStatus = false }) => {
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
            <th className="p-3">Sr No</th>
            <th className="p-3">Client</th>
            <th className="p-3">Task</th>
            <th className="p-3">Action</th>
            <th className="p-3">Status</th>
            <th className="p-3">Dependency</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((item, index) => {
            const overdue = item.deadline && item.status !== "Completed" && new Date(item.deadline) < new Date();

            return (
              <tr key={item.id} className={`border-b border-slate-100 ${overdue ? "bg-rose-50" : ""}`}>
                <td className="p-3">{index + 1}</td>
                <td className="p-3 font-medium">{item.client}</td>
                <td className="p-3">{item.task}</td>
                <td className="p-3">{item.action}</td>
                <td className="p-3">
                  {editableStatus ? (
                    <select
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}
                      value={item.status}
                      onChange={(event) => onStatusChange(item, event.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  ) : (
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                      {item.status}
                    </span>
                  )}
                  {item.completed_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Completed: {new Date(item.completed_at).toLocaleString()}
                    </p>
                  )}
                </td>
                <td className="p-3">{item.dependency || "-"}</td>
              </tr>
            );
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-slate-500">
                No tasks available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTable;
