/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import EventChat from './pages/EventChat';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Grid from './pages/Grid';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Events from './pages/Events';
import Tribes from './pages/Tribes';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Grid />} />
                <Route path="/chats" element={<ChatList />} />
                <Route path="/events" element={<Events />} />
                <Route path="/tribes" element={<Tribes />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="/chat/:chatId" element={<Chat />} />
              <Route path="/event-chat/:eventId" element={<EventChat />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
