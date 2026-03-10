import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLogs, getUsers } from "../api";
import api from "../api";
import { format } from "date-fns";
import {
  Users,
  FileArchive,
  Activity,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"exports" | "users" | "activity">(
    "exports"
  );

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      activeTab === t
        ? "bg-gray-900 text-white"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
    }`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin Dashboard</h2>

      <div className="flex gap-2">
        <button className={tabClass("exports")} onClick={() => setActiveTab("exports")}>
          <span className="flex items-center gap-2">
            <FileArchive size={16} /> Export History
          </span>
        </button>
        <button className={tabClass("users")} onClick={() => setActiveTab("users")}>
          <span className="flex items-center gap-2">
            <Users size={16} /> Users
          </span>
        </button>
        <button className={tabClass("activity")} onClick={() => setActiveTab("activity")}>
          <span className="flex items-center gap-2">
            <Activity size={16} /> Activity
          </span>
        </button>
      </div>

      {activeTab === "exports" && <ExportHistory />}
      {activeTab === "users" && <UsersList />}
      {activeTab === "activity" && <ActivityLog />}
    </div>
  );
}

function ExportHistory() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", page],
    queryFn: () => api.get("/admin/logs", { params: { page, limit: 10 } }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });

  const logs = data?.data?.items || [];
  const totalPages = data?.data?.pages || 1;

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {data?.data?.total || 0} export{(data?.data?.total || 0) !== 1 ? "s" : ""} total
        </p>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {logs.length === 0 && (
          <p className="text-sm text-gray-500 p-6">No exports yet.</p>
        )}
        {logs.map((log: any) => (
          <div key={log.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-sm truncate">
                    {log.export_filename}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      log.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : log.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                  <span>Messages: {log.total_messages}</span>
                  <span>New: {log.new_messages}</span>
                  <span>Duplicates: {log.skipped_duplicates}</span>
                  <span>URLs: {log.urls_found}</span>
                  <span>Scraped: {log.articles_scraped}</span>
                  <span>Processed: {log.articles_processed}</span>
                </div>
                {log.started_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(log.started_at), "MMM d, yyyy HH:mm")}
                  </p>
                )}
                {log.error_message && (
                  <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete export "${log.export_filename}" and all its data?`))
                    deleteMut.mutate(log.id);
                }}
                disabled={deleteMut.isPending}
                className="text-gray-400 hover:text-red-500 shrink-0 p-1"
                title="Delete export and its data"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function UsersList() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: getUsers,
  });

  const users = data?.data || [];

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="bg-white rounded-lg border divide-y">
      {users.length === 0 && (
        <p className="text-sm text-gray-500 p-6">No users yet.</p>
      )}
      {users.map((u: any) => (
        <div key={u.id} className="p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">
                {u.display_name || u.username}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  u.role === "admin"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {u.role}
              </span>
              {!u.is_active && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">
                  inactive
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              @{u.username}
              {u.created_at &&
                ` — joined ${format(new Date(u.created_at), "MMM d, yyyy")}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityLog() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", page, filter],
    queryFn: () =>
      api.get("/admin/activity", {
        params: { page, limit: 20, ...(filter ? { action: filter } : {}) },
      }),
  });

  const items = data?.data?.items || [];
  const totalPages = data?.data?.pages || 1;

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All actions</option>
          <option value="search">Searches</option>
          <option value="download">Downloads</option>
          <option value="view">Views</option>
        </select>
        <p className="text-sm text-gray-500">
          {data?.data?.total || 0} activit{(data?.data?.total || 0) !== 1 ? "ies" : "y"}
        </p>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {items.length === 0 && (
          <p className="text-sm text-gray-500 p-6">No activity recorded yet.</p>
        )}
        {items.map((a: any) => (
          <div key={a.id} className="p-3 flex items-center gap-4">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                a.action === "search"
                  ? "bg-blue-100 text-blue-700"
                  : a.action === "download"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {a.action}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">
                <span className="font-medium">{a.username}</span>
                {a.detail && (
                  <span className="text-gray-500"> — {a.detail}</span>
                )}
              </p>
            </div>
            {a.created_at && (
              <span className="text-xs text-gray-400 shrink-0">
                {format(new Date(a.created_at), "MMM d HH:mm")}
              </span>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
