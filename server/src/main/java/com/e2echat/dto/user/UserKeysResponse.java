package com.e2echat.dto.user;

import java.util.List;
import java.util.UUID;

public record UserKeysResponse(
    UUID userId,
    String username,
    Integer registrationId,
    Integer deviceId,
    PublicKeys publicKeys
) {

    public record PublicKeys(
        String identityKey,
        SignedPreKey signedPreKey,
        List<PreKey> preKeys,
        String oneTimePreKey
    ) {}

    public record SignedPreKey(
        Integer keyId,
        String publicKey,
        String signature
    ) {}

    public record PreKey(
        Integer keyId,
        String publicKey
    ) {}
}
