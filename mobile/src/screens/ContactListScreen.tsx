import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import { logoutUserWithSignal } from '../services/signalAuthService';
import { signalMessagingService } from '../services/signalMessagingService';
import { signalStore } from '../services/signalProtocolStore';
import type { Contact } from '../types';

interface ContactListScreenProps {
  navigation: any;
  onLogout: () => void;
}

export const ContactListScreen: React.FC<ContactListScreenProps> = ({ navigation, onLogout }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    initializeServices();
    loadContacts();
    setupSocketListeners();

    return () => {
      // Cleanup socket listeners
      socketService.removeAllListeners();
    };
  }, []);

  const initializeServices = async () => {
    try {
      // Load Signal Protocol identity from storage
      const hasKeys = await signalStore.loadIdentity();
      if (!hasKeys) {
        console.warn('No Signal Protocol keys found in storage');
        Alert.alert(
          'Warning',
          'Encryption keys not found. You may need to logout and login again.'
        );
        return;
      }

      // Get current user and initialize messaging service
      const currentUser = await api.getCurrentUser();

      // Initialize messaging service if not already initialized
      if (!signalMessagingService.isInitialized()) {
        signalMessagingService.initialize(currentUser.id);
      }

      // Connect socket if not already connected
      if (!socketService.isConnected()) {
        await socketService.connect();
        // Request online users list after connecting
        requestOnlineUsers();
      }
    } catch (error) {
      console.error('Failed to initialize services:', error);
      Alert.alert('Error', 'Failed to initialize encryption services');
    }
  };

  const requestOnlineUsers = () => {
    socketService.getOnlineUsers((data: { userIds: string[] }) => {
      setContacts(prev =>
        prev.map(contact => ({
          ...contact,
          isOnline: data.userIds.includes(contact.id),
        }))
      );
    });
  };

  const loadContacts = async () => {
    try {
      // Get current user
      const currentUser = await api.getCurrentUser();
      setCurrentUserId(currentUser.id);

      // Get all users (unwrap the users array from response)
      const allUsersResponse = await api.getAllUsers();
      const allUsers = allUsersResponse.users;

      // Filter out current user and ensure valid IDs
      const contactList: Contact[] = allUsers
        .filter(user => user.id && user.id !== currentUser.id)
        .map(user => ({
          id: user.id,
          username: user.username,
          isOnline: false, // Will be updated by socket events
        }));

      setContacts(contactList);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupSocketListeners = () => {
    // Listen for online status updates
    socketService.onUserOnline((data: { userId: string }) => {
      setContacts(prev =>
        prev.map(contact =>
          contact.id === data.userId ? { ...contact, isOnline: true } : contact
        )
      );
    });

    socketService.onUserOffline((data: { userId: string }) => {
      setContacts(prev =>
        prev.map(contact =>
          contact.id === data.userId ? { ...contact, isOnline: false } : contact
        )
      );
    });

    // Listen for chat request notifications
    socketService.onChatRequest((data: { fromUserId: string; timestamp: Date }) => {
      setContacts(prev =>
        prev.map(contact =>
          contact.id === data.fromUserId ? { ...contact, hasChatRequest: true } : contact
        )
      );
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleContactPress = (contact: Contact) => {
    // Clear chat request indicator when opening the chat
    setContacts(prev =>
      prev.map(c =>
        c.id === contact.id ? { ...c, hasChatRequest: false } : c
      )
    );

    navigation.navigate('Chat', {
      contactId: contact.id,
      contactName: contact.username,
      isOnline: contact.isOnline,
    });
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUserWithSignal();
              signalMessagingService.clear();
              socketService.disconnect();
              onLogout();
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleContactPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusDot, item.isOnline && styles.statusDotOnline]} />
      </View>

      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.username}</Text>
        <Text style={styles.contactStatus}>
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
        {item.hasChatRequest && (
          <Text style={styles.chatRequestIndicator}>
            💬 Wants to chat with you
          </Text>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No contacts found</Text>
          <Text style={styles.emptySubtext}>Pull to refresh</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item, index) => item.id || `contact-${index}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ff3b30',
    fontSize: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#999',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusDotOnline: {
    backgroundColor: '#34C759',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactStatus: {
    fontSize: 14,
    color: '#666',
  },
  chatRequestIndicator: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: '#c7c7cc',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
});
