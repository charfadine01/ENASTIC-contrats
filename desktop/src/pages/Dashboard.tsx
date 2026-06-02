import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  Plus,
  Users as UsersIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Classe, Contract, Ecue, Enseignant, Niveau } from "@/lib/types";

/** Année académique en cours (septembre N → août N+1). */
function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [ecues, setEcues] = useState<Ecue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, e, n, cl, ec] = await Promise.all([
        api.get<Contract[]>("/contracts").catch(() => ({ data: [] as Contract[] })),
        api.get<Enseignant[]>("/enseignants").catch(() => ({ data: [] as Enseignant[] })),
        api.get<Niveau[]>("/niveaux").catch(() => ({ data: [] as Niveau[] })),
        api.get<Classe[]>("/classes").catch(() => ({ data: [] as Classe[] })),
        api.get<Ecue[]>("/ecues").catch(() => ({ data: [] as Ecue[] })),
      ]);
      if (!alive) return;
      setContracts(c.data);
      setEnseignants(e.data);
      setNiveaux(n.data);
      setClasses(cl.data);
      setEcues(ec.data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const anneeCourante = currentAcademicYear();

  const stats = useMemo(() => {
    const contratsAnnee = contracts.filter((c) => c.academic_year === anneeCourante);
    const ecuesContrats = contracts.reduce((acc, c) => acc + (c.ecue_count || 0), 0);

    // Répartition par grade (sur tous les contrats).
    const parGrade = new Map<string, number>();
    for (const c of contracts) {
      parGrade.set(c.teacher_grade, (parGrade.get(c.teacher_grade) ?? 0) + 1);
    }
    const grades = Array.from(parGrade.entries()).sort((a, b) => b[1] - a[1]);

    return {
      totalContrats: contracts.length,
      contratsAnnee: contratsAnnee.length,
      ecuesContrats,
      grades,
    };
  }, [contracts, anneeCourante]);

  if (loading) {
    return <div className="p-8 text-gray-500">Chargement du tableau de bord…</div>;
  }

  const cards = [
    {
      label: "Contrats générés",
      value: stats.totalContrats,
      hint: `${stats.contratsAnnee} en ${anneeCourante}`,
      icon: FileText,
      onClick: () => navigate("/historique"),
    },
    {
      label: "Enseignants",
      value: enseignants.length,
      hint: "au répertoire",
      icon: UsersIcon,
      onClick: isAdmin ? () => navigate("/academique") : undefined,
    },
    {
      label: "ECUEs au catalogue",
      value: ecues.length,
      hint: `${classes.length} classe${classes.length > 1 ? "s" : ""} · ${niveaux.length} niveau${niveaux.length > 1 ? "x" : ""}`,
      icon: BookOpen,
      onClick: isAdmin ? () => navigate("/academique") : undefined,
    },
    {
      label: "ECUEs dans les contrats",
      value: stats.ecuesContrats,
      hint: "toutes années confondues",
      icon: Layers,
      onClick: undefined,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Bonjour {user?.full_name || user?.username} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Année académique en cours : <span className="font-medium">{anneeCourante}</span>
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-enastic-500 hover:bg-enastic-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus size={16} /> Nouveau contrat
        </button>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              disabled={!card.onClick}
              className={
                "text-left bg-white border border-gray-200 rounded-xl p-5 transition-colors " +
                (card.onClick ? "hover:border-enastic-300 hover:shadow-sm cursor-pointer" : "cursor-default")
              }
            >
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Icon size={18} className="text-enastic-600" />
                <span className="text-xs font-medium uppercase tracking-wide">{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-1">{card.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Répartition par grade */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={18} className="text-enastic-600" />
          <h3 className="font-semibold text-gray-900">Contrats par grade</h3>
        </div>
        {stats.grades.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun contrat pour l'instant.{" "}
            <button onClick={() => navigate("/")} className="text-enastic-600 hover:underline">
              Générer le premier contrat
            </button>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {stats.grades.map(([grade, count]) => {
              const pct = stats.totalContrats > 0 ? (count / stats.totalContrats) * 100 : 0;
              return (
                <div key={grade} className="flex items-center gap-3">
                  <div className="w-48 text-sm text-gray-700 shrink-0">{grade}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-enastic-500 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-medium text-gray-700">{count}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
