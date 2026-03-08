import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getArticles, getTags } from "../api";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ArticlesPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") || "1");
  const tag = params.get("tag") || "";
  const minScore = params.get("min_score") || "";
  const sort = params.get("sort") || "date";

  const queryParams: Record<string, string | number> = { page, limit: 20, sort };
  if (tag) queryParams.tag = tag;
  if (minScore) queryParams.min_score = Number(minScore);

  const articlesQ = useQuery({
    queryKey: ["articles", queryParams],
    queryFn: () => getArticles(queryParams),
  });

  const tagsQ = useQuery({ queryKey: ["tags"], queryFn: getTags });

  const data = articlesQ.data?.data;
  const articles = data?.items || [];
  const totalPages = data?.pages || 1;
  const tags = tagsQ.data?.data?.tags || [];

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Articles</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={tag}
          onChange={(e) => updateParam("tag", e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All tags</option>
          {tags.map((t: any) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.count})
            </option>
          ))}
        </select>

        <select
          value={minScore}
          onChange={(e) => updateParam("min_score", e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Any score</option>
          {[3, 4, 5].map((s) => (
            <option key={s} value={String(s)}>
              {s}+ score
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="date">Newest first</option>
          <option value="relevance">Highest relevance</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {/* Article list */}
      <div className="bg-white rounded-lg border divide-y">
        {articles.length === 0 && (
          <p className="text-sm text-gray-500 p-6">No articles found.</p>
        )}
        {articles.map((a: any) => (
          <Link
            key={a.id}
            to={`/articles/${a.id}`}
            className="block p-4 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.title || "Untitled"}</p>
                {a.tldr && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.tldr}</p>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {a.published_date && (
                    <span className="text-xs text-gray-400">{a.published_date}</span>
                  )}
                  {a.shared_by && (
                    <span className="text-xs text-gray-400">
                      via {a.shared_by}
                    </span>
                  )}
                  {a.tags?.map((t: string) => (
                    <span
                      key={t}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200"
                      onClick={(e) => {
                        e.preventDefault();
                        updateParam("tag", t);
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {a.relevance_score && (
                <span
                  className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => updateParam("page", String(page - 1))}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => updateParam("page", String(page + 1))}
            className="p-1.5 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
