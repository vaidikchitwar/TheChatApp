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
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md p-8 sm:p-10 rounded-[2rem] shadow-xl border border-black/5 relative overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-mint/10 rounded-bl-full -z-0"></div>

        {/* Card Header */}
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="bg-mint p-3 rounded-2xl text-white mb-4 shadow-lg shadow-mint/30">
            <MessageCircle size={28} />
          </div>
          <h2 className="text-3xl font-bold text-deepslate-900 tracking-tight">
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-muted-text mt-2 text-center">
            {isSignUp ? "Join the conversation in seconds." : "Enter your details to access your chats."}
          </p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-5">
          {/* Dynamic Error Alert Banner */}
          {error && (
            <div className="bg-coral/10 text-coral p-3 rounded-xl flex items-start gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign-Up Exclusive Fields */}
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Username</label>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all"
                  placeholder="johndoe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all"
                  placeholder="John D."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </>
          )}

          {/* Sign-In Field (Username or Email) */}
          {!isSignUp && (
            <div>
              <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Username or Email</label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all"
                placeholder="johndoe"
              />
            </div>
          )}

          {/* Password Field with Show/Hide Toggle */}
          <div>
            <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all pr-12"
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
              <label className="block text-sm font-semibold text-deepslate-800 mb-1.5 ml-1">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-cream/30 border border-muted-border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-mint hover:bg-mint/90 text-white font-bold py-3.5 px-4 rounded-xl mt-4 shadow-lg shadow-mint/20 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle Mode Switcher */}
        <div className="mt-8 text-center relative z-10">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-muted-text hover:text-deepslate-900 text-sm font-medium transition-colors"
          >
            {isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

