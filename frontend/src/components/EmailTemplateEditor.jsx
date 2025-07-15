import { useState, useEffect } from "react";
import Mustache from "mustache";

const PLACEHOLDERS = ["name", "email", "company", "notes"];
const SAMPLE_CONTACT = {
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme Corp",
  notes: "Referred by John",
};

export default function EmailTemplateEditor({ jwt, userName, userEmail }) {
  console.log("EmailTemplateEditor mounted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Load template on mount
  useEffect(() => {
    if (!jwt) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/template`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setSubject(data.template?.subject || "");
        setBody(data.template?.body || "");
      })
      .catch(() => setError("Failed to load template"))
      .finally(() => setLoading(false));
    // Prefill testEmail with userEmail prop
    setTestEmail(userEmail || "");
  }, [jwt]);

  // Save template
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ subject, body }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      setSuccess("Template saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Test email preview rendering
  // Use the same sample data as backend for preview
  const testSample = {
    name: userName || "Test User",
    email: testEmail,
    company: "Test Company",
    notes: "Test email preview",
  };
  const testSubject = Mustache.render(subject, testSample);
  const testBody = Mustache.render(body, testSample);

  // Debug: log when send is triggered
  useEffect(() => {
    if (testSending) {
      console.log("Sending test email to:", testEmail);
    }
  }, [testSending]);

  // Debug: log when confirmation dialog is shown
  useEffect(() => {
    if (showConfirm) {
      console.log("Confirmation dialog shown for:", testEmail);
    }
  }, [showConfirm]);

  // Send test email
  const handleSendTest = async () => {
    setShowConfirm(false);
    setTestSending(true);
    setTestResult("");
    try {
      console.log("Calling /api/email/test with:", testEmail);
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/email/test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ to: testEmail }),
        }
      );
      console.log("API response status:", res.status);
      const data = await res.json();
      console.log("API response data:", data);
      if (!res.ok) throw new Error(data.error || "Failed to send test email");
      setTestResult("Test email sent successfully!");
    } catch (err) {
      console.error("Test email error:", err);
      setTestResult(
        err.message || "Unknown error occurred while sending test email."
      );
    } finally {
      setTestSending(false);
    }
  };

  // Debug: log when Confirm & Send is clicked
  const handleConfirmAndSend = () => {
    console.log("Confirm & Send clicked");
    handleSendTest();
  };

  useEffect(() => {
    console.log("showConfirm changed:", showConfirm);
  }, [showConfirm]);

  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(() => {
    return sessionStorage.getItem("gmailConnected") === "true";
  });
  useEffect(() => {
    const handler = () =>
      setGmailConnected(sessionStorage.getItem("gmailConnected") === "true");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded shadow p-6 mt-6">
      <h2 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
        <span className="material-icons">email</span>Email Template Editor
      </h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-2">
              Email Template Details
            </h3>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Subject</label>
              <input
                className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line (use {{name}}, {{company}}, etc.)"
              />
              <label className="block font-semibold mb-1 mt-2">Body</label>
              <textarea
                className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Compose your email body here..."
              />
            </div>
            <div className="mb-4">
              <div className="font-semibold mb-1">Available Placeholders:</div>
              <div className="flex gap-2 flex-wrap">
                {PLACEHOLDERS.map((ph) => (
                  <span
                    key={ph}
                    className="bg-gray-200 rounded px-2 py-1 text-sm font-mono"
                  >
                    {"{{" + ph + "}}"}
                  </span>
                ))}
              </div>
            </div>
            <button
              className="w-full px-4 py-2 font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
            {success && <div className="text-green-600 mt-2">{success}</div>}
            {error && <div className="text-red-600 mt-2">{error}</div>}
          </section>
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-2">
              Live Preview (Sample Contact)
            </h3>
            <div className="mb-2">
              <span className="font-semibold">Subject: </span>
              <span>{testSubject}</span>
            </div>
            <div className="border rounded p-3 whitespace-pre-line bg-gray-50">
              {testBody}
            </div>
          </section>
          {/* Test Email Section */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Send Test Email</h3>
            {!gmailConnected && (
              <div className="mb-2 text-sm text-red-600 font-semibold">
                Please connect your Gmail account to send test emails.
              </div>
            )}
            <label className="block font-semibold mb-1">
              Send test email to:
            </label>
            <input
              className="w-full bg-white text-gray-900 border border-gray-300 rounded px-2 py-2 focus:ring-2 focus:ring-yellow-500"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter recipient email"
              disabled={testSending}
            />
            <div className="mb-2">
              <span className="font-semibold">Preview:</span>
              <div className="mt-2">
                <span className="font-semibold">Subject: </span>
                <span>{testSubject}</span>
              </div>
              <div className="border rounded p-3 whitespace-pre-line bg-gray-50">
                {testBody}
              </div>
            </div>
            <button
              className="w-full px-4 py-2 font-bold rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
              onClick={() => {
                console.log("Setting showConfirm to true");
                setShowConfirm(true);
              }}
              disabled={testSending || !testEmail || !gmailConnected}
            >
              {testSending ? "Sending..." : "Send Test Email"}
            </button>
            {testResult && (
              <div
                className={
                  testResult.includes("success")
                    ? "text-green-600 mt-2"
                    : "text-red-600 mt-2"
                }
              >
                {testResult}
              </div>
            )}
          </section>
          {/* Normal modal rendering */}
          {showConfirm && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "white",
                  color: "black",
                  border: "1px solid #ccc",
                  padding: 32,
                  maxWidth: 400,
                  width: "100%",
                  borderRadius: 12,
                  textAlign: "center",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
                }}
              >
                <div className="mb-4 font-bold">Send Test Email</div>
                <div className="mb-4">
                  Are you sure you want to send a test email to{" "}
                  <b>{testEmail}</b>?
                </div>
                <div className="flex gap-4 justify-end">
                  <button
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    onClick={() => setShowConfirm(false)}
                    disabled={testSending}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={handleConfirmAndSend}
                    disabled={testSending}
                  >
                    Confirm & Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
