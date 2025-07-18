import { useState, useEffect, useRef, useOutletContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Link,
  Outlet,
} from "react-router-dom";
import GoogleSignInButton from "./components/GoogleSignInButton";
import ConnectGmailButton from "./components/ConnectGmailButton";
import GmailCallback from "./GmailCallback";
import ResumeManager from "./components/ResumeManager";
import ContactManager from "./components/ContactManager";
import EmailTemplateEditor from "./components/EmailTemplateEditor";
import "./App.css";
import { createContext, useContext } from "react";
import TermsOfService from "./TermsOfService";

// AuthContext for user/auth state
const AuthContext = createContext();
function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const jwt = sessionStorage.getItem("jwt");
    const user = sessionStorage.getItem("user");
    return jwt && user ? { jwt, user: JSON.parse(user) } : null;
  });
  // Login handler
  const login = (data) => {
    setAuth({ jwt: data.token, user: data.user });
    sessionStorage.setItem("jwt", data.token);
    sessionStorage.setItem("user", JSON.stringify(data.user));
  };
  // Logout handler
  const logout = () => {
    setAuth(null);
    sessionStorage.clear();
  };
  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function Layout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Handle delete data (still uses sessionStorage for JWT)
  const handleDeleteData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all your data? This action cannot be undone."
      )
    )
      return;
    const jwt = sessionStorage.getItem("jwt");
    try {
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/delete-account`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );
      logout();
      alert("Your account and all data have been deleted.");
    } catch (err) {
      alert("Failed to delete account. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white shadow flex items-center justify-between px-6 py-3 border-b">
        <Link
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-base">
            JM
          </span>
          <span className="text-2xl font-bold text-yellow-700">Job Mailer</span>
        </Link>
        {/* Profile section */}
        {auth?.user && (
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-2 focus:outline-none px-2 py-1 rounded-full bg-white hover:bg-gray-100 border border-gray-200 shadow-sm transition"
              style={{ minHeight: 40 }}
              onClick={() => setDropdownOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <span className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border-2 border-white">
                {auth.user.avatar ? (
                  <img
                    src={auth.user.avatar}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="bg-blue-500 text-white w-full h-full flex items-center justify-center text-base font-bold select-none">
                    {auth.user.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "U"}
                  </span>
                )}
              </span>
              <span className="text-yellow-700 font-bold text-base select-none">
                {auth.user.name}
              </span>
              <span className="material-icons text-gray-400 text-base">
                expand_more
              </span>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-2 animate-fade-in">
                <button
                  className="bg-white w-full flex items-center gap-3 px-4 py-2 text-yellow-700 font-semibold hover:bg-yellow-50 transition text-sm rounded-lg"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/mail-list");
                  }}
                >
                  <span className="material-icons text-yellow-700 text-base">
                    mail
                  </span>
                  Mail Lists
                </button>
                <button
                  className="bg-white w-full flex items-center gap-3 px-4 py-2 text-yellow-700 font-semibold hover:bg-yellow-50 transition text-sm rounded-lg"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/privacy");
                  }}
                >
                  <span className="material-icons text-yellow-700 text-base">
                    shield
                  </span>
                  Privacy Policy
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  className="bg-white w-full flex items-center gap-3 px-4 py-2 text-gray-700 font-semibold hover:bg-gray-100 transition text-sm rounded-lg"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                >
                  <span className="material-icons text-gray-700 text-base">
                    logout
                  </span>
                  Logout
                </button>
                <button
                  className="bg-white w-full flex items-center gap-3 px-4 py-2 text-red-600 font-semibold hover:bg-red-50 transition text-sm rounded-lg"
                  onClick={handleDeleteData}
                >
                  <span className="material-icons text-red-600 text-base">
                    delete
                  </span>
                  Delete My Data
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      {/* Welcome Heading */}
      <div className="w-full flex flex-col items-center justify-center py-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-yellow-700 mb-2">
          Welcome to Job Mailer
        </h1>
      </div>
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="w-full bg-white shadow flex justify-center items-center py-3 border-t z-20 mt-8">
        <span className="text-sm text-gray-500">
          &copy; 2024 Job Mailer &mdash;{" "}
          <Link to="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          {" | "}
          <Link to="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
        </span>
      </footer>
    </div>
  );
}

function MainApp() {
  const { auth, login, logout } = useAuth();
  const [gmailConnected, setGmailConnected] = useState(
    () => sessionStorage.getItem("gmailConnected") === "true"
  );
  const outletContext = useOutletContext && useOutletContext();

  useEffect(() => {
    // Detect Gmail connection from sessionStorage
    if (sessionStorage.getItem("gmailConnected") === "true") {
      setGmailConnected(true);
    }
  }, []);

  const handleLogin = (data) => {
    login(data);
  };

  const handleLogout =
    outletContext?.handleLogout ||
    (() => {
      logout();
      setGmailConnected(false);
      sessionStorage.setItem("gmailConnected", "false");
      window.dispatchEvent(new Event("gmailDisconnected"));
    });

  const handleDisconnectGmail = async () => {
    if (!auth) return;
    try {
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/gmail/disconnect`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.jwt}` },
        }
      );
      setGmailConnected(false);
      sessionStorage.setItem("gmailConnected", "false");
      window.dispatchEvent(new Event("gmailDisconnected"));
    } catch (err) {
      alert("Failed to disconnect Gmail");
    }
  };

  const handleDeleteData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all your data? This action cannot be undone."
      )
    )
      return;
    try {
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/delete-account`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${auth.jwt}` },
        }
      );
      handleLogout();
      alert("Your account and all data have been deleted.");
    } catch (err) {
      alert("Failed to delete account. Please try again.");
    }
  };

  // PHASE 2: Show login if not authenticated, else show dashboard grid with real content
  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <GoogleSignInButton onLogin={handleLogin} />
      </div>
    );
  }

  // If authenticated, show dashboard grid with real components
  return (
    <div className="w-full px-2 md:px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* User Profile Card */}
      <section className="bg-white rounded shadow p-6 min-h-[200px] flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-yellow-700 flex items-center gap-2 mb-4">
          <span className="material-icons text-yellow-700">person</span>User
          Profile
        </h2>
        <div className="flex items-center gap-4 mt-2">
          <span className="bg-blue-200 text-blue-800 rounded-full w-14 h-14 flex items-center justify-center text-3xl font-bold overflow-hidden">
            {auth.user.avatar ? (
              <img
                src={auth.user.avatar}
                alt="avatar"
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              auth.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"
            )}
          </span>
          <div>
            <div className="text-lg font-bold text-yellow-700">
              {auth.user.name}
            </div>
            <div className="text-sm text-gray-400">{auth.user.email}</div>
          </div>
        </div>
        {/* Gmail Integration Row */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="material-icons text-yellow-600">mail</span>
            <span className="text-lg font-bold text-yellow-700">
              Gmail Integration
            </span>
          </div>
          {!gmailConnected ? (
            <span className="bg-gray-900 text-white px-4 py-1 rounded-full flex items-center gap-1 font-semibold text-sm">
              <span className="material-icons text-base">cancel</span>Not
              Connected
            </span>
          ) : (
            <span className="bg-green-600 text-white px-4 py-1 rounded-full flex items-center gap-1 font-semibold text-sm">
              <span className="material-icons text-base">check_circle</span>
              Connected
            </span>
          )}
        </div>
        {/* Connect/Disconnect Button and Success Message */}
        {!gmailConnected ? (
          <div className="w-full mt-4">
            <ConnectGmailButton jwt={auth.jwt} />
          </div>
        ) : (
          <>
            <div className="text-green-600 font-semibold flex items-center gap-2 mt-4">
              <span className="material-icons text-base">check_circle</span>
              Gmail successfully connected! You can now send emails.
            </div>
            <button
              className="w-full flex items-center justify-center gap-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-bold text-lg rounded-lg py-4 mt-2 border border-yellow-300 transition"
              onClick={handleDisconnectGmail}
            >
              <span className="material-icons">link_off</span>Disconnect Gmail
            </button>
          </>
        )}
        <hr className="my-6 border-t border-gray-200" />
        <div className="flex gap-4">
          <button
            className="w-full flex items-center justify-center gap-2 border-2 border-yellow-400 rounded-lg py-2 font-bold text-yellow-700 bg-white hover:bg-yellow-50 transition"
            onClick={handleLogout}
          >
            <span className="material-icons">logout</span>Logout
          </button>
          <button
            className="w-full flex items-center justify-center gap-2 border-2 border-red-400 rounded-lg py-2 font-bold text-red-600 bg-white hover:bg-red-50 transition"
            onClick={handleDeleteData}
          >
            <span className="material-icons">delete</span>Delete My Data
          </button>
        </div>
      </section>
      {/* ContactManager Card (includes Bulk Email, Logs, Contacts) */}
      <section className="bg-white rounded shadow p-6 min-h-[200px]">
        <ContactManager jwt={auth.jwt} />
      </section>
      {/* Resume Management Card */}
      <section className="bg-white rounded shadow p-6 min-h-[200px]">
        <ResumeManager jwt={auth.jwt} />
      </section>
      {/* Email Template Editor Card */}
      <section className="bg-white rounded shadow p-6 min-h-[200px]">
        <EmailTemplateEditor
          jwt={auth.jwt}
          userName={auth.user.name}
          userEmail={auth.user.email}
        />
      </section>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded shadow p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">Privacy Policy</h2>
      <p className="mb-2">
        <b>Job Mailer</b> values your privacy. We only collect the minimum data
        necessary to provide our service:
      </p>
      <ul className="list-disc ml-6 mb-2">
        <li>
          Your name, email, and Google account info (for authentication and
          sending emails)
        </li>
        <li>Your uploaded resume (stored securely in the cloud)</li>
        <li>
          Your contact lists and email logs (stored securely, only accessible to
          you)
        </li>
      </ul>
      <p className="mb-2">
        <b>How we use your data:</b> Only to send emails on your behalf, manage
        your contacts, and provide logs. We never share or sell your data.
      </p>
      <p className="mb-2">
        <b>Gmail Access:</b> We use Google OAuth to send emails via your Gmail
        account. You can disconnect Gmail at any time. We never see or store
        your Gmail password.
      </p>
      <p className="mb-2">
        <b>Data Deletion:</b> You can delete all your data at any time using the
        "Delete My Data" button. This will remove your account, resume,
        contacts, logs, and Gmail tokens from our servers.
      </p>
      <p className="mb-2">
        <b>GDPR Rights:</b> You have the right to access, correct, or delete
        your data. For any privacy concerns, contact us at{" "}
        <a
          href="mailto:rounitrakesh365@gmail.com"
          className="text-blue-600 underline"
        >
          support@example.com
        </a>
        .
      </p>
      <p className="mb-2">
        <b>Security:</b> We use industry-standard security practices to protect
        your data.
      </p>
      <p className="mb-2">
        <b>Policy Updates:</b> We may update this policy. Significant changes
        will be communicated in-app.
      </p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/gmail-callback" element={<GmailCallback />} />
          <Route element={<Layout />}>
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/" element={<MainApp />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
