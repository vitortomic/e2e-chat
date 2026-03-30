package com.e2echat.websocket;

import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.e2echat.security.JwtUtil;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class SocketIoHandler {

    private final SocketIOServer server;
    private final JwtUtil jwtUtil;

    // userId -> SocketIOClient
    private final Map<String, SocketIOClient> onlineUsers = new ConcurrentHashMap<>();

    // sessionKey -> Set of userIds in that chat
    private final Map<String, Set<String>> activeChatSessions = new ConcurrentHashMap<>();

    @PostConstruct
    public void start() {
        // Authentication
        server.addConnectListener(client -> {
            String token = client.getHandshakeData().getSingleUrlParam("token");

            if (token == null || token.isEmpty()) {
                // Try auth header
                String authHeader = client.getHandshakeData().getHttpHeaders().get("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    token = authHeader.substring(7);
                }
            }

            if (token == null || !jwtUtil.validateToken(token)) {
                log.warn("Socket connection rejected: invalid token");
                client.disconnect();
                return;
            }

            String userId = jwtUtil.getUserIdFromToken(token);
            client.set("userId", userId);
            onlineUsers.put(userId, client);

            log.info("User connected: {}", userId);

            // Notify all users that this user is online
            server.getBroadcastOperations().sendEvent("user:online",
                Map.of("userId", userId));
        });

        // Disconnect
        server.addDisconnectListener(client -> {
            String userId = client.get("userId");
            if (userId == null) return;

            log.info("User disconnected: {}", userId);
            onlineUsers.remove(userId);

            // Remove user from all active chat sessions
            List<String> keysToRemove = new ArrayList<>();
            activeChatSessions.forEach((sessionKey, session) -> {
                if (session.remove(userId)) {
                    // Notify the other user in the session
                    String[] parts = sessionKey.split(":");
                    String otherUserId = parts[0].equals(userId) ? parts[1] : parts[0];
                    SocketIOClient otherClient = onlineUsers.get(otherUserId);

                    if (otherClient != null) {
                        otherClient.sendEvent("chat:user-left",
                            Map.of("userId", userId, "sessionActive", false));
                    }

                    if (session.isEmpty()) {
                        keysToRemove.add(sessionKey);
                    }
                }
            });
            keysToRemove.forEach(activeChatSessions::remove);

            server.getBroadcastOperations().sendEvent("user:offline",
                Map.of("userId", userId));
        });

        // Message send
        server.addEventListener("message:send", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");
            @SuppressWarnings("unchecked")
            Map<String, Object> encryptedContent = (Map<String, Object>) data.get("encryptedContent");

            log.info("Message send attempt from {} to {}", userId, recipientId);

            if (recipientId == null || encryptedContent == null) {
                client.sendEvent("error", Map.of("message", "Invalid message format"));
                return;
            }

            // Check if both users are in active chat session
            if (!areBothUsersInChat(userId, recipientId)) {
                log.warn("No active session between {} and {}", userId, recipientId);
                client.sendEvent("message:failed", Map.of(
                    "recipientId", recipientId,
                    "reason", "No active chat session. Both users must be in the chat."
                ));
                return;
            }

            SocketIOClient recipientClient = onlineUsers.get(recipientId);

            if (recipientClient != null) {
                String messageId = UUID.randomUUID().toString();
                log.info("Delivering message {} via active session", messageId);

                recipientClient.sendEvent("message:receive", Map.of(
                    "id", messageId,
                    "senderId", userId,
                    "encryptedContent", encryptedContent,
                    "timestamp", new Date()
                ));

                client.sendEvent("message:delivered", Map.of(
                    "messageId", messageId,
                    "recipientId", recipientId
                ));
            } else {
                log.warn("Recipient {} is offline", recipientId);
                client.sendEvent("message:failed", Map.of(
                    "recipientId", recipientId,
                    "reason", "Recipient is offline"
                ));
            }
        });

        // Typing indicators
        server.addEventListener("typing:start", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");
            SocketIOClient recipientClient = onlineUsers.get(recipientId);
            if (recipientClient != null) {
                recipientClient.sendEvent("typing:start", Map.of("userId", userId));
            }
        });

        server.addEventListener("typing:stop", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");
            SocketIOClient recipientClient = onlineUsers.get(recipientId);
            if (recipientClient != null) {
                recipientClient.sendEvent("typing:stop", Map.of("userId", userId));
            }
        });

        // Message read receipts
        server.addEventListener("message:read", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String messageId = (String) data.get("messageId");
            String senderId = (String) data.get("senderId");
            SocketIOClient senderClient = onlineUsers.get(senderId);
            if (senderClient != null) {
                senderClient.sendEvent("message:read", Map.of(
                    "messageId", messageId,
                    "readBy", userId
                ));
            }
        });

        // Get online users
        server.addEventListener("users:get-online", Map.class, (client, data, ackRequest) -> {
            List<String> onlineUserIds = new ArrayList<>(onlineUsers.keySet());
            client.sendEvent("users:online-list", Map.of("userIds", onlineUserIds));
        });

        // Chat enter
        server.addEventListener("chat:enter", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");
            String sessionKey = getSessionKey(userId, recipientId);

            log.info("User {} entered chat with {}", userId, recipientId);

            activeChatSessions
                .computeIfAbsent(sessionKey, k -> ConcurrentHashMap.newKeySet())
                .add(userId);

            boolean bothInChat = areBothUsersInChat(userId, recipientId);

            SocketIOClient recipientClient = onlineUsers.get(recipientId);
            if (recipientClient != null) {
                recipientClient.sendEvent("chat:user-entered", Map.of(
                    "userId", userId,
                    "sessionActive", bothInChat
                ));
            }

            client.sendEvent("chat:session-status", Map.of(
                "recipientId", recipientId,
                "sessionActive", bothInChat
            ));

            log.info("Session {} active: {}", sessionKey, bothInChat);
        });

        // Chat leave
        server.addEventListener("chat:leave", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");
            String sessionKey = getSessionKey(userId, recipientId);

            log.info("User {} left chat with {}", userId, recipientId);

            Set<String> session = activeChatSessions.get(sessionKey);
            if (session != null) {
                session.remove(userId);
                if (session.isEmpty()) {
                    activeChatSessions.remove(sessionKey);
                }
            }

            SocketIOClient recipientClient = onlineUsers.get(recipientId);
            if (recipientClient != null) {
                recipientClient.sendEvent("chat:user-left", Map.of(
                    "userId", userId,
                    "sessionActive", false
                ));
            }

            log.info("Session {} deactivated", sessionKey);
        });

        // Chat request
        server.addEventListener("chat:request", Map.class, (client, data, ackRequest) -> {
            String userId = client.get("userId");
            String recipientId = (String) data.get("recipientId");

            log.info("Chat request from {} to {}", userId, recipientId);

            SocketIOClient recipientClient = onlineUsers.get(recipientId);
            if (recipientClient != null) {
                recipientClient.sendEvent("chat:request-received", Map.of(
                    "fromUserId", userId,
                    "timestamp", new Date()
                ));
                log.info("Chat request delivered to {}", recipientId);
            } else {
                log.warn("Recipient {} is offline", recipientId);
                client.sendEvent("chat:request-failed", Map.of(
                    "recipientId", recipientId,
                    "reason", "Recipient is offline"
                ));
            }
        });

        server.start();
        log.info("Socket.IO server started on port {}", server.getConfiguration().getPort());
    }

    @PreDestroy
    public void stop() {
        server.stop();
        log.info("Socket.IO server stopped");
    }

    private String getSessionKey(String userId1, String userId2) {
        String[] sorted = new String[]{userId1, userId2};
        Arrays.sort(sorted);
        return sorted[0] + ":" + sorted[1];
    }

    private boolean areBothUsersInChat(String userId1, String userId2) {
        String sessionKey = getSessionKey(userId1, userId2);
        Set<String> session = activeChatSessions.get(sessionKey);
        return session != null && session.contains(userId1) && session.contains(userId2);
    }

    public List<String> getOnlineUsers() {
        return new ArrayList<>(onlineUsers.keySet());
    }
}
