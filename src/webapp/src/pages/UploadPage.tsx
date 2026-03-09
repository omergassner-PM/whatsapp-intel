import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { uploadExport } from "../api";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileArchive,
  ArrowRight,
  MessageSquare,
  Globe,
  Brain,
} from "lucide-react";

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file");
      return;
    }
    setError("");
    setResult(null);
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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Upload Export</h2>
      <p className="text-sm text-gray-500">
        Upload a WhatsApp chat export (.zip) file. The system will parse messages,
        scrape shared URLs, and process articles through the intelligence pipeline.
      </p>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Step
          icon={<MessageSquare size={20} className="text-blue-500" />}
          step="1"
          title="Parse Messages"
          desc="Extract messages, senders, and URLs from the WhatsApp export"
        />
        <Step
          icon={<Globe size={20} className="text-green-500" />}
          step="2"
          title="Scrape Articles"
          desc="Fetch and extract article content from all shared links"
        />
        <Step
          icon={<Brain size={20} className="text-purple-500" />}
          step="3"
          title="AI Processing"
          desc="Generate TLDRs, extract key facts, people, technologies, and tags"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        {uploading ? (
          <div className="space-y-3">
            <div className="animate-spin mx-auto w-10 h-10 border-2 border-gray-300 border-t-gray-800 rounded-full" />
            <p className="text-sm font-medium text-gray-700">
              Processing export...
            </p>
            <p className="text-xs text-gray-500">
              Parsing messages, scraping URLs, and running AI analysis. This may take a few minutes.
            </p>
          </div>
        ) : (
          <>
            <FileArchive size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop your WhatsApp export .zip file here
            </p>
            <label className="inline-block cursor-pointer">
              <span className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800">
                Browse files
              </span>
              <input
                type="file"
                accept=".zip"
                onChange={onFileSelect}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <h3 className="font-semibold text-green-800">Upload Successful</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Stat label="Messages Found" value={result.messages_found} />
            <Stat label="New Messages" value={result.new_messages} />
            <Stat label="Duplicates Skipped" value={result.skipped_duplicates} />
            <Stat label="URLs Found" value={result.urls_found} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-green-200">
            <p className="text-xs text-green-700">
              Scraping and AI processing run in the background. Articles will appear as they finish.
            </p>
            <Link
              to="/articles"
              className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-200 px-3 py-1 rounded hover:bg-green-300"
            >
              View Articles <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  icon,
  step,
  title,
  desc,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-bold text-gray-400">STEP {step}</span>
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
