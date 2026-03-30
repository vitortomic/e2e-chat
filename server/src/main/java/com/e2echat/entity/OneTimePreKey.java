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
public class OneTimePreKey {
    private UUID id;
    private UUID userId;
    private Integer keyId;
    private String keyData;
    private Boolean used;
    private Instant createdAt;
    private Instant usedAt;
}
