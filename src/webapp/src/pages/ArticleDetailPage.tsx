import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getArticle } from "../api";
import { ArrowLeft, ExternalLink, Clock, User } from "lucide-react";

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["article", id],
    queryFn: () => getArticle(id!),
    enabled: !!id,
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-600">Failed to load article.</p>;

  const a = data?.data;
  if (!a) return <p className="text-sm text-gray-500">Article not found.</p>;

  return (
    <div className="space-y-6">
      <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to articles
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{a.title || "Untitled"}</h2>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
          {a.published_date && (
            <span className="flex items-center gap-1">
              <Clock size={14} /> {a.published_date}
            </span>
          )}
          {a.shared_by && (
            <span className="flex items-center gap-1">
              <User size={14} /> Shared by {a.shared_by}
            </span>
          )}
          {a.word_count > 0 && <span>{a.word_count.toLocaleString()} words</span>}
          <a
            href={a.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            Source <ExternalLink size={14} />
          </a>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {a.tags?.map((t: string) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
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
              Relevance: {a.relevance_score}/5
            </span>
          )}
        </div>
      </div>

      {/* TLDR */}
      {a.tldr && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">TLDR</h3>
          <p className="text-sm text-blue-900 leading-relaxed">{a.tldr}</p>
        </div>
      )}

      {/* Key Facts */}
      {a.key_facts?.length > 0 && (
        <Section title="Key Facts">
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {a.key_facts.map((f: any, i: number) => (
              <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* People */}
      {a.people?.length > 0 && (
        <Section title="People & Organizations">
          <div className="grid gap-2">
            {a.people.map((p: any, i: number) => (
              <div key={i} className="text-sm bg-gray-50 rounded p-3">
                <span className="font-medium">{p.name}</span>
                {p.role && <span className="text-gray-500"> — {p.role}</span>}
                {p.context && <p className="text-gray-500 mt-0.5">{p.context}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Technologies */}
      {a.technologies?.length > 0 && (
        <Section title="Technologies">
          <div className="flex flex-wrap gap-2">
            {a.technologies.map((t: any, i: number) => (
              <span key={i} className="text-sm bg-purple-50 text-purple-700 px-3 py-1 rounded">
                {typeof t === "string" ? t : t.name || JSON.stringify(t)}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Dates */}
      {a.dates?.length > 0 && (
        <Section title="Important Dates">
          <div className="space-y-2">
            {a.dates.map((d: any, i: number) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{d.date}</span>
                {d.context && <span className="text-gray-500"> — {d.context}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Action Items */}
      {a.action_items?.length > 0 && (
        <Section title="Action Items">
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {a.action_items.map((item: any, i: number) => (
              <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Full article text */}
      {a.clean_text && (
        <Section title="Full Article">
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
            {a.clean_text}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <h3 className="font-semibold text-sm text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}
