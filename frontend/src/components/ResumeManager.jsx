import { useRef, useState, useEffect } from "react";

export default function ResumeManager({ jwt }) {
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef();
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);

  // Fetch resume on mount
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/resume`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then((res) => res.json())
      .then((data) => setResume(data.resume));
  }, [jwt]);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file) => {
    setError("");
    setSuccess("");
    if (!file) return;
    if (
      ![
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.type)
    ) {
      setError("Only PDF and DOCX files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB");
      return;
    }
    uploadResume(file);
  };

  const uploadResume = (file) => {
    setUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append("resume", file);
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/resume/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error((await res.json()).error || "Upload failed");
        return res.json();
      })
      .then((data) => {
        setResume(data.resume);
        setSuccess("Resume uploaded successfully!");
      })
      .catch((err) => setError(err.message))
      .finally(() => setUploading(false));
  };

  const handleDelete = () => {
    if (!window.confirm("Are you sure you want to delete your resume?")) return;
    setError("");
    setSuccess("");
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/resume`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error((await res.json()).error || "Delete failed");
        return res.json();
      })
      .then(() => {
        setResume(null);
        setSuccess("Resume deleted.");
      })
      .catch((err) => setError(err.message));
  };

  const getSignedUrl = async () => {
    setSignedUrlLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/resume/signed-url`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get signed URL");
      return data.url;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSignedUrlLoading(false);
    }
  };

  const handleView = async (e) => {
    e.preventDefault();
    const url = await getSignedUrl();
    if (url) window.open(url, "_blank");
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    const url = await getSignedUrl();
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = resume.filename || "resume";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="w-full bg-white rounded shadow p-6 mt-6">
      <h2 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
        <span className="material-icons">description</span>Resume Management
      </h2>
      {resume && resume.url ? (
        <div className="relative w-full rounded-xl bg-gray-50 border border-gray-200 p-6 flex flex-col gap-4 shadow-sm">
          {/* Uploaded badge absolutely positioned top-right inside the card */}
          <span className="absolute top-4 right-4 bg-green-600 text-white px-4 py-1 rounded-full flex items-center gap-1 font-semibold text-sm z-10">
            <span className="material-icons text-base">check_circle</span>
            Uploaded
          </span>
          <div className="flex items-center gap-4">
            <span className="bg-green-100 rounded-lg p-3 flex items-center justify-center">
              <span className="material-icons text-green-600 text-3xl">
                description
              </span>
            </span>
            <div className="flex-1">
              <div className="text-lg font-bold text-yellow-700">
                {resume.owner || "ROUNIT"}
              </div>
              <div className="text-md font-semibold text-yellow-700">
                {resume.filename}
              </div>
              <div className="text-xs text-gray-400">
                {resume.size ? (resume.size / 1024 / 1024).toFixed(2) : "--"} MB
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <button
              className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 rounded-lg py-2 font-bold text-gray-800 bg-white hover:bg-gray-100 transition"
              onClick={handleView}
              disabled={signedUrlLoading}
            >
              <span className="material-icons">visibility</span>Preview
            </button>
            <button
              className="w-full flex items-center justify-center gap-2 border-2 border-red-400 rounded-lg py-2 font-bold text-red-600 bg-white hover:bg-red-50 transition"
              onClick={handleDelete}
            >
              <span className="material-icons">delete</span>Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-400 rounded p-6 text-center cursor-pointer hover:bg-gray-50"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div>Uploading...</div>
          ) : (
            <>
              <div className="text-gray-800">
                Drag and drop your PDF or DOCX resume here, or click to select a
                file.
              </div>
              <div className="text-xs text-gray-400 mt-2">Max size: 5MB</div>
              <button
                type="button"
                className="w-full px-4 py-2 font-bold rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current.click();
                }}
              >
                Upload Resume
              </button>
            </>
          )}
        </div>
      )}
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {success && <div className="text-green-600 mt-2">{success}</div>}
    </div>
  );
}
