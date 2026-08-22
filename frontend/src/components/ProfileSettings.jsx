import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { X, Upload, Check, Loader2 } from "lucide-react";

export default function ProfileSettings({ onClose }) {
  const { user, updateProfile, uploadAvatar, changePassword } = useAuthStore();
  
  // Profile update state
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [statusMessage, setStatusMessage] = useState(user?.status_message || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  // Avatar upload state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    const fetchBlocked = async () => {
      try {
        const res = await axios.get("http://localhost:8000/api/v1/friends/blocked");
        setBlockedUsers(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBlocked();
  }, []);

  const handleUnblock = async (targetId) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/friends/unblock?target_user_id=${targetId}`);
      setBlockedUsers(prev => prev.filter(u => u.friend.id !== targetId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateSuccess(false);
    try {
      await updateProfile({ nickname, bio, status_message: statusMessage });
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setIsChangingPassword(true);
    
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      setPasswordError(error.response?.data?.detail || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-deepslate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-muted-border flex justify-between items-center bg-cream/30">
          <h2 className="text-xl font-bold text-deepslate-900">Profile Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={20} className="text-muted-text" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-md overflow-hidden bg-cover bg-center"
                style={{
                  backgroundColor: user?.avatar_color,
                  backgroundImage: user?.avatar_url ? `url(http://localhost:8000${user.avatar_url})` : 'none'
                }}
              >
                {!user?.avatar_url && user?.nickname?.charAt(0).toUpperCase()}
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              >
                {isUploadingAvatar ? (
                  <Loader2 size={24} className="text-white animate-spin" />
                ) : (
                  <Upload size={24} className="text-white" />
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <p className="text-sm text-muted-text mt-3">Click to upload new avatar</p>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4 mb-10">
            <h3 className="text-lg font-semibold text-deepslate-900 border-b border-muted-border pb-2">Public Profile</h3>
            
            <div>
              <label className="block text-sm font-medium text-deepslate-800 mb-1">Display Name</label>
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-white border border-muted-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-deepslate-800 mb-1">Status Message</label>
              <input 
                type="text" 
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="e.g. At work, Sleeping, Available"
                className="w-full bg-white border border-muted-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-deepslate-800 mb-1">Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                rows={3}
                className="w-full bg-white border border-muted-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isUpdating}
                className="bg-mint text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-mint/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdating ? <Loader2 size={18} className="animate-spin" /> : 
                 updateSuccess ? <Check size={18} /> : "Save Profile"}
              </button>
            </div>
          </form>

          {/* Security Form */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-lg font-semibold text-deepslate-900 border-b border-muted-border pb-2">Security</h3>
            
            {passwordError && (
              <div className="p-3 bg-coral/10 border border-coral text-coral rounded-xl text-sm">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-mint/10 border border-mint text-mint rounded-xl text-sm">
                {passwordSuccess}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-deepslate-800 mb-1">Current Password</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-white border border-muted-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-deepslate-800 mb-1">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase"
                className="w-full bg-white border border-muted-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all"
                required
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="bg-deepslate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-deepslate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isChangingPassword ? <Loader2 size={18} className="animate-spin" /> : "Update Password"}
              </button>
            </div>
          </form>

          {/* Blocked Users Form */}
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-deepslate-900 border-b border-muted-border pb-2">Blocked Users</h3>
            {blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-text">You haven't blocked anyone.</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 border border-muted-border rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-deepslate-900 flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor: b.friend.avatar_color}}>
                        {b.friend.nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-deepslate-900">{b.friend.nickname}</span>
                    </div>
                    <button 
                      onClick={() => handleUnblock(b.friend.id)}
                      className="text-xs bg-muted-border text-deepslate-900 px-3 py-1.5 rounded hover:bg-cream transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
