import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { uploadExport } from "../api";
import api from "../api";
import {
  CheckCircle,
  AlertCircle,
  FileArchive,
  ArrowRight,
  MessageSquare,
  Globe,
  Brain,
  Loader2,
} from "lucide-react";

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [jobStatus, setJobStatus] = useState<any>(null);

  // Poll job status after upload
  useEffect(() => {
    if (!result?.job_id) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/upload/status/${result.job_id}`);
        setJobStatus(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [result?.job_id]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file");
      return;
    }
    setError("");
    setResult(null);
    setJobStatus(null);
    setUploading(true);
    try {
      const { data } = await uploadExport(file);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const isProcessing = jobStatus && jobStatus.status === "running";
  const isDone = jobStatus && jobStatus.status === "completed";
  const isFailed = jobStatus && jobStatus.status === "failed";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload Export</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload a WhatsApp chat export (.zip). The pipeline will parse, scrape, and process through AI.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Step icon={<MessageSquare size={20} className="text-blue-500" />} step="1" title="Parse Messages"
          desc="Extract messages, senders, and URLs" active={uploading} done={!!result} />
        <Step icon={<Globe size={20} className="text-green-500" />} step="2" title="Scrape Articles"
          desc="Fetch content from shared links" active={isProcessing && (jobStatus?.articles_scraped || 0) === 0} done={(jobStatus?.articles_scraped || 0) > 0} />
        <Step icon={<Brain size={20} className="text-purple-500" />} step="3" title="AI Processing"
          desc="Generate TLDRs, tags, key facts" active={isProcessing && (jobStatus?.articles_scraped || 0) > 0} done={isDone} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        {uploading ? (
          <div className="space-y-3">
            <Loader2 size={32} className="mx-auto text-gray-500 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Uploading and parsing export...</p>
          </div>
        ) : (
          <>
            <FileArchive size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-2">Drag and drop your .zip file here</p>
            <label className="inline-block cursor-pointer">
              <span className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                Browse files
              </span>
              <input type="file" accept=".zip" onChange={onFileSelect} className="hidden" />
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Processing status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="text-blue-600 animate-spin" />
            <h3 className="font-semibold text-blue-800">Processing in progress...</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <StatusStat label="Messages" value={jobStatus.total_messages} />
            <StatusStat label="New" value={jobStatus.new_messages} />
            <StatusStat label="Scraped" value={jobStatus.articles_scraped} />
            <StatusStat label="AI Processed" value={jobStatus.articles_processed} />
          </div>
          <div className="flex gap-1 pt-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 processing-dot" />
            <span className="w-2 h-2 rounded-full bg-blue-500 processing-dot" />
            <span className="w-2 h-2 rounded-full bg-blue-500 processing-dot" />
          </div>
        </div>
      )}

      {/* Result */}
      {result && !isProcessing && (
        <div className={`border rounded-lg p-5 space-y-4 ${
          isFailed ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}>
          <div className="flex items-center gap-2">
            {isFailed ? (
              <><AlertCircle size={18} className="text-red-600" /><h3 className="font-semibold text-red-800">Processing Failed</h3></>
            ) : (
              <><CheckCircle size={18} className="text-green-600" /><h3 className="font-semibold text-green-800">
                {isDone ? "Processing Complete" : "Upload Successful"}
              </h3></>
            )}
          </div>
          {isFailed && jobStatus?.error_message && (
            <p className="text-sm text-red-700">{jobStatus.error_message}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <StatusStat label="Messages Found" value={jobStatus?.total_messages ?? result.messages_found} />
            <StatusStat label="New Messages" value={jobStatus?.new_messages ?? result.new_messages} />
            <StatusStat label="Articles Scraped" value={jobStatus?.articles_scraped ?? 0} />
            <StatusStat label="AI Processed" value={jobStatus?.articles_processed ?? 0} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-green-200">
            <Link to="/articles"
              className="inline-flex items-center gap-1 text-sm font-medium text-green-800 bg-green-200 px-3 py-1.5 rounded-lg hover:bg-green-300">
              View Articles <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ icon, step, title, desc, active, done }: {
  icon: React.ReactNode; step: string; title: string; desc: string; active?: boolean; done?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      active ? "bg-blue-50 border-blue-200" : done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {active ? <Loader2 size={20} className="text-blue-500 animate-spin" /> : done ? <CheckCircle size={20} className="text-green-500" /> : icon}
        <span className="text-xs font-bold text-gray-400">STEP {step}</span>
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function StatusStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
