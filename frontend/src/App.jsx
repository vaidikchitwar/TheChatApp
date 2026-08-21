/**
 * Root Application Router Component
 * 
 * Sets up client-side routing with React Router, initiates automatic session authentication
 * verification on initial mount, and provides protected route gating via PrivateRoute.
 */

import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LandingPage from "./components/LandingPage";
import AuthCard from "./components/AuthCard";
import ChatDashboard from "./components/ChatDashboard";

/**
 * Route Guard Component
 * 
 * Renders child components only when an authenticated user session is active.
 * Shows a loading indicator while auth is being verified from cookies or redirects to /auth.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Protected children to render
 */
const PrivateRoute = ({ children }) => {
  const { user, token, loading } = useAuthStore();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-cream font-medium text-deepslate-800">Loading...</div>;
  }
  
  return token ? children : <Navigate to="/auth" />;
};

/**
 * App Root Component
 * 
 * Triggers background authentication refresh checks on mount and declares routes.
 */
function App() {
  const { checkAuth } = useAuthStore();

  // Validate authentication state (using stored JWT or HttpOnly cookie refresh) on initial app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Public login/register card */}
        <Route path="/auth" element={<AuthCard />} />
        
        {/* Protected chat workspace */}
        <Route 
          path="/chat" 
          element={
            <PrivateRoute>
              <ChatDashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;