import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getArticles, getTags } from "../api";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  X,
} from "lucide-react";

function detectDir(text: string): "rtl" | "ltr" {
  const hebrewRe = /[\u0590-\u05FF]/;
  const arabicRe = /[\u0600-\u06FF]/;
  return hebrewRe.test(text) || arabicRe.test(text) ? "rtl" : "ltr";
}

export default function ArticlesPage() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const page = Number(params.get("page") || "1");
  const tag = params.get("tag") || "";
  const minScore = params.get("min_score") || "";
  const sort = params.get("sort") || "date";
  const search = params.get("search") || "";

  const queryParams: Record<string, string | number> = { page, limit: 20, sort };
  if (tag) queryParams.tag = tag;
  if (minScore) queryParams.min_score = Number(minScore);
  if (search) queryParams.search = search;

  const articlesQ = useQuery({
    queryKey: ["articles", queryParams],
    queryFn: () => getArticles(queryParams),
  });

  const tagsQ = useQuery({ queryKey: ["tags"], queryFn: getTags });

  const data = articlesQ.data?.data;
  const articles = data?.items || [];
  const totalPages = data?.pages || 1;
  const total = data?.total || 0;
  const tags = tagsQ.data?.data?.tags || [];

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };

  const clearFilters = () => setParams(new URLSearchParams());
  const hasFilters = tag || minScore || search;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Intel Feed</h2>
          <p className="text-sm text-gray-500 mt-1">
            {total} article{total !== 1 ? "s" : ""} collected
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            hasFilters ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Filter size={15} />
          Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
        </button>
      </div>

      {showFilters && (
        <div className="news-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Filter articles</p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search title or TLDR..."
              value={search}
              onChange={(e) => updateParam("search", e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white w-full sm:w-auto sm:flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select value={tag} onChange={(e) => updateParam("tag", e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All topics</option>
              {tags.map((t: any) => (
                <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
              ))}
            </select>
            <select value={minScore} onChange={(e) => updateParam("min_score", e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Any relevance</option>
              <option value="5">Critical (5)</option>
              <option value="4">High (4+)</option>
              <option value="3">Medium (3+)</option>
            </select>
            <select value={sort} onChange={(e) => updateParam("sort", e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="date">Newest first</option>
              <option value="relevance">Highest relevance</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
          {tag && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Topic:</span>
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                {tag}
                <button onClick={() => updateParam("tag", "")}><X size={12} /></button>
              </span>
            </div>
          )}
        </div>
      )}

      {articles.length === 0 && (
        <div className="news-card p-8 text-center">
          <p className="text-sm text-gray-500">{hasFilters ? "No articles match your filters." : "No articles yet."}</p>
        </div>
      )}

      <div className="space-y-3">
        {articles.map((a: any) => {
          const dir = a.tldr ? detectDir(a.tldr) : a.title ? detectDir(a.title) : "ltr";
          return (
            <Link key={a.id} to={`/articles/${a.id}`} className="news-card block p-4">
              <div className="flex items-start gap-3">
                {a.relevance_score && (
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                    a.relevance_score >= 4 ? "score-critical" : a.relevance_score >= 3 ? "score-high" : "score-medium"
                  }`}>
                    {a.relevance_score}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-gray-900 leading-snug" dir={a.title ? detectDir(a.title) : "ltr"}>
                    {a.title || "Untitled"}
                  </h4>
                  {a.tldr && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed" dir={dir}>{a.tldr}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {a.shared_at && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} />
                        {format(new Date(a.shared_at), "MMM d, yyyy HH:mm")}
                      </span>
                    )}
                    {a.shared_by && <span className="text-xs text-gray-400">via {a.shared_by}</span>}
                    {a.tags?.map((t: string) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100"
                        onClick={(e) => { e.preventDefault(); updateParam("tag", t); setShowFilters(true); }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <ExternalLink size={14} className="text-gray-300 shrink-0 mt-0.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}
            className="p-2 rounded-lg border bg-white disabled:opacity-30 hover:bg-gray-50"><ChevronLeft size={18} /></button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}
            className="p-2 rounded-lg border bg-white disabled:opacity-30 hover:bg-gray-50"><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}
