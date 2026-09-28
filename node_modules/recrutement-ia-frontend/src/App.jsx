import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Offres from './pages/Offres';
import RecruteurDashboard from './pages/RecruteurDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/ProfileSection';
import Messagerie from './pages/Messagerie';
import CondidatDashboard from './pages/CandidatDashboard';
import ResetPassword from './pages/Resetpassword';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Chargement...</div>;

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Offres />} />
            <Route path="/login" element={<Login />} />
            <Route path="/offres" element={<Offres />} />
            <Route path="/dashboard" element={ user?.role === 'ADMIN' ? <AdminDashboard /> : user?.role === 'RECRUTEUR' ? <RecruteurDashboard /> : <CondidatDashboard /> } />
            <Route path="/profile" element={user ? <Profile /> : <Login />} />
            <Route path="/messages" element={user && user.role !== 'ADMIN' ? <Messagerie /> : <Login />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
