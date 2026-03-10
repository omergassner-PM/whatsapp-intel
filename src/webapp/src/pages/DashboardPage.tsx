import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getArticles, getTags } from "../api";
import api from "../api";
import { format } from "date-fns";
import {
  FileText,
  TrendingUp,
  Download,
  Activity,
  Zap,
  Clock,
  ExternalLink,
} from "lucide-react";

function detectDir(text: string): "rtl" | "ltr" {
  const hebrewRe = /[\u0590-\u05FF]/;
  const arabicRe = /[\u0600-\u06FF]/;
  return hebrewRe.test(text) || arabicRe.test(text) ? "rtl" : "ltr";
}

export default function DashboardPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data } = await api.get("/admin/export/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "aerodata_articles_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const statsQ = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get("/admin/stats"),
  });

  const articlesQ = useQuery({
    queryKey: ["articles", { page: 1, limit: 8, sort: "date" }],
    queryFn: () => getArticles({ page: 1, limit: 8, sort: "date" }),
  });

  const tagsQ = useQuery({ queryKey: ["tags"], queryFn: getTags });

  const stats = statsQ.data?.data;
  const recentArticles = articlesQ.data?.data?.items || [];
  const tags = (tagsQ.data?.data?.tags || []).slice(0, 15);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Briefing</h2>
          <p className="text-sm text-gray-500 mt-1">
            Intelligence overview and latest collected data
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Download size={15} />
          {downloading ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText size={18} />}
          iconBg="bg-blue-100 text-blue-700"
          label="Total Articles"
          value={stats?.total_articles ?? "-"}
        />
        <StatCard
          icon={<Activity size={18} />}
          iconBg="bg-green-100 text-green-700"
          label="Messages Ingested"
          value={stats?.total_messages ?? "-"}
        />
        <StatCard
          icon={<Zap size={18} />}
          iconBg="bg-purple-100 text-purple-700"
          label="AI Processed"
          value={stats?.total_processed ?? "-"}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          iconBg="bg-orange-100 text-orange-700"
          label="This Week"
          value={stats?.articles_this_week ?? "-"}
        />
      </div>

      {/* Processing queue indicator */}
      {stats?.pending_processing > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 processing-dot" />
            <span className="w-2 h-2 rounded-full bg-amber-500 processing-dot" />
            <span className="w-2 h-2 rounded-full bg-amber-500 processing-dot" />
          </div>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{stats.pending_processing} articles</span>{" "}
            are being processed by AI. Results will appear automatically.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest intel — 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Latest Intel</h3>
            <Link
              to="/articles"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>

          {recentArticles.length === 0 && (
            <div className="news-card p-8 text-center">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                No articles yet. Upload a WhatsApp export to get started.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {recentArticles.map((a: any) => {
              const dir = a.tldr
                ? detectDir(a.tldr)
                : a.title
                  ? detectDir(a.title)
                  : "ltr";
              return (
                <Link
                  key={a.id}
                  to={`/articles/${a.id}`}
                  className="news-card block p-4"
                >
                  <div className="flex items-start gap-3">
                    {a.relevance_score && (
                      <div
                        className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          a.relevance_score >= 4
                            ? "score-critical"
                            : a.relevance_score >= 3
                              ? "score-high"
                              : "score-medium"
                        }`}
                      >
                        {a.relevance_score}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4
                        className="font-semibold text-sm text-gray-900 leading-snug"
                        dir={a.title ? detectDir(a.title) : "ltr"}
                      >
                        {a.title || "Untitled"}
                      </h4>
                      {a.tldr && (
                        <p
                          className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed"
                          dir={dir}
                        >
                          {a.tldr}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {a.shared_at && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} />
                            {format(new Date(a.shared_at), "MMM d, HH:mm")}
                          </span>
                        )}
                        {a.tags?.slice(0, 3).map((t: string) => (
                          <span
                            key={t}
                            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ExternalLink
                      size={14}
                      className="text-gray-300 shrink-0 mt-0.5"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Topics */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Top Topics</h3>
              <Link
                to="/tags"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                All topics
              </Link>
            </div>
            <div className="news-card p-4">
              {tags.length === 0 && (
                <p className="text-sm text-gray-400">No topics yet.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {tags.map((t: any, i: number) => {
                  const colors = [
                    "bg-blue-100 text-blue-800 ring-blue-300",
                    "bg-green-100 text-green-800 ring-green-300",
                    "bg-purple-100 text-purple-800 ring-purple-300",
                    "bg-orange-100 text-orange-800 ring-orange-300",
                    "bg-red-100 text-red-800 ring-red-300",
                    "bg-teal-100 text-teal-800 ring-teal-300",
                    "bg-pink-100 text-pink-800 ring-pink-300",
                  ];
                  return (
                    <Link
                      key={t.name}
                      to={`/articles?tag=${encodeURIComponent(t.name)}`}
                      className={`tag-pill ${colors[i % colors.length]}`}
                    >
                      {t.name}
                      <span className="ml-1 opacity-60">{t.count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Topic Breakdown bars */}
          {stats?.top_tags?.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Topic Breakdown</h3>
              <div className="news-card p-4 space-y-2">
                {stats.top_tags.slice(0, 8).map((t: any) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{t.name}</p>
                    </div>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (t.count / (stats.top_tags[0]?.count || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">
                      {t.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="news-card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
