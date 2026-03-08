import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Search,
  Upload,
  LogOut,
} from "lucide-react";
import { clearAuth, getStoredUser, isAdmin } from "../auth";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/articles", icon: FileText, label: "Articles" },
  { to: "/search", icon: Search, label: "Search" },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">Intel Platform</h1>
          <p className="text-xs text-gray-400 mt-0.5">AeroDan Ltd</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin() && (
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Upload size={18} />
              Upload
            </NavLink>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center justify-between px-3">
            <div>
              <p className="text-sm font-medium">{user?.display_name || user?.username}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
