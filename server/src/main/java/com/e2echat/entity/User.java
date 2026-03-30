package com.e2echat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    private UUID id;
    private String username;
    private String passwordHash;
    private String identityKey;
    private String signedPreKey;
    private Integer registrationId;
    private Integer deviceId;
    private Integer signedPreKeyId;
    private String signedPreKeySignature;
    private Long signedPreKeyTimestamp;
    private Instant createdAt;
    private Instant updatedAt;
}
