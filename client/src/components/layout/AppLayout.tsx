import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { BookOpen, BookMarked, GraduationCap, LogOut, Home, Quote, Trophy, TrendingUp, Brain, Settings, Users, XCircle, GitBranch } from "lucide-react";

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-bold text-blue-600 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              English Reading
            </NavLink>
            <NavLink to="/" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Home className="h-4 w-4" /> Home
            </NavLink>
            <NavLink to="/vocabulary" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <BookMarked className="h-4 w-4" /> Vocabulary
            </NavLink>
            <NavLink to="/review" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-purple-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Brain className="h-4 w-4" /> Review
            </NavLink>
            <NavLink to="/grammar" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-purple-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <GitBranch className="h-4 w-4" /> Grammar
            </NavLink>
            <NavLink to="/wrong-answers" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <XCircle className="h-4 w-4" /> Wrong Answers
            </NavLink>
            <NavLink to="/excerpts" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Quote className="h-4 w-4" /> Excerpts
            </NavLink>
            <NavLink to="/report" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <TrendingUp className="h-4 w-4" /> Report
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Trophy className="h-4 w-4" /> Leaderboard
            </NavLink>
            <NavLink to="/community" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Users className="h-4 w-4" /> Community
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
              <Settings className="h-4 w-4" /> Settings
            </NavLink>
            {isTeacher && (
              <NavLink to="/teacher" className={({ isActive }) => `flex items-center gap-1.5 text-sm ${isActive ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}>
                <GraduationCap className="h-4 w-4" /> Teacher
              </NavLink>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user?.name} ({isTeacher ? "Teacher" : "Student"})
            </span>
            <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </nav>
      {user?.isGuest && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700">
          You are using a guest account. Progress will not be saved beyond 24 hours.{" "}
          <NavLink to="/register" className="text-amber-800 font-medium underline">Register now</NavLink> to save your progress permanently.
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
