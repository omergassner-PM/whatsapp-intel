import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDigests, getArticles, getTags } from "../api";
import api from "../api";
import { format } from "date-fns";
import { FileText, Tag, TrendingUp, Calendar, Download } from "lucide-react";

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

  const digestsQ = useQuery({
    queryKey: ["digests", { page: 1, limit: 1 }],
    queryFn: () => getDigests({ page: 1, limit: 1 }),
  });

  const articlesQ = useQuery({
    queryKey: ["articles", { page: 1, limit: 5, sort: "date" }],
    queryFn: () => getArticles({ page: 1, limit: 5, sort: "date" }),
  });

  const tagsQ = useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
  });

  const latestDigest = digestsQ.data?.data?.items?.[0];
  const recentArticles = articlesQ.data?.data?.items || [];
  const totalArticles = articlesQ.data?.data?.total || 0;
  const tags = tagsQ.data?.data?.tags || [];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalArticles}</p>
              <p className="text-sm text-gray-500">Total Articles</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Tag size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tags.length}</p>
              <p className="text-sm text-gray-500">Categories</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {latestDigest?.article_count ?? "-"}
              </p>
              <p className="text-sm text-gray-500">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download report */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
      >
        <Download size={16} />
        {downloading ? "Downloading..." : "Download Report (CSV)"}
      </button>

      {/* Weekly digest */}
      {latestDigest && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-gray-500" />
            <h3 className="font-semibold">
              Weekly Digest: {format(new Date(latestDigest.week_start), "MMM d")} -{" "}
              {format(new Date(latestDigest.week_end), "MMM d, yyyy")}
            </h3>
          </div>
          {latestDigest.summary && (
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              {latestDigest.summary}
            </p>
          )}
          {latestDigest.top_items?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Top Stories</h4>
              <ul className="space-y-2">
                {latestDigest.top_items.map((item: any, i: number) => (
                  <li key={i} className="text-sm bg-gray-50 rounded p-3">
                    <span className="font-medium">{item.title}</span>
                    {item.summary && (
                      <span className="text-gray-500"> — {item.summary}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recent articles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Articles</h3>
          <Link to="/articles" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-lg border divide-y">
          {recentArticles.length === 0 && (
            <p className="text-sm text-gray-500 p-4">No articles yet.</p>
          )}
          {recentArticles.map((a: any) => (
            <Link
              key={a.id}
              to={`/articles/${a.id}`}
              className="block p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {a.title || "Untitled"}
                  </p>
                  {a.tldr && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.tldr}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {a.shared_by && (
                      <span className="text-xs text-gray-400">
                        Shared by {a.shared_by}
                      </span>
                    )}
                    {a.tags?.map((t: string) => (
                      <span
                        key={t}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                {a.relevance_score && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      a.relevance_score >= 4
                        ? "bg-red-100 text-red-700"
                        : a.relevance_score >= 3
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {a.relevance_score}/5
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
