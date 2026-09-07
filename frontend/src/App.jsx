import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Offres from './pages/Offres';
import CandidatDashboard from './pages/CandidatDashboard';
import RecruteurDashboard from './pages/RecruteurDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Messagerie from './pages/Messagerie';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Chargement...</div>;

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Offres />} />
          <Route path="/login" element={<Login />} />
          <Route path="/offres" element={<Offres />} />
          <Route path="/dashboard" element={ user?.role === 'ADMIN' ? <AdminDashboard /> : user?.role === 'RECRUTEUR' ? <RecruteurDashboard /> : <CandidatDashboard /> } />
          <Route path="/profile" element={user ? <Profile /> : <Login />} />
          <Route path="/messages" element={user ? <Messagerie /> : <Login />} />
        </Routes>
      </main>
    </>
  );
}
