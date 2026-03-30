import { useState, useEffect, useCallback } from 'react';
import { Auth } from './components/Auth';
import { ContactList } from './components/ContactList';
import { ChatWindow } from './components/ChatWindow';
import { socketService } from './services/socketService';
import { signalMessagingService } from './services/signalMessagingService';
import { api } from './services/api';
import { logoutUserWithSignal } from './services/signalAuthService';
import { signalStore } from './services/signalProtocolStore';
import type { AuthState } from './types/app.types';
import './App.css';

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    username: null,
  });
  const [selectedContact, setSelectedContact] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthenticated = useCallback(async (
    userId: string,
    username: string
  ) => {
    setAuthState({
      isAuthenticated: true,
      userId,
      username,
    });

    // Initialize Signal messaging service
    signalMessagingService.initialize(userId);

    // Connect to WebSocket
    try {
      const token = api.getToken();
      if (token) {
        await socketService.connect(token);
        setSocketConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = api.getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if we have Signal Protocol keys
        const hasKeys = await signalStore.loadIdentity();

        if (!hasKeys) {
          console.warn('Token found but no Signal Protocol keys');
          api.clearToken();
          setIsLoading(false);
          return;
        }

        // Verify token is still valid by fetching current user
        const user = await api.getCurrentUser();

        // Restore session
        await handleAuthenticated(user.id, user.username);
      } catch (error) {
        console.error('Failed to restore session:', error);
        // Token might be expired or invalid
        api.clearToken();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [handleAuthenticated]);

  const handleLogout = async () => {
    await logoutUserWithSignal();

    socketService.disconnect();
    signalMessagingService.clear();

    setAuthState({
      isAuthenticated: false,
      userId: null,
      username: null,
    });
    setSelectedContact(null);
    setSocketConnected(false);
  };

  const handleSelectContact = (userId: string, username: string) => {
    setSelectedContact({ userId, username });
  };

  const handleBack = () => {
    setSelectedContact(null);
  };

  // Show loading screen while checking for existing session
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>🔄</div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-container" style={styles.container}>
      {!socketConnected && (
        <div style={styles.connectionWarning}>
          ⚠️ Connecting to server...
        </div>
      )}

      <div
        className={`app-sidebar${selectedContact ? ' sidebar-hidden' : ''}`}
        style={styles.sidebar}
      >
        <ContactList
          selectedUserId={selectedContact?.userId || null}
          onSelectUser={handleSelectContact}
          onLogout={handleLogout}
        />
      </div>

      <div
        className={`app-main${!selectedContact ? ' main-hidden' : ''}`}
        style={styles.main}
      >
        {selectedContact ? (
          <ChatWindow
            recipientId={selectedContact.userId}
            recipientUsername={selectedContact.username}
            currentUserId={authState.userId!}
            onBack={handleBack}
          />
        ) : (
          <div style={styles.emptyState}>
            <h2>👋 Welcome, {authState.username}!</h2>
            <p>Select a contact to start chatting</p>
            <div style={styles.features}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔐</span>
                <strong>End-to-End Encrypted</strong>
                <p>Your messages are encrypted before leaving your device</p>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔑</span>
                <strong>Private Keys Secured</strong>
                <p>Your private keys never leave your browser</p>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>⚡</span>
                <strong>Real-Time Messaging</strong>
                <p>Instant delivery with WebSocket technology</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#666',
  },
  loadingSpinner: {
    fontSize: '48px',
    animation: 'spin 2s linear infinite',
    marginBottom: '20px',
  },
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative' as const,
  },
  connectionWarning: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    padding: '10px',
    background: '#fff3cd',
    color: '#856404',
    textAlign: 'center' as const,
    zIndex: 1000,
  },
  sidebar: {
    width: '320px',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
  },
  features: {
    display: 'flex',
    gap: '40px',
    marginTop: '60px',
    maxWidth: '900px',
  },
  feature: {
    flex: 1,
    padding: '30px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  featureIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
};

export default App;
