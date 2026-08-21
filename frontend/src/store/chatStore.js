/**
 * Real-Time Chat Store (Zustand)
 * 
 * Manages active WebSocket connections, online presence set, typing indicators,
 * optimistic message creation with TanStack Query cache mutations, and exponential
 * backoff auto-reconnection logic.
 */

import { create } from 'zustand';
import { useAuthStore } from './authStore';

export const useChatStore = create((set, get) => ({
  /** @type {WebSocket|null} Active native WebSocket connection instance */
  ws: null,
  /** @type {Set<number>} Set of currently online user IDs */
  onlineUsers: new Set(),
  /** @type {Object<number, number>} Map of conversation_id -> user_id currently typing */
  typingUsers: {},
  /** @type {number|null} ID of the currently selected active conversation in UI */
  activeConversation: null,
  /** @type {number} Counter tracking consecutive reconnection retry attempts */
  reconnectAttempts: 0,
  /** @type {boolean} WebSocket connection health status */
  isConnected: false,

  /**
   * Set the currently active conversation to display in the main chat viewport.
   * 
   * @param {number|null} id - Conversation primary key ID
   */
  setActiveConversation: (id) => set({ activeConversation: id }),

  /**
   * Establish WebSocket connection to backend real-time gateway with automatic event dispatching.
   * 
   * Event Types Handled:
   * - PRESENCE: Adds or removes user IDs from the onlineUsers Set.
   * - NEW_MESSAGE: Inserts incoming message into TanStack Query cache without a full refetch.
   * - MESSAGE_ACK: Resolves optimistic SENDING state to SENT/DELIVERED with DB message ID.
   * - TYPING: Displays typing indicator for conversation for 3 seconds.
   * - MESSAGE_READ: Updates message status badge to READ in cache.
   * 
   * @param {QueryClient} queryClient - TanStack QueryClient instance for direct cache updates
   */
  connect: (queryClient) => {
    const { token, user } = useAuthStore.getState();
    if (!token || !user) return;

    // Clean up existing socket if already open
    if (get().ws) {
      get().ws.close();
    }

    const ws = new WebSocket(`ws://localhost:8000/api/v1/websockets/ws/${token}`);

    ws.onopen = () => {
      set({ isConnected: true, reconnectAttempts: 0 });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const { user } = useAuthStore.getState(); // Always read fresh user from state to avoid stale closures

      // 1. Online / Offline Presence Update
      if (data.type === 'PRESENCE') {
        set((state) => {
          const newSet = new Set(state.onlineUsers);
          if (data.status === 'ONLINE') {
            newSet.add(data.user_id);
          } else {
            newSet.delete(data.user_id);
          }
          return { onlineUsers: newSet };
        });

      // 2. Incoming New Message Broadcast
      } else if (data.type === 'NEW_MESSAGE') {
        const msg = data.message;
        const convId = msg.conversation_id;
        
        // Mutate TanStack Query cache in-place for immediate zero-latency UI update
        queryClient.setQueryData(['messages', convId], (oldData) => {
          if (!oldData) return oldData;
          let exists = false;
          const newPages = oldData.pages.map(page => {
            const newItems = page.items.map(m => {
              if (m.client_message_id === msg.client_message_id || m.id === msg.id) {
                exists = true;
                return { ...m, ...msg };
              }
              return m;
            });
            return { ...page, items: newItems };
          });
          
          if (!exists) {
            // Prepend new message to the latest page (page 0 in cursor pagination)
            if (newPages.length > 0) {
              newPages[0].items = [msg, ...newPages[0].items];
            }
          }
          return { ...oldData, pages: newPages };
        });

        // Play subtle notification audio cue if message is from another user outside active conversation
        const { activeConversation } = get();
        if (activeConversation !== convId && msg.sender_id !== user.id) {
          try {
            new Audio('/beep.mp3').play().catch(() => {});
          } catch (e) {}
        }

      // 3. Message Acknowledgment (ACK) from Server
      } else if (data.type === 'MESSAGE_ACK') {
        const convId = get().activeConversation;
        queryClient.setQueryData(['messages', convId], (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map(page => {
            const newItems = page.items.map(m => {
              if (m.client_message_id === data.client_message_id) {
                return { ...m, id: data.message_id, status: data.status, created_at: data.created_at };
              }
              return m;
            });
            return { ...page, items: newItems };
          });
          return { ...oldData, pages: newPages };
        });

      // 4. Partner Typing Indicator
      } else if (data.type === 'TYPING') {
        set((state) => ({
          typingUsers: { ...state.typingUsers, [data.conversation_id]: data.user_id }
        }));
        
        // Auto-clear typing indicator after 3 seconds of inactivity
        setTimeout(() => {
          set((state) => {
            if (state.typingUsers[data.conversation_id] === data.user_id) {
              const newState = { ...state.typingUsers };
              delete newState[data.conversation_id];
              return { typingUsers: newState };
            }
            return state;
          });
        }, 3000);

      // 5. Message Read Receipt Notification
      } else if (data.type === 'MESSAGE_READ') {
        const convId = data.conversation_id;
        queryClient.setQueryData(['messages', convId], (oldData) => {
          if (!oldData) return oldData;
          const newPages = oldData.pages.map(page => {
            const newItems = page.items.map(m => {
              if (m.id === data.message_id) {
                return { ...m, status: 'READ' };
              }
              return m;
            });
            return { ...page, items: newItems };
          });
          return { ...oldData, pages: newPages };
        });
      }
    };

    // Auto-reconnect with exponential backoff on socket close
    ws.onclose = () => {
      set({ isConnected: false });
      const { reconnectAttempts, connect } = get();
      if (reconnectAttempts < 5) {
        setTimeout(() => {
          set({ reconnectAttempts: reconnectAttempts + 1 });
          connect(queryClient);
        }, Math.min(1000 * (2 ** reconnectAttempts), 10000));
      }
    };

    set({ ws });
  },

  /**
   * Close active WebSocket connection and reset connection state.
   */
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  /**
   * Send a chat message with immediate optimistic UI update.
   * 
   * Generates a unique client_message_id (UUID v4) for deduplication and injects
   * a temporary message with 'SENDING' status directly into TanStack Query cache.
   * Transmits message over WebSocket; falls back to 'FAILED' status if socket is closed.
   * 
   * @param {number} conversationId - Destination conversation ID
   * @param {string} content - Message text body
   * @param {QueryClient} queryClient - TanStack QueryClient for optimistic cache mutation
   */
  sendMessage: (conversationId, content, queryClient) => {
    const { ws } = get();
    const { user } = useAuthStore.getState();
    const client_message_id = crypto.randomUUID();

    // 1. Create optimistic message representation
    const optimisticMessage = {
      id: Math.random(), // Temporary local ID until replaced by server ACK
      client_message_id,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      status: 'SENDING',
      created_at: new Date().toISOString()
    };

    // 2. Inject immediately into local cache for instant UI feedback
    queryClient.setQueryData(['messages', conversationId], (oldData) => {
      if (!oldData) return oldData;
      const newPages = [...oldData.pages];
      if (newPages.length > 0) {
        newPages[0] = {
          ...newPages[0],
          items: [optimisticMessage, ...newPages[0].items]
        };
      }
      return { ...oldData, pages: newPages };
    });

    // 3. Transmit through WebSocket if open
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'NEW_MESSAGE',
        client_message_id,
        conversation_id: conversationId,
        content
      }));
    } else {
      // Mark as FAILED if socket is offline
      queryClient.setQueryData(['messages', conversationId], (oldData) => {
        if (!oldData) return oldData;
        const newPages = oldData.pages.map(page => {
          const newItems = page.items.map(m => {
            if (m.client_message_id === client_message_id) {
              return { ...m, status: 'FAILED' };
            }
            return m;
          });
          return { ...page, items: newItems };
        });
        return { ...oldData, pages: newPages };
      });
    }
  },

  /**
   * Broadcast a typing indicator notification to the active conversation.
   * 
   * @param {number} conversationId - Active conversation ID
   */
  sendTyping: (conversationId) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'TYPING',
        conversation_id: conversationId
      }));
    }
  },

  /**
   * Send a read receipt acknowledgment for an incoming message.
   * 
   * @param {number} messageId - Primary key ID of the message marked as read
   */
  sendReadReceipt: (messageId) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'MESSAGE_READ',
        message_id: messageId
      }));
    }
  }
}));

