package com.e2echat.dto.auth;

import com.e2echat.dto.user.PublicKeyBundleDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank String username,
    @NotBlank @Size(min = 8) String password,
    @NotNull @Valid PublicKeyBundleDto publicKeys
) {}
