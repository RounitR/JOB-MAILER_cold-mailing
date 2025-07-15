import { useEffect, useRef } from "react";

export default function GoogleSignInButton({ onLogin }) {
  const buttonDiv = useRef(null);

  useEffect(() => {
    // Load Google Identity Services SDK
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && buttonDiv.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: async (response) => {
            // Send ID token to backend
            const res = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/api/auth/google`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: response.credential }),
              }
            );
            const data = await res.json();
            if (data.token) {
              onLogin(data);
            } else {
              alert(data.error || "Login failed");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonDiv.current, {
          theme: "outline",
          size: "large",
        });
      }
    };
    return () => {
      document.body.removeChild(script);
    };
  }, [onLogin]);

  return <div ref={buttonDiv}></div>;
}
