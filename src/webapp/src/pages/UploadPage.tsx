import { useState, useCallback } from "react";
import { uploadExport } from "../api";
import { Upload, CheckCircle, AlertCircle, FileArchive } from "lucide-react";

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
          <div className="space-y-2">
            <div className="animate-spin mx-auto w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full" />
            <p className="text-sm text-gray-600">Processing export...</p>
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-600" />
            <h3 className="font-semibold text-green-800">Upload Successful</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Messages Found</p>
              <p className="text-lg font-bold">{result.messages_found}</p>
            </div>
            <div>
              <p className="text-gray-500">New Messages</p>
              <p className="text-lg font-bold">{result.new_messages}</p>
            </div>
            <div>
              <p className="text-gray-500">Duplicates Skipped</p>
              <p className="text-lg font-bold">{result.skipped_duplicates}</p>
            </div>
            <div>
              <p className="text-gray-500">URLs Found</p>
              <p className="text-lg font-bold">{result.urls_found}</p>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-3">
            Scraping and LLM processing are running in the background. Articles will appear
            on the dashboard as they are processed.
          </p>
        </div>
      )}
    </div>
  );
}
