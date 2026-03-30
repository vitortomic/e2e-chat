package com.e2echat.dto.user;

import java.util.UUID;

public record UserResponse(
    UUID id,
    String username
) {}
