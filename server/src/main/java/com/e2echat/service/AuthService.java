package com.e2echat.service;

import com.e2echat.dao.OneTimePreKeyDao;
import com.e2echat.dao.UserDao;
import com.e2echat.dto.auth.AuthResponse;
import com.e2echat.dto.auth.LoginRequest;
import com.e2echat.dto.auth.RegisterRequest;
import com.e2echat.dto.user.PublicKeyBundleDto;
import com.e2echat.entity.User;
import com.e2echat.exception.AuthenticationException;
import com.e2echat.exception.ResourceConflictException;
import com.e2echat.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserDao userDao;
    private final OneTimePreKeyDao oneTimePreKeyDao;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userDao.findByUsername(request.username()).isPresent()) {
            throw new ResourceConflictException("Username already exists");
        }

        PublicKeyBundleDto keys = request.publicKeys();

        User user = User.builder()
            .id(UUID.randomUUID())
            .username(request.username())
            .passwordHash(passwordEncoder.encode(request.password()))
            .identityKey(keys.identityKey())
            .signedPreKey(keys.signedPreKey().publicKey())
            .signedPreKeyId(keys.signedPreKey().keyId())
            .signedPreKeySignature(keys.signedPreKey().signature())
            .signedPreKeyTimestamp(keys.signedPreKey().timestamp())
            .registrationId(keys.registrationId())
            .deviceId(keys.deviceId())
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

        userDao.insert(user);

        // Insert one-time pre-keys
        if (keys.preKeys() != null && !keys.preKeys().isEmpty()) {
            for (PublicKeyBundleDto.PreKeyDto preKey : keys.preKeys()) {
                oneTimePreKeyDao.insert(user.getId(), preKey.keyId(), preKey.publicKey());
            }
        }

        log.info("User registered: {}", user.getUsername());

        String token = jwtUtil.generateToken(user.getId());

        return new AuthResponse(
            "User registered successfully",
            user.getId(),
            user.getUsername(),
            token
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userDao.findByUsername(request.username())
            .orElseThrow(() -> new AuthenticationException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthenticationException("Invalid credentials");
        }

        log.info("User logged in: {}", user.getUsername());

        String token = jwtUtil.generateToken(user.getId());

        return new AuthResponse(
            "Login successful",
            user.getId(),
            user.getUsername(),
            token
        );
    }
}
