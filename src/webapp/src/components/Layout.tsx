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
  Tags,
} from "lucide-react";
import { clearAuth, getStoredUser, isAdmin } from "../auth";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Briefing" },
  { to: "/articles", icon: FileText, label: "Intel Feed" },
  { to: "/tags", icon: Tags, label: "Topics" },
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
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-gray-900 text-gray-100 flex flex-col transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                AeroData
              </h1>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">
                Intelligence Platform
              </p>
            </div>
            <button
              onClick={closeSidebar}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-3 text-[10px] text-gray-600 uppercase tracking-wider">
            V0.1.0
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Intelligence
          </p>
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
              <div className="pt-4 pb-2">
                <p className="px-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Admin
                </p>
              </div>
              <NavLink to="/upload" className={navLinkClass} onClick={closeSidebar}>
                <Upload size={18} />
                Upload Export
              </NavLink>
              <NavLink to="/admin" className={navLinkClass} onClick={closeSidebar}>
                <Shield size={18} />
                Dashboard
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center justify-between px-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.display_name || user?.username}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white p-1"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-700 hover:text-gray-900"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
