import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      email,
      full_name: fullName,
    };
    if (newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    try {
      await api.put("/profile", payload);
      setMessage("Profil mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h2>
      <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
          <input
            value={user.username}
            disabled
            className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-enastic-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-enastic-500"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="font-medium text-gray-800 mb-3">Changer le mot de passe</h3>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe (min. 6 caractères)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
        {message && <div className="text-sm text-green-700 bg-green-50 rounded p-2">{message}</div>}

        <button
          type="submit"
          disabled={saving}
          className="bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white font-medium px-5 py-2 rounded"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
