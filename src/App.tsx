import { Routes, Route, Navigate } from 'react-router-dom'
import NameScreen from './components/auth/NameScreen'
import JoinScreen from './components/auth/JoinScreen'
import TvGameView from './components/tv/TvGameView'
import PrivateRoute from './components/auth/PrivateRoute'
import AdminRoute from './components/admin/AdminRoute'
import AdminApp from './components/admin/AdminApp'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NameScreen />} />
      <Route path="/join/:roomCode" element={<NameScreen />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route
        path="/play/:roomCode"
        element={
          <PrivateRoute>
            <JoinScreen />
          </PrivateRoute>
        }
      />
      <Route path="/screen/:roomCode" element={<TvGameView />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminApp />
          </AdminRoute>
        }
      />
    </Routes>
  )
}
