import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import type { User } from '../types/api.types';

interface ContactWithStatus extends User {
  isOnline: boolean;
  hasChatRequest?: boolean;
}

interface ContactListProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string, username: string) => void;
  onLogout: () => void;
}

export function ContactList({
  selectedUserId,
  onSelectUser,
  onLogout,
}: ContactListProps) {
  const [contacts, setContacts] = useState<ContactWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleUserSelect = (userId: string, username: string) => {
    // Clear chat request indicator when user opens the chat
    setContacts((prevContacts) =>
      prevContacts.map((contact) =>
        contact.id === userId ? { ...contact, hasChatRequest: false } : contact
      )
    );
    onSelectUser(userId, username);
  };

  useEffect(() => {
    loadContacts();

    // Subscribe to user online/offline events
    const unsubOnline = socketService.onUserOnline((data) => {
      setContacts((prevContacts) =>
        prevContacts.map((contact) =>
          contact.id === data.userId ? { ...contact, isOnline: true } : contact
        )
      );
    });

    const unsubOffline = socketService.onUserOffline((data) => {
      setContacts((prevContacts) =>
        prevContacts.map((contact) =>
          contact.id === data.userId ? { ...contact, isOnline: false } : contact
        )
      );
    });

    // Subscribe to chat request events
    const unsubChatRequest = socketService.onChatRequest((data) => {
      setContacts((prevContacts) =>
        prevContacts.map((contact) =>
          contact.id === data.fromUserId ? { ...contact, hasChatRequest: true } : contact
        )
      );
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubChatRequest();
    };
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const result = await api.getAllUsers();
      // Initialize contacts with isOnline: false
      setContacts(result.users.map(user => ({ ...user, isOnline: false })));

      // Request online users list after contacts are loaded
      socketService.getOnlineUsers((onlineUserIds) => {
        setContacts((prevContacts) =>
          prevContacts.map((contact) => ({
            ...contact,
            isOnline: onlineUserIds.includes(contact.id),
          }))
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Contacts</h2>
        <button onClick={onLogout} style={styles.logoutButton}>
          Logout
        </button>
      </div>

      {loading && <div style={styles.loading}>Loading contacts...</div>}

      {error && <div style={styles.error}>{error}</div>}

      {!loading && !error && contacts.length === 0 && (
        <div style={styles.emptyState}>
          No other users yet. Invite someone to chat!
        </div>
      )}

      <div style={styles.contactsList}>
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => handleUserSelect(contact.id, contact.username)}
            style={{
              ...styles.contactItem,
              ...(selectedUserId === contact.id ? styles.contactItemActive : {}),
            }}
          >
            <div style={styles.avatarContainer}>
              <div style={styles.avatar}>{contact.username[0].toUpperCase()}</div>
              <div style={{
                ...styles.statusDot,
                ...(contact.isOnline ? styles.statusDotOnline : styles.statusDotOffline)
              }} />
            </div>
            <div style={styles.contactInfo}>
              <div style={styles.contactName}>{contact.username}</div>
              <div style={styles.contactStatus}>
                {contact.isOnline ? 'Online' : 'Offline'}
              </div>
              {contact.hasChatRequest && (
                <div style={styles.chatRequestIndicator}>
                  💬 Wants to chat with you
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <div style={styles.securityBadge}>
          🔐 End-to-End Encrypted
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: 'white',
    borderRight: '2px solid #e0e0e0',
  },
  header: {
    padding: '20px',
    borderBottom: '2px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: 'white',
  },
  logoutButton: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#999',
  },
  error: {
    padding: '20px',
    background: '#fee',
    color: '#c33',
    margin: '10px',
    borderRadius: '6px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#999',
  },
  contactsList: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.2s',
  },
  contactItemActive: {
    background: '#f5f0ff',
  },
  avatarContainer: {
    position: 'relative' as const,
    marginRight: '12px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold' as const,
  },
  statusDot: {
    position: 'absolute' as const,
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid white',
  },
  statusDotOnline: {
    background: '#4caf50',
  },
  statusDotOffline: {
    background: '#9e9e9e',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontWeight: 'bold' as const,
    fontSize: '16px',
    marginBottom: '4px',
  },
  contactStatus: {
    fontSize: '12px',
    color: '#999',
  },
  chatRequestIndicator: {
    fontSize: '12px',
    color: '#667eea',
    fontWeight: 'bold' as const,
    marginTop: '4px',
  },
  footer: {
    padding: '16px',
    borderTop: '2px solid #e0e0e0',
  },
  securityBadge: {
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#667eea',
    fontWeight: 'bold' as const,
  },
};
