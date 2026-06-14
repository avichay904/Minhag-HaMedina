import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AppShell } from './components/ui/AppShell';
import { SurveyRunner } from './features/survey/SurveyRunner';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { LeaderboardScreen } from './features/leaderboard/LeaderboardScreen';
import { PublicResultsScreen } from './features/results/PublicResultsScreen';

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <SurveyRunner /> },
      { path: '/profile', element: <ProfileScreen /> },
      { path: '/leaderboard', element: <LeaderboardScreen /> },
      { path: '/results', element: <PublicResultsScreen /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
