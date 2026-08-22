/**
 * Chat Dashboard Component
 * 
 * Primary workspace for real-time messaging.
 * Includes conversation sidebar, user search/discovery, infinite cursor-paginated chat history,
 * WebSocket lifecycle binding, typing indicators, read receipts, optimistic updates, and delivery status badges.
 */

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import ProfileSettings from "./ProfileSettings";
import { Search, LogOut, Send, Smile, Check, CheckCheck, Loader2, MessageCircle, Settings, Phone, Video, Info, MoreVertical, Plus, ChevronDown } from "lucide-react";
import { format } from "date-fns";

/**
 * ChatDashboard component rendering the sidebar and active chat workspace.
 * 
 * @returns {JSX.Element|null} The rendered chat dashboard or null while user profile is hydrating.
 */
export default function ChatDashboard() {
  const { user, logout } = useAuthStore();
  const { 
    activeConversation, 
    setActiveConversation, 
    onlineUsers,
    typingUsers,
    sendMessage,
    sendTyping,
    sendReadReceipt,
    connect,
    disconnect
  } = useChatStore();

  const queryClient = useQueryClient();

  // 1. Establish and tear down WebSocket connection on component lifecycle
  useEffect(() => {
    connect(queryClient);
    return () => disconnect();
  }, [connect, disconnect, queryClient]);

  // Local component UI states
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' | 'friends'
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesEndRef = useRef(null);

  // Load draft from LocalStorage when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      const draft = localStorage.getItem(`draft_${activeConversation}`);
      setMessageInput(draft || "");
    } else {
      setMessageInput("");
    }
  }, [activeConversation]);

  // Save draft to LocalStorage when messageInput changes
  useEffect(() => {
    if (activeConversation) {
      if (messageInput.trim()) {
        localStorage.setItem(`draft_${activeConversation}`, messageInput);
      } else {
        localStorage.removeItem(`draft_${activeConversation}`);
      }
    }
  }, [messageInput, activeConversation]);

  // 2. Fetch conversation list using TanStack Query
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/conversations");
      return res.data;
    }
  });

  const { data: friends = [], refetch: refetchFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/friends");
      return res.data;
    }
  });

  const { data: pendingRequests = [], refetch: refetchPendingRequests } = useQuery({
    queryKey: ['pendingRequests'],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/friends/pending");
      return res.data;
    }
  });

  // 3. Infinite cursor-based query for paginated message history
  const { 
    data: messagesData, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ['messages', activeConversation],
    queryFn: async ({ pageParam = null }) => {
      const url = `http://localhost:8000/api/v1/conversations/${activeConversation}/messages${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`;
      const res = await axios.get(url);
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!activeConversation
  });

  // Flatten paginated message pages and reverse to display in ascending chronological order
  const currentMessages = messagesData ? messagesData.pages.flatMap(p => p.items).reverse() : [];

  // 4. Auto-scroll to bottom whenever active conversation switches or new message is received
  const latestPageLength = messagesData?.pages[0]?.items.length || 0;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation, latestPageLength]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);

    if (scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // 5. Automatically dispatch read receipts for any unread incoming messages in the active conversation
  const firstUnreadIdx = currentMessages.findIndex(m => m.sender_id !== user?.id && m.status !== 'READ');
  
  useEffect(() => {
    if (activeConversation && currentMessages.length > 0 && user) {
      currentMessages.forEach(m => {
        if (m.status !== "READ" && m.sender_id !== user.id) {
          sendReadReceipt(m.id);
        }
      });
    }
  }, [activeConversation, currentMessages, sendReadReceipt, user]);

  // 6. User discovery search effect: filters other registered users
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      axios.get("http://localhost:8000/api/v1/users").then(res => {
        const results = res.data.filter(u => 
          u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) || 
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(results);
      });
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  /**
   * Start or open a 1-on-1 conversation with a target user from search results.
   * 
   * @param {number} targetUserId - Target participant's user ID
   */
  const handleStartChat = async (targetUserId) => {
    // If they aren't friends, maybe we shouldn't allow it, or just allow it. For now, allow it.
    const res = await axios.post(`http://localhost:8000/api/v1/conversations?target_user_id=${targetUserId}`);
    const newConv = res.data;
    
    // Invalidate and refetch conversation list if new conversation created
    if (!conversations.find(c => c.id === newConv.id)) {
      await refetchConversations();
    }
    
    setActiveConversation(newConv.id);
    setSearchQuery("");
  };

  const handleSendFriendRequest = async (targetUserId) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/friends/request?target_user_id=${targetUserId}`);
      alert("Friend request sent!");
      refetchPendingRequests();
    } catch (e) {
      alert(e.response?.data?.detail || "Error sending request");
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/friends/accept?friendship_id=${friendshipId}`);
      refetchFriends();
      refetchPendingRequests();
    } catch (e) {
      alert(e.response?.data?.detail || "Error accepting request");
    }
  };

  const handleRejectRequest = async (friendshipId) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/friends/reject?friendship_id=${friendshipId}`);
      refetchPendingRequests();
    } catch (e) {
      alert(e.response?.data?.detail || "Error rejecting request");
    }
  };

  /**
   * Submit text message from input form.
   * 
   * @param {React.FormEvent} e - Form submit event
   */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;
    
    sendMessage(activeConversation, messageInput.trim(), queryClient);
    setMessageInput("");
    localStorage.removeItem(`draft_${activeConversation}`);
  };

  /**
   * Extract the partner user profile from a 1-on-1 conversation's participant list.
   * 
   * @param {Object} conv - Conversation data object
   * @returns {Object|null} Partner user object
   */
  const getPartner = (conv) => {
    return conv.participants.find(p => p.user.id !== user.id)?.user;
  };

  // Resolve active conversation partner data and status flags
  const activeConvData = conversations.find(c => c.id === activeConversation);
  const partner = activeConvData ? getPartner(activeConvData) : null;
  const isPartnerOnline = partner && onlineUsers.has(partner.id);
  const isPartnerTyping = partner && typingUsers[activeConversation] === partner.id;

  const handleBlockUser = async (targetId) => {
    if (!window.confirm("Are you sure you want to block this user?")) return;
    try {
      await axios.post(`http://localhost:8000/api/v1/friends/block?target_user_id=${targetId}`);
      setActiveConversation(null); // Close the chat window
      refetchConversations();
      refetchFriends();
    } catch (e) {
      alert(e.response?.data?.detail || "Error blocking user");
    }
  };

  // Guard: if user profile is still loading, render nothing
  if (!user) return null;

  return (
    <div className="flex h-screen p-4 gap-4 font-sans bg-transparent">
      
      {/* Left Sidebar */}
      <div className="w-80 bg-white/70 backdrop-blur-2xl rounded-3xl shadow-soft border border-white/60 flex flex-col overflow-hidden shrink-0">
        {/* User Profile Bar & Logout Button */}
        <div className="p-5 border-b border-white/40 bg-white/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shadow-md bg-cover bg-center ring-2 ring-white" 
              style={{
                backgroundColor: user?.avatar_color,
                backgroundImage: user?.avatar_url ? `url(http://localhost:8000${user.avatar_url})` : 'none'
              }}
            >
              {!user?.avatar_url && user?.nickname?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-deepslate-900 leading-tight">{user?.nickname}</h3>
              <div className="flex items-center gap-1.5 text-xs font-medium text-mint">
                <span className="w-2 h-2 bg-mint rounded-full animate-pulse shadow-[0_0_8px_rgba(89,178,146,0.6)]"></span> Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all" title="Settings">
              <Settings size={18} />
            </button>
            <button onClick={logout} className="p-2 text-muted-text hover:text-coral hover:bg-white/60 rounded-xl transition-all" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {showSettings && <ProfileSettings onClose={() => setShowSettings(false)} />}

        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text transition-colors group-focus-within:text-mint" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 border border-white/50 shadow-sm rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-mint/50 focus:ring-2 focus:ring-mint/20 transition-all text-deepslate-900 placeholder:text-muted-text"
            />
          </div>
        </div>

        <div className="flex border-b border-white/40 mt-1 px-4 gap-2">
          <button 
            className={`flex-1 py-2.5 text-sm font-semibold transition-all rounded-t-xl ${activeTab === 'chats' ? 'bg-white/60 text-mint shadow-sm' : 'text-muted-text hover:text-deepslate-900 hover:bg-white/40'}`}
            onClick={() => setActiveTab('chats')}
          >
            Chats
          </button>
          <button 
            className={`flex-1 py-2.5 text-sm font-semibold transition-all rounded-t-xl flex justify-center items-center gap-2 ${activeTab === 'friends' ? 'bg-white/60 text-mint shadow-sm' : 'text-muted-text hover:text-deepslate-900 hover:bg-white/40'}`}
            onClick={() => setActiveTab('friends')}
          >
            Friends
            {pendingRequests.filter(r => r.user_id !== user.id).length > 0 && (
              <span className="bg-coral text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                {pendingRequests.filter(r => r.user_id !== user.id).length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 mt-2">
          {searchQuery ? (
            <div className="space-y-1">
              <h4 className="px-3 text-xs font-bold text-muted-text uppercase tracking-wider mb-2 mt-2">Search Results</h4>
              {searchResults.map(u => (
                <div key={u.id} className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-white/60 transition-colors text-left border border-transparent hover:border-white/50">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden cursor-pointer" onClick={() => handleStartChat(u.id)} role="button">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-cover bg-center shadow-sm" 
                      style={{
                        backgroundColor: u.avatar_color,
                        backgroundImage: u.avatar_url ? `url(http://localhost:8000${u.avatar_url})` : 'none'
                      }}
                    >
                      {!u.avatar_url && u.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-deepslate-900 truncate">{u.nickname}</h4>
                      <p className="text-sm text-muted-text truncate">@{u.username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSendFriendRequest(u.id); }}
                    className="text-xs bg-mint/15 text-mint px-3.5 py-1.5 rounded-full font-bold hover:bg-mint hover:text-white transition-all shadow-sm"
                  >
                    Add
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && <p className="text-center text-muted-text text-sm p-4">No users found.</p>}
            </div>
          ) : activeTab === 'chats' ? (
            <div className="space-y-1.5 px-1">
              {conversations.map(conv => {
                const p = getPartner(conv);
                if (!p) return null;
                const isOnline = onlineUsers.has(p.id);
                const isActive = activeConversation === conv.id;
                
                return (
                  <button 
                    key={conv.id}
                    onClick={() => setActiveConversation(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left border ${isActive ? 'bg-white shadow-soft border-white/80' : 'bg-transparent border-transparent hover:bg-white/50 hover:border-white/40'}`}
                  >
                    <div className="relative shrink-0">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm bg-cover bg-center ring-2 ring-white/50" 
                        style={{
                          backgroundColor: p.avatar_color,
                          backgroundImage: p.avatar_url ? `url(http://localhost:8000${p.avatar_url})` : 'none'
                        }}
                      >
                        {!p.avatar_url && p.nickname.charAt(0).toUpperCase()}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-mint border-2 border-white rounded-full shadow-sm"></div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="font-bold text-deepslate-900 truncate pr-2">{p.nickname}</h4>
                        <span className="text-xs font-medium text-muted-text shrink-0">
                          {format(new Date(conv.updated_at), "HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-text truncate font-medium">
                        {typingUsers[conv.id] === p.id ? (
                          <span className="text-mint italic">Typing...</span>
                        ) : "Click to view messages"}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4 px-1">
              <div className="pt-2">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const username = e.target.username.value.trim();
                    if (!username) return;
                    try {
                      const res = await axios.get(`http://localhost:8000/api/v1/users/search?username=${username}`);
                      await handleSendFriendRequest(res.data.id);
                      e.target.reset();
                    } catch (err) {
                      alert(err.response?.data?.detail || "User not found or error occurred");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input 
                    name="username"
                    type="text" 
                    placeholder="Add friend by username..." 
                    className="flex-1 bg-white/60 border border-white/50 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-mint/50 focus:ring-2 focus:ring-mint/20 shadow-sm transition-all text-deepslate-900"
                  />
                  <button type="submit" className="bg-mint text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:bg-mint/90 transition-all">
                    Send
                  </button>
                </form>
              </div>

              {pendingRequests.filter(r => r.user_id !== user.id).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-text uppercase tracking-wider mb-2">Friend Requests</h4>
                  {pendingRequests.filter(r => r.user_id !== user.id).map(req => (
                    <div key={req.id} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/50 border border-white/60 shadow-sm">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-cover bg-center shadow-sm" style={{backgroundColor: req.friend.avatar_color, backgroundImage: req.friend.avatar_url ? `url(http://localhost:8000${req.friend.avatar_url})` : 'none'}}>
                        {!req.friend.avatar_url && req.friend.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline mb-1">
                          <h4 className="font-bold text-deepslate-900 text-sm truncate pr-1">{req.friend.nickname}</h4>
                          <span className="text-xs font-medium text-muted-text truncate shrink-0">@{req.friend.username}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAcceptRequest(req.id)} className="text-[11px] font-bold bg-mint text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all">Accept</button>
                          <button onClick={() => handleRejectRequest(req.id)} className="text-[11px] font-bold bg-white/80 border border-white text-deepslate-900 px-3 py-1.5 rounded-lg shadow-sm hover:bg-white transition-all">Ignore</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-text uppercase tracking-wider mb-2 mt-4">My Friends</h4>
                {friends.length === 0 ? (
                  <p className="text-center text-muted-text text-sm p-4 bg-white/30 rounded-2xl border border-white/40">No friends yet. Search for users to add them!</p>
                ) : (
                  friends.map(f => (
                    <button 
                      key={f.id}
                      onClick={() => handleStartChat(f.friend.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/40 hover:bg-white/70 border border-transparent hover:border-white/60 transition-all text-left shadow-sm hover:shadow-md"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-cover bg-center shadow-sm" style={{backgroundColor: f.friend.avatar_color, backgroundImage: f.friend.avatar_url ? `url(http://localhost:8000${f.friend.avatar_url})` : 'none'}}>
                        {!f.friend.avatar_url && f.friend.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-deepslate-900 truncate pr-2">{f.friend.nickname}</h4>
                          <span className="text-xs font-medium text-muted-text truncate shrink-0">@{f.friend.username}</span>
                        </div>
                        <p className="text-xs text-muted-text truncate font-medium">{f.friend.status_message || "Hey there! I am using ChatSync."}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white/70 backdrop-blur-3xl rounded-3xl shadow-soft border border-white/60 flex flex-col overflow-hidden relative">
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/40 flex items-center justify-between gap-4 bg-white/50 backdrop-blur-md z-20 absolute top-0 w-full shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md bg-cover bg-center ring-2 ring-white" 
                    style={{
                      backgroundColor: partner?.avatar_color,
                      backgroundImage: partner?.avatar_url ? `url(http://localhost:8000${partner.avatar_url})` : 'none'
                    }}
                  >
                    {!partner?.avatar_url && partner?.nickname.charAt(0).toUpperCase()}
                  </div>
                  {isPartnerOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-mint border-2 border-white rounded-full shadow-sm"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-deepslate-900 leading-tight tracking-tight">{partner?.nickname}</h3>
                  <p className="text-sm font-medium text-muted-text">
                    {isPartnerTyping ? (
                      <span className="text-mint italic">typing...</span>
                    ) : isPartnerOnline ? (
                      <span className="text-mint">Online</span>
                    ) : (
                      <span>Last seen {partner?.last_seen ? format(new Date(partner.last_seen), "MMM d, HH:mm") : "recently"}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all hidden sm:block" title="Voice Call">
                  <Phone size={20} />
                </button>
                <button className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all hidden sm:block" title="Video Call">
                  <Video size={20} />
                </button>
                <div className="w-px h-6 bg-white/60 mx-1 hidden sm:block"></div>
                <button className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all" title="Search messages">
                  <Search size={20} />
                </button>
                <button className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all" title="Chat Info">
                  <Info size={20} />
                </button>
                <div className="relative group">
                  <button className="p-2 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-xl transition-all" title="More options">
                    <MoreVertical size={20} />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-white/60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden z-50 transform origin-top-right scale-95 group-hover:scale-100">
                    <button className="px-4 py-2.5 text-left text-sm font-medium text-deepslate-900 hover:bg-cream/50 transition-colors">View profile</button>
                    <button className="px-4 py-2.5 text-left text-sm font-medium text-deepslate-900 hover:bg-cream/50 transition-colors">Mute notifications</button>
                    <button className="px-4 py-2.5 text-left text-sm font-medium text-deepslate-900 hover:bg-cream/50 transition-colors border-b border-muted-border">Clear chat</button>
                    <button 
                      onClick={() => handleBlockUser(partner?.id)}
                      className="px-4 py-2.5 text-left text-sm font-bold text-coral hover:bg-coral/5 transition-colors"
                    >
                      Block User
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 pt-24 space-y-4 bg-transparent relative" onScroll={handleScroll}>
              
              {isFetchingNextPage && (
                <div className="flex justify-center mb-6">
                  <span className="bg-white/80 backdrop-blur border border-white shadow-sm text-deepslate-800 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Loading older messages...
                  </span>
                </div>
              )}

              {currentMessages.map((msg, idx) => {
                const isMine = msg.sender_id === user.id;
                const showDate = idx === 0 || new Date(currentMessages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                const showUnreadDivider = firstUnreadIdx === idx;
                
                return (
                  <div key={msg.id} className="flex flex-col">
                    {showDate && (
                      <div className="flex justify-center my-6">
                        <span className="bg-white/60 backdrop-blur border border-white/50 text-muted-text shadow-sm text-xs px-4 py-1.5 rounded-full font-bold">
                          {format(new Date(msg.created_at), "MMMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {showUnreadDivider && (
                      <div className="flex items-center gap-4 my-4">
                        <div className="h-px flex-1 bg-mint/30"></div>
                        <span className="text-xs font-bold text-mint bg-mint/10 px-3 py-1 rounded-full border border-mint/20">New Messages</span>
                        <div className="h-px flex-1 bg-mint/30"></div>
                      </div>
                    )}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] group relative flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3.5 shadow-md ${
                          msg.status === 'FAILED' ? 'bg-coral/20 border-coral text-coral' :
                          isMine 
                            ? 'bg-gradient-to-br from-mint to-teal-500 text-white rounded-3xl rounded-tr-sm' 
                            : 'bg-white text-deepslate-900 rounded-3xl rounded-tl-sm border border-white/60'
                        }`}>
                          <p className="text-[15px] font-medium leading-relaxed break-words">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1.5 mt-1.5 px-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[11px] font-semibold text-muted-text">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMine && (
                             <span className={`${msg.status === 'FAILED' ? 'text-coral' : 'text-mint'}`}>
                               {msg.status === "SENDING" ? <Loader2 size={12} className="animate-spin opacity-70" /> :
                                msg.status === "SENT" ? <Check size={14} className="opacity-70" /> :
                                msg.status === "DELIVERED" ? <CheckCheck size={14} className="opacity-70" /> :
                                msg.status === "FAILED" ? <span className="text-[10px] uppercase font-bold">Failed</span> :
                                <CheckCheck size={14} />}
                             </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
              
              {showScrollBottom && (
                <button 
                  onClick={scrollToBottom}
                  className="fixed bottom-28 right-8 bg-white/90 backdrop-blur border border-white/60 p-3 rounded-full shadow-lg text-deepslate-900 hover:text-mint hover:scale-105 transition-all z-30 flex items-center justify-center group"
                  title="Scroll to bottom"
                >
                  <ChevronDown size={24} className="group-hover:translate-y-0.5 transition-transform" />
                  {firstUnreadIdx !== -1 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-coral rounded-full border-2 border-white"></span>
                  )}
                </button>
              )}
            </div>

            {/* Input Composer */}
            <div className="p-5 bg-white/40 backdrop-blur-md border-t border-white/50 z-20">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-white/70 shadow-inner border border-white/60 rounded-3xl p-1.5 focus-within:ring-4 focus-within:ring-mint/20 focus-within:border-mint/50 focus-within:bg-white transition-all relative">
                
                <div className="relative group">
                  <button type="button" className="p-3 text-muted-text hover:text-deepslate-900 hover:bg-white/60 rounded-full transition-all shrink-0" title="Attach">
                    <Plus size={22} />
                  </button>
                  <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-xl border border-white/60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-2 z-50 transform origin-bottom-left scale-95 group-hover:scale-100">
                    <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-deepslate-900 hover:bg-cream/50 rounded-xl transition-colors">
                      <span className="w-8 h-8 rounded-full bg-mint/20 flex items-center justify-center text-mint"><Search size={16} /></span> Document
                    </button>
                    <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-deepslate-900 hover:bg-cream/50 rounded-xl transition-colors">
                      <span className="w-8 h-8 rounded-full bg-golden/20 flex items-center justify-center text-golden"><Search size={16} /></span> Photo & Video
                    </button>
                  </div>
                </div>

                <textarea 
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    sendTyping(activeConversation);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                      e.target.style.height = 'auto';
                    }
                  }}
                  placeholder="Type a message..."
                  className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 font-medium max-h-[150px] overflow-y-auto text-deepslate-900 focus:outline-none placeholder:text-muted-text/70"
                  rows={1}
                />

                <button type="button" className="p-3 text-muted-text hover:text-mint hover:bg-white/60 rounded-full transition-all shrink-0" title="Emoji">
                  <Smile size={22} />
                </button>
                
                <button 
                  type="submit" 
                  disabled={!messageInput.trim()}
                  className="p-3 bg-gradient-to-r from-mint to-teal-500 text-white rounded-full hover:shadow-glow transition-all disabled:opacity-50 disabled:hover:shadow-none shrink-0 shadow-md flex items-center justify-center w-11 h-11 mb-0.5 mr-0.5"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/20">
            <div className="bg-white/80 backdrop-blur p-8 rounded-full shadow-soft mb-8 ring-4 ring-white/50">
              <MessageCircle size={56} className="text-mint drop-shadow-sm" />
            </div>
            <h2 className="text-3xl font-bold text-deepslate-900 mb-3 tracking-tight">Welcome to ChatSync</h2>
            <p className="text-muted-text font-medium max-w-sm text-lg">
              Select a conversation from the sidebar or search for a friend to start messaging.
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}
