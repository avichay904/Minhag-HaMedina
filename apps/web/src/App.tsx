/**
 * App shell — placeholder scaffold. The web worker replaces this with the full
 * router (survey runner, profile, results, leaderboard), i18n provider, React Query
 * client, RTL/LTR direction handling, and the animated survey UX.
 */
export function App() {
  return (
    <main className="flex min-h-full items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-brand-900">מנהג המדינה</h1>
        <p className="mt-2 text-brand-500">Minhag HaMedina — survey platform</p>
      </div>
    </main>
  );
}
