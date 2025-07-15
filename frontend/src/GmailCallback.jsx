import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function GmailCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const jwt = sessionStorage.getItem("jwt");
    console.log("GmailCallback: code =", code, "jwt present =", !!jwt);
    if (!code || !jwt) {
      alert("Missing code or not logged in.");
      navigate("/");
      return;
    }
    handled.current = true;
    fetch(
      `${
        import.meta.env.VITE_API_BASE_URL
      }/api/auth/gmail/callback?code=${code}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          sessionStorage.setItem("gmailConnected", "true");
          // Clear code from URL after success
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
          navigate("/");
        } else {
          // Clear code from URL after error
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
          alert(data.error || "Failed to connect Gmail");
          navigate("/");
        }
      })
      .catch(() => {
        // Clear code from URL after error
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        alert("Failed to connect Gmail");
        navigate("/");
      });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-lg">Connecting Gmail...</div>
    </div>
  );
}
