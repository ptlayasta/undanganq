import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await apiClient.post("/auth/session", { session_id: sessionId });
        setUser(data.user);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
  }, [location.hash, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f8f6]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-neutral-500 font-body">Menghubungkan akun...</p>
      </div>
    </div>
  );
}
