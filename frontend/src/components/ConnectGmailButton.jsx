export default function ConnectGmailButton({ jwt }) {
  const handleConnect = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/auth/gmail/initiate`
    );
    const data = await res.json();
    if (data.url) {
      // Store JWT in sessionStorage for callback use
      sessionStorage.setItem("jwt", jwt);
      window.location.href = data.url;
    } else {
      alert("Failed to get Gmail connect URL");
    }
  };
  return (
    <button
      className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-lg py-4 transition"
      onClick={handleConnect}
    >
      <span className="material-icons">mail</span>Connect Gmail
    </button>
  );
}
