import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ArticleReaderPage } from "./pages/ArticleReaderPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ExcerptsPage } from "./pages/ExcerptsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ReadingReportPage } from "./pages/ReadingReportPage";
import { TeacherDashboardPage } from "./pages/TeacherDashboardPage";
import { TeacherArticleNewPage } from "./pages/TeacherArticleNewPage";
import { TeacherExercisesPage } from "./pages/TeacherExercisesPage";
import { TeacherStudentsPage } from "./pages/TeacherStudentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ArticleImportPage } from "./pages/ArticleImportPage";
import { WrongAnswersPage } from "./pages/WrongAnswersPage";
import { CommunityPage } from "./pages/CommunityPage";
import { GrammarPage } from "./pages/GrammarPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children, teacherOnly = false }: { children: React.ReactNode; teacherOnly?: boolean }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (teacherOnly && user.role !== "teacher") return <Navigate to="/" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="article/:id" element={<ProtectedRoute><ArticleReaderPage /></ProtectedRoute>} />
        <Route path="vocabulary" element={<ProtectedRoute><VocabularyPage /></ProtectedRoute>} />
        <Route path="review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
        <Route path="excerpts" element={<ProtectedRoute><ExcerptsPage /></ProtectedRoute>} />
        <Route path="leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="report" element={<ProtectedRoute><ReadingReportPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="import" element={<ProtectedRoute><ArticleImportPage /></ProtectedRoute>} />
        <Route path="wrong-answers" element={<ProtectedRoute><WrongAnswersPage /></ProtectedRoute>} />
        <Route path="community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="grammar" element={<ProtectedRoute><GrammarPage /></ProtectedRoute>} />
        <Route path="teacher" element={<ProtectedRoute teacherOnly><TeacherDashboardPage /></ProtectedRoute>} />
        <Route path="teacher/article/new" element={<ProtectedRoute teacherOnly><TeacherArticleNewPage /></ProtectedRoute>} />
        <Route path="teacher/article/:id/exercises" element={<ProtectedRoute teacherOnly><TeacherExercisesPage /></ProtectedRoute>} />
        <Route path="teacher/students" element={<ProtectedRoute teacherOnly><TeacherStudentsPage /></ProtectedRoute>} />
        <Route path="*" element={
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="text-4xl font-bold text-gray-400">404</h1>
            <p className="text-gray-500 mt-2">Page not found</p>
          </div>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { checkAuth, token } = useAuthStore();

  useEffect(() => {
    if (token) checkAuth();
    else useAuthStore.setState({ loading: false });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
