import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getArticle,
  getArticleNotes,
  createArticleNote,
  updateArticleNote,
  deleteArticleNote,
} from "../api";
import { getStoredUser } from "../auth";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  User,
  StickyNote,
  Send,
  Pencil,
  Trash2,
  X,
  Check,
  Lightbulb,
  Users,
  Cpu,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

function detectDir(text: string): "rtl" | "ltr" {
  const hebrewRe = /[\u0590-\u05FF]/;
  const arabicRe = /[\u0600-\u06FF]/;
  return hebrewRe.test(text) || arabicRe.test(text) ? "rtl" : "ltr";
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUser = getStoredUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ["article", id],
    queryFn: () => getArticle(id!),
    enabled: !!id,
  });

  const notesQ = useQuery({
    queryKey: ["notes", id],
    queryFn: () => getArticleNotes(id!),
    enabled: !!id,
  });

  const [noteText, setNoteText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const addNote = useMutation({
    mutationFn: () => createArticleNote(id!, noteText),
    onSuccess: () => { setNoteText(""); queryClient.invalidateQueries({ queryKey: ["notes", id] }); },
  });

  const editNote = useMutation({
    mutationFn: () => updateArticleNote(editingId!, editText),
    onSuccess: () => { setEditingId(null); setEditText(""); queryClient.invalidateQueries({ queryKey: ["notes", id] }); },
  });

  const removeNote = useMutation({
    mutationFn: (noteId: string) => deleteArticleNote(noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", id] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading article...</p>;
  if (error) return <p className="text-sm text-red-600">Failed to load article.</p>;

  const a = data?.data;
  if (!a) return <p className="text-sm text-gray-500">Article not found.</p>;

  const notes = notesQ.data?.data || [];
  const contentDir = a.tldr ? detectDir(a.tldr) : a.clean_text ? detectDir(a.clean_text) : "ltr";
  const titleDir = a.title ? detectDir(a.title) : "ltr";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to Intel Feed
      </Link>

      {/* Article header */}
      <div className="news-card p-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {a.relevance_score && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              a.relevance_score >= 4 ? "score-critical" : a.relevance_score >= 3 ? "score-high" : "score-medium"
            }`}>
              Relevance: {a.relevance_score}/5
            </span>
          )}
          {a.language && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase font-medium">
              {a.language}
            </span>
          )}
          {a.tags?.map((t: string) => (
            <Link key={t} to={`/articles?tag=${encodeURIComponent(t)}`}
              className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100">
              {t}
            </Link>
          ))}
        </div>

        <h1 className="text-xl font-bold text-gray-900 leading-tight" dir={titleDir}>
          {a.title || "Untitled"}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
          {a.published_date && (
            <span className="flex items-center gap-1"><Clock size={14} /> {a.published_date}</span>
          )}
          {a.shared_by && (
            <span className="flex items-center gap-1"><User size={14} /> {a.shared_by}</span>
          )}
          {a.word_count > 0 && <span>{a.word_count.toLocaleString()} words</span>}
          <a href={a.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
            Source <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* TLDR */}
      {a.tldr && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">TLDR</h3>
          <p className="text-sm text-blue-900 leading-relaxed" dir={contentDir}>{a.tldr}</p>
        </div>
      )}

      {/* Intelligence sections — 2 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {a.key_facts?.length > 0 && (
          <Section icon={<Lightbulb size={16} />} title="Key Facts">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700" dir={contentDir}>
              {a.key_facts.map((f: any, i: number) => (
                <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
              ))}
            </ul>
          </Section>
        )}

        {a.people?.length > 0 && (
          <Section icon={<Users size={16} />} title="People & Organizations">
            <div className="space-y-2" dir={contentDir}>
              {a.people.map((p: any, i: number) => (
                <div key={i} className="text-sm bg-gray-50 rounded-lg p-2.5">
                  <span className="font-medium">{p.name}</span>
                  {p.role && <span className="text-gray-500"> - {p.role}</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {a.technologies?.length > 0 && (
          <Section icon={<Cpu size={16} />} title="Technologies">
            <div className="flex flex-wrap gap-2">
              {a.technologies.map((t: any, i: number) => (
                <span key={i} className="text-sm bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                  {typeof t === "string" ? t : t.name || JSON.stringify(t)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {a.dates?.length > 0 && (
          <Section icon={<Calendar size={16} />} title="Important Dates">
            <div className="space-y-2" dir={contentDir}>
              {a.dates.map((d: any, i: number) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{d.date}</span>
                  {d.context && <span className="text-gray-500"> - {d.context}</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {a.action_items?.length > 0 && (
          <Section icon={<AlertTriangle size={16} />} title="Action Items" className="md:col-span-2">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700" dir={contentDir}>
              {a.action_items.map((item: any, i: number) => (
                <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Notes */}
      <div className="news-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <StickyNote size={18} className="text-amber-500" />
          <h3 className="font-semibold text-sm text-gray-900">Notes ({notes.length})</h3>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (noteText.trim()) addNote.mutate(); }} className="flex gap-2 mb-4">
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..." rows={2}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <button type="submit" disabled={!noteText.trim() || addNote.isPending}
            className="self-end bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
            <Send size={14} /> Add
          </button>
        </form>

        <div className="space-y-3">
          {notes.length === 0 && <p className="text-sm text-gray-400 italic">No notes yet.</p>}
          {notes.map((note: any) => (
            <div key={note.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => editNote.mutate()} disabled={!editText.trim()}
                      className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Check size={12} /> Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-lg flex items-center gap-1"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {note.username} &middot; {note.created_at ? format(new Date(note.created_at), "MMM d, yyyy HH:mm") : ""}
                    </span>
                    {(note.user_id === currentUser?.id || currentUser?.role === "admin") && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingId(note.id); setEditText(note.content); }} className="text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
                        <button onClick={() => { if (confirm("Delete this note?")) removeNote.mutate(note.id); }} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full article text */}
      {a.clean_text && (
        <div className="news-card p-6">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Full Article</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto"
            dir={detectDir(a.clean_text)}>
            {a.clean_text}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children, className = "" }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`news-card p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}
