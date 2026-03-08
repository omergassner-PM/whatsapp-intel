import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { search as searchApi } from "../api";
import { Search as SearchIcon } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => searchApi({ q: submitted, limit: 30 }),
    enabled: !!submitted,
  });

  const results = data?.data?.results || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSubmitted(query.trim());
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Search</h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles, key facts, technologies..."
            className="w-full border rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <button
          type="submit"
          className="bg-gray-900 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-500">Searching...</p>}

      {submitted && !isLoading && (
        <p className="text-sm text-gray-500">
          {results.length} result{results.length !== 1 ? "s" : ""} for "{submitted}"
        </p>
      )}

      <div className="space-y-3">
        {results.map((r: any) => (
          <Link
            key={r.id}
            to={`/articles/${r.id}`}
            className="block bg-white rounded-lg border p-4 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">{r.title || "Untitled"}</p>
                {r.match_snippet && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-3">
                    {r.match_snippet}
                  </p>
                )}
                {r.tldr && !r.match_snippet && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.tldr}</p>
                )}
              </div>
              {r.relevance_score && (
                <span
                  className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${
                    r.relevance_score >= 4
                      ? "bg-red-100 text-red-700"
                      : r.relevance_score >= 3
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {r.relevance_score}/5
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
