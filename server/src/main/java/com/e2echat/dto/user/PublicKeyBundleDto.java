package com.e2echat.dto.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PublicKeyBundleDto(
    @NotBlank String identityKey,
    @NotNull @Valid SignedPreKeyDto signedPreKey,
    @NotNull List<PreKeyDto> preKeys,
    @NotNull Integer registrationId,
    @NotNull Integer deviceId
) {

    public record SignedPreKeyDto(
        @NotNull Integer keyId,
        @NotBlank String publicKey,
        @NotBlank String signature,
        @NotNull Long timestamp
    ) {}

    public record PreKeyDto(
        @NotNull Integer keyId,
        @NotBlank String publicKey
    ) {}
}
