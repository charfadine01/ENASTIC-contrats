interface SplashProps {
  status: "checking" | "down";
  onRetry?: () => void;
}

export default function Splash({ status, onRetry }: SplashProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-enastic-500 to-enastic-700 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 text-center">
        <h1 className="text-3xl font-bold text-enastic-600 mb-1">ENASTIC</h1>
        <p className="text-sm text-gray-500 mb-8">Contrats de Vacations</p>

        {status === "checking" ? (
          <>
            <div className="mx-auto w-12 h-12 border-4 border-enastic-100 border-t-enastic-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-700 font-medium">Démarrage de l'application…</p>
            <p className="text-xs text-gray-400 mt-2">
              Initialisation des services internes (quelques secondes).
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-2xl">
              !
            </div>
            <p className="text-gray-800 font-semibold mb-2">Service non disponible</p>
            <p className="text-sm text-gray-600 mb-4">
              L'application n'a pas pu joindre son moteur interne après 20 secondes.
            </p>
            <ul className="text-xs text-gray-500 text-left mb-4 list-disc list-inside space-y-1">
              <li>Fermez et relancez l'application</li>
              <li>Si le problème persiste, redémarrez votre ordinateur</li>
            </ul>
            {onRetry && (
              <button
                onClick={onRetry}
                className="bg-enastic-500 hover:bg-enastic-600 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                Réessayer
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
