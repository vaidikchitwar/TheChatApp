/**
 * Authentication Store (Zustand)
 * 
 * Manages user authentication state, JWT tokens in localStorage and Axios headers,
 * HttpOnly cookie session refresh flow, user login/registration, and logout revocation.
 */

import { create } from 'zustand';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useAuthStore = create((set, get) => ({
  /** @type {Object|null} Authenticated user profile (id, username, nickname, email, avatar_color) */
  user: null,
  /** @type {string|null} Active JWT access token retrieved from browser localStorage */
  token: localStorage.getItem('token'),
  /** @type {boolean} Indicates whether initial authentication verification is underway */
  loading: true,

  /**
   * Set authentication state, update localStorage token, and attach default Axios Authorization header.
   * 
   * @param {Object|null} user - The user profile object
   * @param {string|null} token - JWT access token string
   */
  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
    set({ user, token, loading: false });
  },

  /**
   * Log out the current user by revoking refresh token on server and clearing local state.
   */
  logout: async () => {
    try {
      // Notify backend to revoke refresh token and clear HttpOnly cookie
      await axios.post(`${API_URL}/api/v1/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error', error);
    }
    // Clean up local client state and authorization headers
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    set({ user: null, token: null, loading: false });
  },

  /**
   * Check authentication on application startup.
   * 
   * 1. Attempts to validate existing access token via /auth/me.
   * 2. If missing or expired, attempts silent token refresh via /auth/refresh with HttpOnly cookie.
   * 3. Fetches fresh user profile upon successful refresh.
   */
  checkAuth: async () => {
    const { token, setAuth } = get();
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    try {
      // First attempt /auth/me with current access token
      if (token) {
        const res = await axios.get(`${API_URL}/api/v1/auth/me`);
        set({ user: res.data, loading: false });
        return;
      }
      
      // If no access token, attempt silent refresh using the HttpOnly cookie
      const refreshRes = await axios.post(`${API_URL}/api/v1/auth/refresh`, {}, { withCredentials: true });
      setAuth(null, refreshRes.data.access_token);
      
      // Fetch user profile with newly acquired access token
      const userRes = await axios.get(`${API_URL}/api/v1/auth/me`);
      set({ user: userRes.data, loading: false });

    } catch (error) {
      console.error('Check Auth error', error);
      if (token) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      }
      set({ user: null, token: null, loading: false });
    }
  },

  /**
   * Authenticate user with username/email and password credentials.
   * Atomically updates token and user profile upon completion to prevent rendering race conditions.
   * 
   * @param {string} username - Username or email
   * @param {string} password - Plaintext password
   */
  login: async (username, password) => {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    set({ loading: true });
    // Post credentials to OAuth2 form-compatible login endpoint
    const res = await axios.post(`${API_URL}/api/v1/auth/login`, formData, { withCredentials: true });
    const token = res.data.access_token;
    
    // Store token and configure Axios header
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Fetch profile and atomically commit authenticated state
    const userRes = await axios.get(`${API_URL}/api/v1/auth/me`);
    set({ user: userRes.data, token, loading: false });
  },

  /**
   * Authenticate user via Google OAuth2.
   * 
   * @param {string} credential - Google ID token
   */
  googleLogin: async (credential) => {
    set({ loading: true });
    try {
      const res = await axios.post(`${API_URL}/api/v1/auth/google`, { credential }, { withCredentials: true });
      const token = res.data.access_token;
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const userRes = await axios.get(`${API_URL}/api/v1/auth/me`);
      set({ user: userRes.data, token, loading: false });
    } catch (error) {
      console.error('Google login error', error);
      set({ loading: false });
      throw error;
    }
  },

  /**
   * Register a new user and automatically log them in.
   * 
   * @param {Object} userData - Registration payload ({ username, nickname, email, password })
   */
  register: async (userData) => {
    await axios.post(`${API_URL}/api/v1/auth/register`, userData);
    // Automatically log in using the same credentials after successful registration
    await get().login(userData.username, userData.password);
  },

  /**
   * Update the user's profile settings (nickname, bio, status_message, privacy)
   * 
   * @param {Object} updateData - Profile fields to update
   */
  updateProfile: async (updateData) => {
    const res = await axios.patch(`${API_URL}/api/v1/users/me`, updateData);
    set({ user: res.data });
  },

  /**
   * Upload a new avatar image.
   * 
   * @param {File} file - Image file object
   */
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const res = await axios.post(`${API_URL}/api/v1/users/me/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    set({ user: res.data });
  },

  /**
   * Change user password.
   * 
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   */
  changePassword: async (currentPassword, newPassword) => {
    await axios.post(`${API_URL}/api/v1/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  }
}));

