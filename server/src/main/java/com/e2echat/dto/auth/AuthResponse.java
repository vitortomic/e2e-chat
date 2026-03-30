package com.e2echat.dto.auth;

import java.util.UUID;

public record AuthResponse(
    String message,
    UUID userId,
    String username,
    String token
) {}
