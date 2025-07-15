import { useState, useEffect } from "react";
import Papa from "papaparse";

const REQUIRED_FIELDS = ["name", "email", "company"];
const OPTIONAL_FIELDS = ["notes"];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

export default function ContactManager({ jwt }) {
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState(1); // 1: upload, 2: map, 3: preview
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedContacts, setSavedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  // Bulk email state
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkSummary, setBulkSummary] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(null);
  // Persistent quota info and sent mail log
  const [sentLog, setSentLog] = useState([]);
  // Batch selection state
  const [batchStart, setBatchStart] = useState(1);
  const [batchEnd, setBatchEnd] = useState(500);
  // State for tracking resend status
  const [resendingIdx, setResendingIdx] = useState(null);
  const [resendResult, setResendResult] = useState({});
  // Filtering and sorting state
  const [logFilter, setLogFilter] = useState("all"); // all, sent, failed
  const [logSort, setLogSort] = useState("desc"); // desc = newest first, asc = oldest first
  // Add gmailConnected state
  const [gmailConnected, setGmailConnected] = useState(() => {
    return sessionStorage.getItem("gmailConnected") === "true";
  });
  // Keep in sync with sessionStorage
  useEffect(() => {
    const handler = () =>
      setGmailConnected(sessionStorage.getItem("gmailConnected") === "true");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Add a window event listener for 'gmailDisconnected' to update gmailConnected state immediately
  useEffect(() => {
    const handler = () => setGmailConnected(false);
    window.addEventListener("gmailDisconnected", handler);
    return () => window.removeEventListener("gmailDisconnected", handler);
  }, []);

  // Compute batch options if contacts > 500
  const batchOptions = [];
  if (savedContacts.length > 500) {
    for (let i = 0; i < savedContacts.length; i += 500) {
      const start = i + 1;
      const end = Math.min(i + 500, savedContacts.length);
      batchOptions.push({ start, end });
    }
  }

  // Fetch saved contacts on mount or after save
  useEffect(() => {
    if (jwt) fetchSavedContacts();
    // eslint-disable-next-line
  }, [jwt]);

  // Fetch quota info and sent log on mount and after sending
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/email/bulk`,
          {
            method: "OPTIONS",
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
        const text = await res.text();
        console.log("Quota fetch raw response:", text); // Debug log
        const data = text ? JSON.parse(text) : {};
        setQuotaInfo(data);
      } catch (err) {
        console.log("Quota fetch error:", err); // Debug log
        setQuotaInfo(null);
      }
    };
    const fetchLog = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/email/log`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          }
        );
        const data = await res.json();
        setSentLog(data.log || []);
      } catch {
        setSentLog([]);
      }
    };
    if (jwt) {
      fetchQuota();
      fetchLog();
    }
  }, [jwt, bulkResults]);

  const fetchSavedContacts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/contacts`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch contacts");
      setSavedContacts(data.contacts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV upload and parse
  const handleFile = (file) => {
    setError("");
    setSuccess("");
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          setError("No columns found in CSV");
          return;
        }
        setHeaders(results.meta.fields);
        setCsvData(results.data);
        setStep(2);
      },
      error: (err) => setError("Failed to parse CSV: " + err.message),
    });
  };

  // Handle mapping change
  const handleMappingChange = (field, header) => {
    setMapping((prev) => ({ ...prev, [field]: header }));
  };

  // Generate preview
  const handlePreview = () => {
    // Map CSV data to contact objects
    const contacts = csvData.map((row) => {
      const contact = {};
      ALL_FIELDS.forEach((field) => {
        const header = mapping[field];
        contact[field] = header ? row[header] : "";
      });
      return contact;
    });
    setPreview(contacts);
    setStep(3);
  };

  // Save contacts to backend
  const handleSaveContacts = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/contacts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ contacts: preview }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save contacts");
      setSuccess("Contacts saved successfully!");
      setStep(1);
      setCsvFile(null);
      setCsvData([]);
      setHeaders([]);
      setMapping({});
      setPreview([]);
      fetchSavedContacts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Bulk email send handler (frontend loop for live progress, now respects batch)
  const handleBulkSend = async () => {
    setBulkSending(true);
    setBulkProgress(0);
    setBulkResults([]);
    setBulkSummary(null);
    setError("");
    let results = [];
    // Use batch range if contacts > 500, else all
    const startIdx = batchOptions.length > 0 ? batchStart - 1 : 0;
    const endIdx = batchOptions.length > 0 ? batchEnd : savedContacts.length;
    let totalToSend = Math.min(
      endIdx - startIdx,
      quotaInfo?.quotaLeft || endIdx - startIdx
    );
    for (let i = 0; i < totalToSend; i++) {
      const contact = savedContacts[startIdx + i];
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/email/bulk`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              start: startIdx + i + 1,
              end: startIdx + i + 1,
            }),
          }
        );
        const data = await res.text();
        const parsed = data ? JSON.parse(data) : {};
        if (parsed.results && parsed.results.length > 0) {
          results.push(parsed.results[0]);
        } else {
          results.push({
            to: contact.email,
            subject: "",
            status: "error",
            error: "No result",
          });
        }
        setBulkResults([...results]);
        setBulkProgress(i + 1);
        setQuotaInfo((prev) =>
          prev
            ? { ...prev, quotaLeft: (prev.quotaLeft || totalToSend) - 1 }
            : prev
        );
      } catch (err) {
        results.push({
          to: contact.email,
          subject: "",
          status: "error",
          error: err.message,
        });
        setBulkResults([...results]);
        setBulkProgress(i + 1);
      }
      if (i < totalToSend - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    setBulkSummary({
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      error: results.filter((r) => r.status === "error").length,
    });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/email/bulk`,
        {
          method: "OPTIONS",
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setQuotaInfo(data);
    } catch {}
    setBulkSending(false);
  };

  // Check if all required fields are mapped
  const canPreview = REQUIRED_FIELDS.every((field) => mapping[field]);

  // Progress bar for bulk sending
  const renderBulkProgress = () => {
    if (!bulkSending || !savedContacts.length) return null;
    const total = Math.min(
      savedContacts.length,
      quotaInfo?.quotaLeft || savedContacts.length
    );
    const current = bulkResults.length;
    const percent = Math.round((current / total) * 100);
    return (
      <div className="w-full mt-2">
        <div className="flex justify-between text-xs mb-1">
          <span>
            Progress: {current} / {total}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded h-3">
          <div
            className="bg-green-500 h-3 rounded"
            style={{ width: `${percent}%`, transition: "width 0.3s" }}
          ></div>
        </div>
      </div>
    );
  };

  // Replace renderQuotaBar with the following:
  const renderQuotaBar = () => {
    if (!quotaInfo || typeof quotaInfo !== "object") {
      return (
        <div className="w-full mb-4 bg-yellow-100 text-yellow-800 rounded p-2 text-center">
          Quota bar unavailable (no data from server)
        </div>
      );
    }
    const sent = 500 - (quotaInfo.quotaLeft || 0);
    const percent = Math.round((sent / 500) * 100);
    return (
      <div className="w-full mb-4 bg-blue-50 rounded-xl shadow-sm p-4 flex flex-col gap-2 border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 rounded-lg p-2 flex items-center justify-center">
              <span className="material-icons text-blue-600 text-2xl">
                send
              </span>
            </span>
            <span className="text-lg font-bold text-yellow-700">
              Daily Email Quota
            </span>
          </div>
          <span className="bg-gray-900 text-white px-4 py-1 rounded-full font-semibold text-sm">
            {sent} / 500
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-yellow-700 font-bold">
            {percent.toFixed(1)}%
          </span>
          <span className="text-blue-900 font-semibold">Emails sent today</span>
        </div>
        <div className="w-full bg-blue-100 rounded h-3 mb-2">
          <div
            className="bg-blue-500 h-3 rounded"
            style={{ width: `${percent}%`, transition: "width 0.3s" }}
          ></div>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <span className="material-icons text-base">check_circle</span>Used:{" "}
            {sent}
          </span>
          <span className="flex items-center gap-1 text-gray-400 font-semibold">
            <span className="material-icons text-base">schedule</span>Remaining:{" "}
            {quotaInfo.quotaLeft}
          </span>
        </div>
      </div>
    );
  };

  // Handler to resend a failed email
  const handleResend = async (log, idx) => {
    setResendingIdx(idx);
    setResendResult({});
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/email/resend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: log.to,
            subject: log.subject,
            body: log.body,
            logIndex: idx,
          }),
        }
      );
      const data = await res.json();
      setResendResult({
        [idx]: data.success ? "success" : data.error || "Failed",
      });
      // Optionally, refresh sent log after resend
      const resLog = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/email/log`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      const dataLog = await resLog.json();
      setSentLog(dataLog.log || []);
    } catch (err) {
      setResendResult({ [idx]: err.message || "Failed" });
    } finally {
      setResendingIdx(null);
    }
  };

  // Compute filtered and sorted log
  const filteredLog = sentLog
    .filter((log) => {
      if (logFilter === "all") return true;
      if (logFilter === "sent") return log.status === "success";
      if (logFilter === "failed") return log.status === "error";
      return true;
    })
    .sort((a, b) => {
      if (logSort === "desc") {
        return new Date(b.timestamp) - new Date(a.timestamp);
      } else {
        return new Date(a.timestamp) - new Date(b.timestamp);
      }
    });

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded shadow p-6 mt-6">
      {renderQuotaBar()}
      <h2 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
        <span className="material-icons">contacts</span>Contact List Management
      </h2>
      {step === 1 && (
        <div className="flex flex-col items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0])}
            className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
          />
          <div className="text-gray-800 text-sm">
            Upload a CSV file with your contacts.
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <div className="mb-4">
            <div className="font-semibold mb-2">
              Map CSV columns to contact fields:
            </div>
            {ALL_FIELDS.map((field) => (
              <div key={field} className="mb-2 flex items-center gap-2">
                <label className="w-24 capitalize">
                  {field}
                  {REQUIRED_FIELDS.includes(field) && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <select
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
                  value={mapping[field] || ""}
                  onChange={(e) => handleMappingChange(field, e.target.value)}
                >
                  <option value="">-- Not Mapped --</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            className="w-full px-4 py-2 font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
            onClick={handlePreview}
            disabled={!canPreview}
          >
            Preview Contacts
          </button>
        </div>
      )}
      {step === 3 && (
        <div>
          <div className="font-semibold mb-2">Preview Contacts:</div>
          <div className="overflow-x-auto max-h-64 border rounded mb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {ALL_FIELDS.map((field) => (
                    <th key={field} className="px-2 py-1 border-b capitalize">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((contact, idx) => (
                  <tr key={idx}>
                    {ALL_FIELDS.map((field) => (
                      <td key={field} className="px-2 py-1 border-b">
                        {contact[field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4">
            <button
              className="w-full px-4 py-2 font-bold rounded bg-gray-400 text-white hover:bg-gray-500"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              Start Over
            </button>
            <button
              className="w-full px-4 py-2 font-bold rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
              onClick={handleSaveContacts}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Contacts"}
            </button>
          </div>
        </div>
      )}
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {/* Show saved contacts */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">Saved Contacts</h3>
        {loading ? (
          <div>Loading...</div>
        ) : savedContacts.length === 0 ? (
          <div className="text-gray-500">No contacts saved yet.</div>
        ) : (
          <div className="overflow-x-auto max-h-64 border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {ALL_FIELDS.map((field) => (
                    <th key={field} className="px-2 py-1 border-b capitalize">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savedContacts.map((contact, idx) => (
                  <tr key={idx}>
                    {ALL_FIELDS.map((field) => (
                      <td key={field} className="px-2 py-1 border-b">
                        {contact[field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Bulk Email Sender UI */}
        {savedContacts.length > 0 && (
          <div className="mt-6">
            {/* Gmail connection check */}
            {!gmailConnected && (
              <div className="mb-2 text-sm text-red-600 font-semibold">
                Please connect your Gmail account to send emails.
              </div>
            )}
            {/* Batch selection UI if contacts > 500 */}
            {batchOptions.length > 0 && (
              <div className="mb-2">
                <label className="font-semibold mr-2">Select Batch:</label>
                <select
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
                  value={`${batchStart}-${batchEnd}`}
                  onChange={(e) => {
                    const [start, end] = e.target.value.split("-").map(Number);
                    setBatchStart(start);
                    setBatchEnd(end);
                  }}
                >
                  {batchOptions.map((opt) => (
                    <option
                      key={opt.start}
                      value={`${opt.start}-${opt.end}`}
                    >{`${opt.start} - ${opt.end}`}</option>
                  ))}
                </select>
              </div>
            )}
            {quotaInfo && (
              <div className="mb-2 text-sm text-gray-700">
                {quotaInfo.quotaLeft === 0 ? (
                  <span className="text-red-600">
                    Daily Gmail quota reached. Try again tomorrow.
                  </span>
                ) : (
                  <>
                    You can send <b>{quotaInfo.quotaLeft}</b> more emails today.
                    <br />
                    {quotaInfo.remaining > 0 && quotaInfo.nextSendTime && (
                      <span>
                        There are <b>{quotaInfo.remaining}</b> contacts
                        remaining. Next batch can be sent after{" "}
                        <b>
                          {new Date(quotaInfo.nextSendTime).toLocaleString()}
                        </b>
                        .
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            <button
              className="w-full px-4 py-2 font-bold rounded bg-green-600 text-white hover:bg-green-700"
              onClick={handleBulkSend}
              disabled={
                bulkSending ||
                (quotaInfo && quotaInfo.quotaLeft === 0) ||
                !gmailConnected
              }
            >
              {bulkSending ? "Sending..." : "Send Bulk Emails"}
            </button>
            {renderBulkProgress()}
            {bulkResults.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Bulk Send Results</h4>
                <div className="mb-2">
                  {bulkSummary && (
                    <span>
                      Sent: {bulkSummary.success} / {bulkSummary.total}{" "}
                      successful, {bulkSummary.error} failed
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto max-h-64 border rounded">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 border-b">To</th>
                        <th className="px-2 py-1 border-b">Subject</th>
                        <th className="px-2 py-1 border-b">Status</th>
                        <th className="px-2 py-1 border-b">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1 border-b">{r.to}</td>
                          <td className="px-2 py-1 border-b">{r.subject}</td>
                          <td
                            className={
                              "px-2 py-1 border-b " +
                              (r.status === "success"
                                ? "text-green-600"
                                : "text-red-600")
                            }
                          >
                            {r.status}
                          </td>
                          <td className="px-2 py-1 border-b">{r.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Sent Emails Log Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">Sent Emails Log</h3>
        {/* Filtering and sorting controls */}
        <div className="flex gap-4 mb-2 items-center">
          <label className="font-semibold">Filter:</label>
          <select
            className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="sent">Sent ✅</option>
            <option value="failed">Failed ❌</option>
          </select>
          <label className="font-semibold ml-4">Sort:</label>
          <select
            className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
            value={logSort}
            onChange={(e) => setLogSort(e.target.value)}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
        {filteredLog.length === 0 ? (
          <div className="text-gray-500">No emails sent yet.</div>
        ) : (
          <div className="overflow-x-auto max-h-64 border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 border-b">Date/Time</th>
                  <th className="px-2 py-1 border-b">To</th>
                  <th className="px-2 py-1 border-b">Subject</th>
                  <th className="px-2 py-1 border-b">Status</th>
                  <th className="px-2 py-1 border-b">Error</th>
                  <th className="px-2 py-1 border-b">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((log, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1 border-b">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : ""}
                    </td>
                    <td className="px-2 py-1 border-b">{log.to}</td>
                    <td className="px-2 py-1 border-b">{log.subject}</td>
                    <td
                      className={
                        "px-2 py-1 border-b " +
                        (log.status === "success"
                          ? "text-green-600"
                          : "text-red-600")
                      }
                    >
                      {log.status}
                    </td>
                    <td className="px-2 py-1 border-b">{log.error}</td>
                    <td className="px-2 py-1 border-b">
                      {log.status === "error" && (
                        <button
                          className="w-full px-2 py-1 font-bold rounded bg-blue-600 text-white hover:bg-blue-700 text-xs"
                          onClick={() => handleResend(log, idx)}
                          disabled={resendingIdx === idx}
                        >
                          {resendingIdx === idx ? "Resending..." : "Re-send"}
                        </button>
                      )}
                      {resendResult[idx] && (
                        <div
                          className={
                            resendResult[idx] === "success"
                              ? "text-green-600 text-xs mt-1"
                              : "text-red-600 text-xs mt-1"
                          }
                        >
                          {resendResult[idx] === "success"
                            ? "Sent!"
                            : resendResult[idx]}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
