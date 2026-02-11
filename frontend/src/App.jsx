import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentPlacements from './pages/StudentPlacements';
import StudentDetail from './pages/StudentDetail';
import ProgramAnalytics from './pages/ProgramAnalytics';
import BatchManagement from './pages/BatchManagement';
import UploadData from './pages/UploadData';
import UserManagement from './pages/UserManagement';
import LoadingDots from './components/LoadingDots';
import './App.css';

function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingDots />;

  // If not logged in, only show login
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/student-placements" element={<ProtectedRoute><StudentPlacements /></ProtectedRoute>} />
          <Route path="/students/:rollNo" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
          <Route path="/programs" element={<ProtectedRoute><ProgramAnalytics /></ProtectedRoute>} />
          <Route path="/admin/batches" element={<AdminRoute><BatchManagement /></AdminRoute>} />
          <Route path="/admin/upload" element={<AdminRoute><UploadData /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
