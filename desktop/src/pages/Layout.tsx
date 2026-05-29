import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  History,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
      isActive ? "bg-enastic-500 text-white" : "text-gray-700 hover:bg-gray-100",
    );

  return (
    <div className="h-screen flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-lg font-bold text-enastic-600">ENASTIC</h1>
          <p className="text-xs text-gray-500">Contrats de Vacations</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={linkClass}>
            <FileText size={18} /> Nouveau contrat
          </NavLink>
          <NavLink to="/historique" className={linkClass}>
            <History size={18} /> Historique
          </NavLink>
          {isAdmin && (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase">
                Administration
              </div>
              <NavLink to="/academique" className={linkClass}>
                <BookOpen size={18} /> Académique
              </NavLink>
              <NavLink to="/utilisateurs" className={linkClass}>
                <UsersIcon size={18} /> Utilisateurs
              </NavLink>
              <NavLink to="/parametres" className={linkClass}>
                <SettingsIcon size={18} /> Paramètres
              </NavLink>
            </>
          )}
          <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase">
            Compte
          </div>
          <NavLink to="/profil" className={linkClass}>
            <UserIcon size={18} /> Mon profil
          </NavLink>
        </nav>
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
            <UserIcon size={16} />
            <div className="flex-1 truncate">
              <div className="font-medium">{user?.full_name ?? user?.username}</div>
              <div className="text-xs text-gray-400">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
