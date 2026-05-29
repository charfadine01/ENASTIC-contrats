import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface NewUser {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "enseignant";
}

const emptyForm: NewUser = {
  username: "",
  email: "",
  password: "",
  full_name: "",
  role: "enseignant",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<NewUser>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<User[]>("/users");
    setUsers(res.data);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    try {
      await api.post("/users", form);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erreur lors de la création");
    }
  }

  async function toggleActive(u: User) {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  }

  async function remove(u: User) {
    if (!confirm(`Supprimer ${u.username} ?`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Utilisateurs</h2>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold mb-3">Nouveau compte</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Nom d'utilisateur"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <input
            placeholder="Nom complet"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <input
            placeholder="Mot de passe (min. 6 caractères)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "enseignant" })}
            className="px-3 py-2 text-sm border border-gray-300 rounded"
          >
            <option value="enseignant">Enseignant</option>
            <option value="admin">Administrateur</option>
          </select>
          <button
            onClick={create}
            className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-4 py-2 rounded text-sm"
          >
            <Plus size={14} /> Créer
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Username</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Nom complet</th>
              <th className="text-left px-4 py-2 font-medium">Rôle</th>
              <th className="text-left px-4 py-2 font-medium">Actif</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2 text-gray-600">{u.email}</td>
                <td className="px-4 py-2 text-gray-600">{u.full_name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      "text-xs px-2 py-0.5 rounded " +
                      (u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700")
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActive(u)}
                    className={
                      "text-xs px-2 py-0.5 rounded " +
                      (u.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700")
                    }
                  >
                    {u.is_active ? "Actif" : "Désactivé"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(u)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
