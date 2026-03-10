import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Search,
  Upload,
  LogOut,
  Menu,
  X,
  Shield,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
      isActive
        ? "bg-gray-800 text-white"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 bg-gray-900 text-gray-100 flex flex-col transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">AeroData</h1>
            <p className="text-xs text-gray-400 mt-0.5">AeroDan Ltd</p>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={navLinkClass}
              onClick={closeSidebar}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin() && (
            <>
              <NavLink
                to="/upload"
                className={navLinkClass}
                onClick={closeSidebar}
              >
                <Upload size={18} />
                Upload
              </NavLink>
              <NavLink
                to="/admin"
                className={navLinkClass}
                onClick={closeSidebar}
              >
                <Shield size={18} />
                Admin
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center justify-between px-3">
            <div>
              <p className="text-sm font-medium">
                {user?.display_name || user?.username}
              </p>
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-700 hover:text-gray-900"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-sm font-bold text-gray-900">AeroData</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
