import { Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './components/auth/LoginScreen'
import RegisterScreen from './components/auth/RegisterScreen'
import JoinScreen from './components/auth/JoinScreen'
import PhoneGameView from './components/phone/PhoneGameView'
import TvGameView from './components/tv/TvGameView'
import PrivateRoute from './components/auth/PrivateRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/register" element={<RegisterScreen />} />
      <Route
        path="/join/:roomCode"
        element={
          <PrivateRoute>
            <JoinScreen />
          </PrivateRoute>
        }
      />
      <Route
        path="/play/:roomCode"
        element={
          <PrivateRoute>
            <PhoneGameView />
          </PrivateRoute>
        }
      />
      <Route path="/screen/:roomCode" element={<TvGameView />} />
    </Routes>
  )
}
