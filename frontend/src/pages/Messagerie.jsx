import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import socket from '../api/socket';
import { useAuth } from '../context/AuthContext';
import { AiOutlineWechatWork } from "react-icons/ai";

function Avatar({ nom, size = 36 }) {
  return (
    <div className="msg-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {nom?.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Messagerie() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newConvEmail, setNewConvEmail] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvError, setNewConvError] = useState('');
  const bottomRef = useRef();
  const inputRef = useRef();

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data.conversations);
      // auto-open conv from query param
      const convId = Number(searchParams.get('conv'));
      if (convId) {
        const target = res.data.conversations.find(c => c.id === convId);
        if (target) openConversation(target);
        else {
          // conv exists in DB but not yet in list (just created) — fetch it
          const convRes = await api.get(`/messages/conversations/${convId}`);
          if (convRes.data.messages !== undefined) {
            // reload to get full conv object with participants
            const fresh = await api.get('/messages/conversations');
            setConversations(fresh.data.conversations);
            const t = fresh.data.conversations.find(c => c.id === convId);
            if (t) openConversation(t);
          }
        }
        setSearchParams({}, { replace: true });
      }
    } catch (err) { console.error(err); }
    finally { setLoadingConvs(false); }
  };

  useEffect(() => {
    loadConversations();

    socket.auth = { token: document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='))?.split('=')[1] };
    socket.connect();

    socket.on('new_message', (msg) => {
      setMessages((prev) => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setConversations((prev) => prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, messages: [msg], unread: msg.sender.id !== user.id ? (c.unread || 0) + 1 : c.unread }
          : c
      ));
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    socket.on('messages_read', ({ conversationId, byUserId }) => {
      if (byUserId !== user.id) {
        setMessages((prev) => prev.map(m => ({ ...m, lu: true })));
      }
    });

    socket.on('notification', () => loadConversations());

    return () => {
      socket.off('new_message');
      socket.off('messages_read');
      socket.off('notification');
      socket.disconnect();
    };
  }, []);

  // Open a conversation
  const openConversation = async (conv) => {
    if (activeConv) socket.emit('leave_conversation', activeConv.id);
    setActiveConv(conv);
    setLoadingMsgs(true);
    try {
      const res = await api.get(`/messages/conversations/${conv.id}`);
      setMessages(res.data.messages);
      socket.emit('join_conversation', conv.id);
      socket.emit('mark_read', { conversationId: conv.id });
      setConversations((prev) => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    } catch (err) { console.error(err); }
    finally {
      setLoadingMsgs(false);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      inputRef.current?.focus();
    }
  };

  // Send message via socket
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConv) return;
    socket.emit('send_message', { conversationId: activeConv.id, contenu: input.trim() });
    setInput('');
    inputRef.current?.focus();
  };

  // Start new conversation (recruteur enters candidat email, or candidat enters recruteur email)
  const startNewConversation = async (e) => {
    e.preventDefault();
    setNewConvError('');
    try {
      const body = user.role === 'CANDIDAT'
        ? { recruteurId: null, email: newConvEmail }
        : { candidatId: null, email: newConvEmail };

      // find user by email first
      const searchRes = await api.get(`/admin/users?search=${encodeURIComponent(newConvEmail)}`);
      const found = searchRes.data.users?.[0];
      if (!found) { setNewConvError('Aucun utilisateur trouvé avec cet email.'); return; }

      const payload = user.role === 'CANDIDAT'
        ? { recruteurId: found.id }
        : { candidatId: found.id };

      const res = await api.post('/messages/conversations', payload);
      setShowNewConv(false);
      setNewConvEmail('');
      await loadConversations();
      openConversation(res.data.conversation);
    } catch (err) {
      setNewConvError(err.response?.data?.message || 'Erreur lors de la création.');
    }
  };

  const getOther = (conv) => user.role === 'CANDIDAT' ? conv.recruteur : conv.candidat;

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="msg-page">
      {/* Sidebar */}
      <aside className="msg-sidebar">
        <div className="msg-sidebar-header">
          <h3>Messages</h3>
          <button type="button" className="msg-new-btn" onClick={() => setShowNewConv(!showNewConv)} title="Nouvelle conversation">✏️</button>
        </div>

        {showNewConv && (
          <form onSubmit={startNewConversation} className="msg-new-conv-form">
            <input
              type="email"
              placeholder={user.role === 'CANDIDAT' ? 'Email du recruteur...' : 'Email du candidat...'}
              value={newConvEmail}
              onChange={(e) => setNewConvEmail(e.target.value)}
              required
            />
            {newConvError && <span className="msg-new-conv-error">{newConvError}</span>}
            <button type="submit" className="msg-new-conv-submit">Démarrer</button>
          </form>
        )}

        <div className="msg-conv-list">
          {loadingConvs ? (
            <div className="msg-empty">Chargement...</div>
          ) : conversations.length === 0 ? (
            <div className="msg-empty">Aucune conversation.<br />Cliquez sur ✏️ pour commencer.</div>
          ) : (
            conversations.map((conv) => {
              const other = getOther(conv);
              const lastMsg = conv.messages?.[0];
              return (
                <div
                  key={conv.id}
                  className={`msg-conv-item ${activeConv?.id === conv.id ? 'msg-conv-item--active' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <Avatar nom={other?.nom} />
                  <div className="msg-conv-info">
                    <div className="msg-conv-name">{other?.nom}</div>
                    <div className="msg-conv-preview">
                      {lastMsg ? (lastMsg.sender?.id === user.id ? 'Vous : ' : '') + lastMsg.contenu : 'Nouvelle conversation'}
                    </div>
                  </div>
                  <div className="msg-conv-meta">
                    {lastMsg && <span className="msg-conv-time">{formatTime(lastMsg.createdAt)}</span>}
                    {conv.unread > 0 && <span className="msg-unread-badge">{conv.unread}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat area */}
      <main className="msg-chat">
        {!activeConv ? (
          <div className="msg-chat-empty">
            <div className="msg-chat-empty-icon"><AiOutlineWechatWork /></div>
            <p>Sélectionnez une conversation ou démarrez-en une nouvelle.</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="msg-chat-header">
              <Avatar nom={getOther(activeConv)?.nom} size={40} />
              <div>
                <div className="msg-chat-name">{getOther(activeConv)?.nom}</div>
                <div className="msg-chat-email">{getOther(activeConv)?.email}</div>
              </div>
            </div>

            {/* Messages */}
            <div className="msg-messages">
              {loadingMsgs ? (
                <div className="msg-empty">Chargement...</div>
              ) : messages.length === 0 ? (
                <div className="msg-empty">Aucun message. Dites bonjour 👋</div>
              ) : (
                messages.map((msg, i) => {
                  const isMine = msg.senderId === user.id || msg.sender?.id === user.id;
                  const showDate = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="msg-date-divider">
                          {new Date(msg.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                      )}
                      <div className={`msg-bubble-wrap ${isMine ? 'msg-bubble-wrap--mine' : ''}`}>
                        <div className={`msg-bubble ${isMine ? 'msg-bubble--mine' : 'msg-bubble--other'}`}>
                          {msg.contenu}
                        </div>
                        <span className="msg-time">
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isMine && <span className="msg-read-tick">{msg.lu ? ' ✓✓' : ' ✓'}</span>}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form className="msg-input-bar" onSubmit={sendMessage}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez un message..."
                className="msg-input"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
              />
              <button type="submit" className="msg-send-btn" disabled={!input.trim()}>
                ➤
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
