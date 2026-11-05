import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import socket from '../api/socket';
import { useAuth } from '../context/AuthContext';
import { AiOutlineWechatWork } from "react-icons/ai";
import { FiEdit2, FiFileText, FiImage, FiPaperclip, FiSend, FiTrash2, FiX } from 'react-icons/fi';
import Avatar from '../components/Avatar';

export default function Messagerie() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newConvEmail, setNewConvEmail] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvError, setNewConvError] = useState('');
  const [userList, setUserList] = useState([]);
  const [userListLoaded, setUserListLoaded] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef();
  const bottomRef = useRef();
  const inputRef = useRef();
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const activeConvIdRef = useRef(null);

  const loadUsers = async (search = '') => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/messages/users', { params: search ? { search } : {} });
      setUserList(res.data.users || []);
    } catch (err) {
      console.error(err);
      setUserList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

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

    const onNewMessage = (msg) => {
      const isActiveConversation = activeConvIdRef.current === msg.conversationId;
      setMessages((prev) => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, isActiveConversation && msg.sender?.id !== user.id ? { ...msg, lu: true } : msg];
      });
      setConversations((prev) => prev.map((c) =>
        c.id === msg.conversationId
          ? {
              ...c,
              messages: [msg],
              unread: msg.sender?.id !== user.id
                ? (isActiveConversation ? 0 : (c.unread || 0) + 1)
                : c.unread,
            }
          : c
      ));
      if (isActiveConversation && msg.sender?.id !== user.id) {
        socket.emit('mark_read', { conversationId: msg.conversationId });
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const onMessagesRead = ({ conversationId, byUserId }) => {
      if (byUserId === user.id) {
        setConversations((prev) => prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unread: 0 } : conv
        ));
      }
      if (byUserId !== user.id && activeConvIdRef.current === conversationId) {
        setMessages((prev) => prev.map(m => ({ ...m, lu: true })));
      }
    };

    const onNotification = () => loadConversations();

    socket.on('new_message', onNewMessage);
    socket.on('messages_read', onMessagesRead);
    socket.on('notification', onNotification);
    socket.on('message_edited', ({ id, contenu }) => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, contenu, edited: true } : m));
    });
    socket.on('message_deleted', ({ id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('messages_read', onMessagesRead);
      socket.off('notification', onNotification);
      socket.off('message_edited');
      socket.off('message_deleted');
    };
  }, []);

  // Open a conversation
  const openConversation = async (conv) => {
    if (activeConv) socket.emit('leave_conversation', activeConv.id);
    activeConvIdRef.current = conv.id;
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
    if (!activeConv) return;

    const trimmed = input.trim();
    if (pendingAttachment) {
      setInput('');
      setPendingAttachment(null);
      return;
    }

    if (!trimmed) return;

    socket.emit('send_message', { conversationId: activeConv.id, contenu: trimmed });
    setInput('');
    inputRef.current?.focus();
  };

  const sendAttachment = async (file) => {
    if (!activeConv || !file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (input.trim()) formData.append('contenu', input.trim());
    formData.append('attachmentType', file.type.startsWith('image/') ? 'IMAGE' : 'FILE');

    try {
      const res = await api.post(`/messages/conversations/${activeConv.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newMessage = res.data.message;
      setMessages((prev) => [...prev, newMessage]);
      setConversations((prev) => prev.map((conv) =>
        conv.id === activeConv.id
          ? { ...conv, messages: [newMessage], unread: 0 }
          : conv
      ));
      setInput('');
      setPendingAttachment(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAttachmentSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setPendingAttachment({
        type: 'image',
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      });
    } else {
      setPendingAttachment({ type: 'file', file, name: file.name });
    }

    event.target.value = '';

    if (file) {
      await sendAttachment(file);
    }
  };

  // Start new conversation (recruteur enters candidat email, or candidat enters recruteur email)
  const startNewConversation = async (e) => {
    e.preventDefault();
    setNewConvError('');
    try {
      const trimmedEmail = newConvEmail.trim();
      if (!trimmedEmail) {
        setNewConvError('Veuillez renseigner un email.');
        return;
      }

      const searchRes = await api.get('/messages/users', { params: { search: trimmedEmail } });
      const found = searchRes.data.users?.find((u) => u.email?.toLowerCase() === trimmedEmail.toLowerCase())
        || searchRes.data.users?.[0];

      if (!found) {
        setNewConvError('Aucun utilisateur trouvé avec cet email.');
        return;
      }

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

  const startEdit = (msg) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.contenu);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditingText('');
  };

  const submitEdit = async (msgId) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      const res = await api.patch(`/messages/messages/${msgId}`, { contenu: trimmed });
      const updated = res.data.message;
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, contenu: updated.contenu, edited: true } : m));
      // Broadcast to the other party via socket
      if (activeConv) {
        socket.emit('edit_message', { conversationId: activeConv.id, id: msgId, contenu: updated.contenu });
      }
    } catch (err) {
      console.error(err);
    } finally {
      cancelEdit();
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await api.delete(`/messages/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (activeConv) {
        socket.emit('delete_message', { conversationId: activeConv.id, id: msgId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getOther = (conv) => {
    if (user.role === 'CANDIDAT') return conv.recruteur;
    // ADMIN and RECRUTEUR: show candidat as the other party,
    // unless the admin IS the candidat (shouldn't happen, but fallback)
    if (conv.candidatId === user.id) return conv.recruteur;
    return conv.candidat;
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const renderAttachment = (msg, isMine) => {
    if (!msg.attachmentUrl) return null;

    if (msg.attachmentType === 'IMAGE' || msg.mimeType?.startsWith('image/')) {
      return (
        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="msg-attachment-image-link">
          <img src={msg.attachmentUrl} alt={msg.attachmentName || 'Image jointe'} className="msg-attachment-image" />
        </a>
      );
    }

    return (
      <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className={`msg-attachment-file-link ${isMine ? 'msg-attachment-file-link--mine' : ''}`}>
        <FiFileText aria-hidden="true" />
        <span>{msg.attachmentName || 'Fichier joint'}</span>
      </a>
    );
  };

  return (
    <div className="msg-page">
      {/* Sidebar */}
      <aside className="msg-sidebar">
        <div className="msg-sidebar-header">
          <h3>Messages</h3>
          <button type="button" className="msg-new-btn" onClick={() => {
            const next = !showNewConv;
            setShowNewConv(next);
            if (next && !userListLoaded) { loadUsers(); setUserListLoaded(true); }
          }} title="Nouvelle conversation">✏️</button>
        </div>

        {showNewConv && (
          <form onSubmit={startNewConversation} className="msg-new-conv-form">
            <input
              type="email"
              pattern="[^ @]+@[^ @]+[.][^ @]+"
              title="Format attendu : sarah.benali@talent.tn"
              placeholder={user.role === 'CANDIDAT' ? 'Email du recruteur...' : user.role === 'ADMIN' ? 'Email de l\'utilisateur...' : 'Email du candidat...'}
              value={newConvEmail}
              onChange={(e) => {
                setNewConvEmail(e.target.value);
                loadUsers(e.target.value.trim());
              }}
              required
            />
            {newConvError && <span className="msg-new-conv-error">{newConvError}</span>}
            <button type="submit" className="msg-new-conv-submit">Démarrer</button>
          </form>
        )}

        {showNewConv && (
          <div className="msg-user-list">
            {loadingUsers ? (
              <div className="msg-empty msg-empty--small">Chargement...</div>
            ) : userList.length === 0 ? (
              <div className="msg-empty msg-empty--small">Aucun utilisateur trouvé.</div>
            ) : (
              userList.slice(0, 6).map((person) => (
                <button
                  type="button"
                  key={person.id}
                  className="msg-user-item"
                  onClick={() => {
                    setNewConvEmail(person.email);
                    setNewConvError('');
                  }}
                >
                  <Avatar user={person} size="sm" />
                  <div className="msg-user-item-text">
                    <span className="msg-user-item-name">{person.nom}</span>
                    <span className="msg-user-item-email">{person.email}</span>
                  </div>
                </button>
              ))
            )}
          </div>
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
                  <Avatar user={other} size="sm" />
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
      <section className="msg-chat" aria-label="Conversation">
        {!activeConv ? (
          <div className="msg-chat-empty">
            <div className="msg-chat-empty-icon"><AiOutlineWechatWork /></div>
            <p>Sélectionnez une conversation ou démarrez-en une nouvelle.</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="msg-chat-header">
              <Avatar user={getOther(activeConv)} size="md" />
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
                  const isEditing = editingMsgId === msg.id;
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="msg-date-divider">
                          {new Date(msg.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                      )}
                      <div className={`msg-bubble-wrap ${isMine ? 'msg-bubble-wrap--mine' : ''}`}>
                        {isMine && !isEditing && (
                          <div className="msg-actions">
                            {!msg.attachmentUrl && (
                              <button type="button" className="msg-action-icon" title="Modifier" onClick={() => startEdit(msg)}>
                                <FiEdit2 size={13} />
                              </button>
                            )}
                            <button type="button" className="msg-action-icon msg-action-icon--delete" title="Supprimer" onClick={() => handleDeleteMessage(msg.id)}>
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        )}
                        <div className={`msg-bubble ${isMine ? 'msg-bubble--mine' : 'msg-bubble--other'} ${msg.attachmentUrl ? 'msg-bubble--attachment' : ''}`}>
                          {msg.attachmentUrl && renderAttachment(msg, isMine)}
                          {isEditing ? (
                            <div className="msg-edit-form">
                              <input
                                ref={editInputRef}
                                className="msg-edit-input"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <div className="msg-edit-actions">
                                <button type="button" className="msg-edit-save" onClick={() => submitEdit(msg.id)}>Enregistrer</button>
                                <button type="button" className="msg-edit-cancel" onClick={cancelEdit}>Annuler</button>
                              </div>
                            </div>
                          ) : (
                            msg.contenu && msg.contenu !== 'Pièce jointe' && (
                              <span className="msg-bubble-text">
                                {msg.contenu}
                                {msg.edited && <span className="msg-edited-label"> (modifié)</span>}
                              </span>
                            )
                          )}
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
            <div className="msg-composer">
              <div className="msg-attachment-toolbar">
                <span className="msg-attachment-label">Joindre</span>
                <button type="button" className="msg-action-btn" onClick={() => fileInputRef.current?.click()} title="Joindre un fichier">
                  <FiPaperclip aria-hidden="true" />
                  <span>Fichier</span>
                </button>
                <button type="button" className="msg-action-btn" onClick={() => imageInputRef.current?.click()} title="Joindre une image">
                  <FiImage aria-hidden="true" />
                  <span>Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                  hidden
                  onChange={handleAttachmentSelect}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={handleAttachmentSelect}
                />
              </div>

              {pendingAttachment && (
                <div className="msg-attachment-preview">
                  {pendingAttachment.type === 'image' ? (
                    <img src={pendingAttachment.preview} alt={pendingAttachment.name} />
                  ) : (
                    <>
                      <span className="msg-attachment-file-icon"><FiFileText aria-hidden="true" /></span>
                      <span className="msg-attachment-file-name">{pendingAttachment.name}</span>
                    </>
                  )}
                  <button type="button" className="msg-remove-attachment" onClick={() => setPendingAttachment(null)} aria-label="Retirer la pièce jointe" title="Retirer la pièce jointe">
                    <FiX aria-hidden="true" />
                  </button>
                </div>
              )}

              <form className="msg-input-bar" onSubmit={sendMessage}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pendingAttachment ? 'Ajoutez un message optionnel...' : 'Écrivez un message...'}
                  className="msg-input"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                />
                <button type="submit" className="msg-send-btn" disabled={!input.trim() && !pendingAttachment} aria-label="Envoyer le message" title="Envoyer">
                  <FiSend aria-hidden="true" />
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
