import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[color:var(--cp-text-3)]">
        Loading…
      </div>
    );
  }
  if (user === null) return <Navigate to="/login" replace />;
  return children;
}
