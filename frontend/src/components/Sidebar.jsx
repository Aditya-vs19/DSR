import { NavLink } from "react-router-dom";

const roleLinks = {
  employee: [{ label: "My Dashboard", to: "/employee" }],
  admin: [{ label: "Admin Dashboard", to: "/admin" }],
  hr: [{ label: "HR Dashboard", to: "/hr" }],
  superadmin: [{ label: "SuperAdmin Dashboard", to: "/superadmin" }]
};

const Sidebar = ({ role, open, onClose }) => {
  const links = roleLinks[role] || [];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-full w-64 border-r border-slate-200 bg-white p-4 transition-transform md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-indigo-700">DSR System</h2>
        <button className="md:hidden" onClick={onClose} type="button">
          ✕
        </button>
      </div>

      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? "bg-indigo-100 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
              }`
            }
            onClick={onClose}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
