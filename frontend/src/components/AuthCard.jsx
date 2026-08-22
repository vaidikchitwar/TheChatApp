/**
 * Authentication Card Component
 * 
 * Interactive card supporting both Login and Sign-Up flows.
 * Handles client-side form validation (length, alphanumeric, uppercase, confirmation),
 * password visibility toggling, error alerts, and auto-redirect upon successful authentication.
 */

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Eye, EyeOff, MessageCircle, AlertCircle, Loader2 } from "lucide-react";

/**
 * AuthCard component managing login and registration form states.
 * 
 * @returns {JSX.Element} The rendered authentication form card.
 */
export default function AuthCard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, token } = useAuthStore();
  
  // State for toggling between Sign In and Sign Up modes
  const [isSignUp, setIsSignUp] = useState(location.state?.isSignUp || false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form input field state
  const [formData, setFormData] = useState({
    username: "",
    nickname: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  // Redirect to chat dashboard if user is already authenticated
  useEffect(() => {
    if (token) {
      navigate("/chat");
    }
  }, [token, navigate]);

  /**
   * Handle changes across all controlled text inputs.
   * Clears any active error banners upon user typing.
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  /**
   * Validate client-side registration requirements before submitting to API.
   * 
   * Validation Rules:
   * - Username: 3 to 15 alphanumeric characters
   * - Password: At least 8 characters
   * - Password: Alphanumeric with at least one uppercase letter
   * - Confirm Password: Must match password
   * 
   * @returns {string|null} Validation error message, or null if valid
   */
  const validateSignUp = () => {
    if (formData.username.length < 3 || formData.username.length > 15 || !/^[a-zA-Z0-9]+$/.test(formData.username)) {
      return "Username must be 3-15 alphanumeric characters.";
    }
    if (formData.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!/^[a-zA-Z0-9]+$/.test(formData.password)) {
      return "Password must be alphanumeric.";
    }
    if (!/[A-Z]/.test(formData.password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  /**
   * Handle form submission for either Sign Up or Sign In.
   * 
   * @param {React.FormEvent} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Run client-side validation rules
        const valError = validateSignUp();
        if (valError) throw new Error(valError);

        // Submit registration payload and auto-login
        await register({
          username: formData.username,
          nickname: formData.nickname || formData.username,
          email: formData.email,
          password: formData.password
        });
      } else {
        // Submit credentials for authentication
        await login(formData.username, formData.password);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans relative">
      <div className="bg-white/70 backdrop-blur-3xl w-full max-w-md p-8 sm:p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/60 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-mint/20 blur-3xl rounded-full -z-0 translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-golden/20 blur-3xl rounded-full -z-0 -translate-x-10 translate-y-10"></div>

        {/* Card Header */}
        <div className="relative z-10 flex flex-col items-center mb-10">
          <div className="bg-gradient-to-br from-mint to-teal-500 p-4 rounded-2xl text-white mb-5 shadow-lg shadow-mint/30 ring-4 ring-white/50">
            <MessageCircle size={32} />
          </div>
          <h2 className="text-3xl font-bold text-deepslate-900 tracking-tight">
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-muted-text mt-2 text-center font-medium">
            {isSignUp ? "Join the conversation in seconds." : "Enter your details to access your chats."}
          </p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-5">
          {/* Dynamic Error Alert Banner */}
          {error && (
            <div className="bg-coral/10 border border-coral/20 text-coral p-3 rounded-xl flex items-start gap-2 text-sm font-bold animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign-Up Exclusive Fields */}
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Username</label>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70"
                  placeholder="johndoe"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70"
                  placeholder="John D."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70"
                  placeholder="john@example.com"
                />
              </div>
            </>
          )}

          {/* Sign-In Field (Username or Email) */}
          {!isSignUp && (
            <div>
              <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Username or Email</label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70"
                placeholder="johndoe"
              />
            </div>
          )}

          {/* Password Field with Show/Hide Toggle */}
          <div>
            <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70 pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-text hover:text-deepslate-800 transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field (Sign Up only) */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-bold text-deepslate-800 mb-1.5 ml-1">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-white/60 border border-white/50 shadow-inner px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-mint/20 focus:border-mint/50 transition-all font-medium text-deepslate-900 placeholder:text-muted-text/70"
                placeholder="••••••••"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-mint to-teal-500 hover:from-teal-500 hover:to-mint text-white font-bold py-4 px-4 rounded-xl mt-6 shadow-lg shadow-mint/20 hover:shadow-mint/40 hover:-translate-y-1 transition-all disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center text-lg tracking-wide"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle Mode Switcher */}
        <div className="mt-8 text-center relative z-10 pt-6 border-t border-white/40">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-muted-text hover:text-deepslate-900 text-sm font-bold transition-colors"
          >
            {isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

