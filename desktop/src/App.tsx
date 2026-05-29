import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import GenerateContract from "@/pages/GenerateContract";
import History from "@/pages/History";
import Academic from "@/pages/Academic";
import Users from "@/pages/Users";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Splash from "@/pages/Splash";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, apiStatus } = useAuth();
  if (apiStatus !== "ready") {
    return <Splash status={apiStatus} onRetry={() => window.location.reload()} />;
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Chargement...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginGate({ children }: { children: React.ReactNode }) {
  const { apiStatus } = useAuth();
  if (apiStatus !== "ready") {
    return <Splash status={apiStatus} onRetry={() => window.location.reload()} />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginGate>
                <Login />
              </LoginGate>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<GenerateContract />} />
            <Route path="historique" element={<History />} />
            <Route
              path="academique"
              element={
                <AdminRoute>
                  <Academic />
                </AdminRoute>
              }
            />
            <Route
              path="utilisateurs"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route
              path="parametres"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
            <Route path="profil" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
