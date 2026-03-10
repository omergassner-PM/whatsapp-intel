import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { setAuth } from "../auth";
import api from "../api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"viewer" | "admin">("viewer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Viewer fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Admin fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleViewerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { name, email });
      setAuth(data.access_token, data.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await login(username, password);
      setAuth(data.access_token, data.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (t: string) =>
    `flex-1 py-2.5 text-sm font-medium text-center rounded-md transition-colors ${
      tab === t
        ? "bg-gray-900 text-white"
        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">AeroData</h1>
            <p className="text-sm text-gray-500 mt-1">
              AeroDan Ltd — Intelligence Platform
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5">
            <button className={tabClass("viewer")} onClick={() => { setTab("viewer"); setError(""); }}>
              Viewer
            </button>
            <button className={tabClass("admin")} onClick={() => { setTab("admin"); setError(""); }}>
              Admin
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm mb-4">
              {error}
            </div>
          )}

          {tab === "viewer" ? (
            <form onSubmit={handleViewerSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Enter your name and email to browse articles and reports.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john@aerodan.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Entering..." : "Enter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
