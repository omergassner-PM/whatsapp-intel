import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getTags } from "../api";
import { Tag } from "lucide-react";

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
  "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200",
  "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
  "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
  "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200",
  "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200",
  "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200",
];

export default function TagsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["tags"], queryFn: getTags });
  const tags = data?.data?.tags || [];
  const maxCount = tags[0]?.count || 1;

  if (isLoading) return <p className="text-sm text-gray-500">Loading topics...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Topics</h2>
        <p className="text-sm text-gray-500 mt-1">
          Browse articles by subject. {tags.length} topic{tags.length !== 1 ? "s" : ""} identified.
        </p>
      </div>

      {tags.length === 0 ? (
        <div className="news-card p-8 text-center">
          <Tag size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No topics yet. Upload and process articles to see topics.</p>
        </div>
      ) : (
        <>
          {/* Tag cloud */}
          <div className="news-card p-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-4">Topic Cloud</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((t: any, i: number) => {
                const sizeClass =
                  t.count >= maxCount * 0.7
                    ? "text-lg px-4 py-2"
                    : t.count >= maxCount * 0.3
                      ? "text-sm px-3 py-1.5"
                      : "text-xs px-2.5 py-1";
                return (
                  <Link
                    key={t.name}
                    to={`/articles?tag=${encodeURIComponent(t.name)}`}
                    className={`inline-block font-medium rounded-full border transition-colors ${sizeClass} ${TAG_COLORS[i % TAG_COLORS.length]}`}
                  >
                    {t.name}
                    <span className="ml-1.5 opacity-50">{t.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Topic list with bars */}
          <div className="news-card p-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-4">All Topics</h3>
            <div className="space-y-3">
              {tags.map((t: any, i: number) => (
                <Link
                  key={t.name}
                  to={`/articles?tag=${encodeURIComponent(t.name)}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-40 min-w-0 shrink-0">
                    <p className="text-sm text-gray-800 font-medium truncate group-hover:text-blue-700 transition-colors">
                      {t.name}
                    </p>
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${TAG_COLORS[i % TAG_COLORS.length].split(" ")[0]}`}
                      style={{ width: `${(t.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 font-medium w-8 text-right shrink-0">
                    {t.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
