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
import { Search, LogOut, Send, Smile, Check, CheckCheck, Loader2, MessageCircle } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef(null);

  // 2. Fetch conversation list using TanStack Query
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/conversations");
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

  // 5. Automatically dispatch read receipts for any unread incoming messages in the active conversation
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
    const res = await axios.post(`http://localhost:8000/api/v1/conversations?target_user_id=${targetUserId}`);
    const newConv = res.data;
    
    // Invalidate and refetch conversation list if new conversation created
    if (!conversations.find(c => c.id === newConv.id)) {
      await refetchConversations();
    }
    
    setActiveConversation(newConv.id);
    setSearchQuery("");
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

  // Guard: if user profile is still loading, render nothing
  if (!user) return null;

  return (
    <div className="flex h-screen bg-cream p-4 gap-4 font-sans">
      
      {/* Left Sidebar */}
      <div className="w-80 bg-white rounded-3xl shadow-soft border border-black/5 flex flex-col overflow-hidden shrink-0">
        {/* User Profile Bar & Logout Button */}
        <div className="p-5 border-b border-muted-border bg-deepslate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner" style={{backgroundColor: user?.avatar_color}}>
              {user?.nickname?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold">{user?.nickname}</h3>
              <div className="flex items-center gap-1.5 text-xs text-mint">
                <span className="w-2 h-2 bg-mint rounded-full animate-pulse"></span> Online
              </div>
            </div>
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-xl transition-colors" title="Logout">
            <LogOut size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-cream/50 border border-muted-border rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {searchQuery ? (
            <div className="space-y-1">
              <h4 className="px-3 text-xs font-semibold text-muted-text uppercase tracking-wider mb-2 mt-2">Search Results</h4>
              {searchResults.map(u => (
                <button 
                  key={u.id}
                  onClick={() => handleStartChat(u.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-cream/50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{backgroundColor: u.avatar_color}}>
                    {u.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-semibold text-deepslate-900 truncate">{u.nickname}</h4>
                    <p className="text-sm text-muted-text truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && <p className="text-center text-muted-text text-sm p-4">No users found.</p>}
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(conv => {
                const p = getPartner(conv);
                if (!p) return null;
                const isOnline = onlineUsers.has(p.id);
                const isActive = activeConversation === conv.id;
                
                return (
                  <button 
                    key={conv.id}
                    onClick={() => setActiveConversation(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors text-left ${isActive ? 'bg-cream' : 'hover:bg-cream/50'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: p.avatar_color}}>
                        {p.nickname.charAt(0).toUpperCase()}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-mint border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="font-semibold text-deepslate-900 truncate pr-2">{p.nickname}</h4>
                        <span className="text-xs text-muted-text shrink-0">
                          {format(new Date(conv.updated_at), "HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-text truncate">
                        {typingUsers[conv.id] === p.id ? (
                          <span className="text-mint font-medium italic">Typing...</span>
                        ) : "Click to view messages"}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white rounded-3xl shadow-soft border border-black/5 flex flex-col overflow-hidden relative">
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-muted-border flex items-center gap-4 bg-white/80 backdrop-blur z-10 absolute top-0 w-full">
              <div className="relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: partner?.avatar_color}}>
                  {partner?.nickname.charAt(0).toUpperCase()}
                </div>
                {isPartnerOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-mint border-2 border-white rounded-full"></div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg text-deepslate-900 leading-tight">{partner?.nickname}</h3>
                <p className="text-sm text-muted-text">
                  {isPartnerTyping ? (
                    <span className="text-mint font-medium">typing...</span>
                  ) : isPartnerOnline ? (
                    <span className="text-mint">Online</span>
                  ) : (
                    <span>Last seen {partner?.last_seen ? format(new Date(partner.last_seen), "MMM d, HH:mm") : "recently"}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 pt-24 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-cream/10">
              
              {hasNextPage && (
                <div className="flex justify-center mb-4">
                  <button 
                    onClick={() => fetchNextPage()} 
                    disabled={isFetchingNextPage}
                    className="bg-white border border-muted-border text-deepslate-800 px-4 py-2 rounded-full text-sm font-medium hover:bg-cream transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextPage ? <Loader2 className="animate-spin" size={16} /> : "Load older messages"}
                  </button>
                </div>
              )}

              {currentMessages.map((msg, idx) => {
                const isMine = msg.sender_id === user.id;
                const showDate = idx === 0 || new Date(currentMessages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                
                return (
                  <div key={msg.id} className="flex flex-col">
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="bg-muted-border/40 text-muted-text text-xs px-3 py-1 rounded-full font-medium">
                          {format(new Date(msg.created_at), "MMMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] group relative flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3 shadow-sm ${
                          msg.status === 'FAILED' ? 'bg-coral/20 border-coral text-coral' :
                          isMine 
                            ? 'bg-mint text-white rounded-3xl rounded-tr-sm' 
                            : 'bg-white border border-muted-border text-deepslate-900 rounded-3xl rounded-tl-sm'
                        }`}>
                          <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[11px] text-muted-text">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isMine && (
                            <span className={`ml-1 ${msg.status === 'FAILED' ? 'text-coral' : 'text-mint'}`}>
                              {msg.status === "SENDING" ? <Loader2 size={12} className="animate-spin text-muted-text" /> :
                               msg.status === "SENT" ? <Check size={14} className="text-muted-text" /> :
                               msg.status === "DELIVERED" ? <CheckCheck size={14} className="text-muted-text" /> :
                               msg.status === "FAILED" ? "Failed" :
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
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-muted-border">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-cream/30 border border-muted-border rounded-3xl p-1.5 focus-within:ring-2 focus-within:ring-mint/50 focus-within:border-mint transition-all">
                <button type="button" className="p-3 text-muted-text hover:text-golden transition-colors shrink-0">
                  <Smile size={24} />
                </button>
                <textarea 
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    sendTyping(activeConversation);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Type a message..."
                  className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 max-h-32 text-deepslate-900 focus:outline-none"
                  rows={1}
                />
                <button 
                  type="submit" 
                  disabled={!messageInput.trim()}
                  className="p-3 bg-mint text-white rounded-full hover:bg-mint/90 transition-colors disabled:opacity-50 disabled:hover:bg-mint shrink-0 shadow-md flex items-center justify-center w-11 h-11"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-cream/20">
            <div className="bg-white p-6 rounded-full shadow-soft mb-6">
              <MessageCircle size={48} className="text-mint" />
            </div>
            <h2 className="text-2xl font-bold text-deepslate-900 mb-2">Welcome to ChatSync</h2>
            <p className="text-muted-text max-w-sm">
              Select a conversation from the sidebar or search for a user to start messaging instantly.
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}
