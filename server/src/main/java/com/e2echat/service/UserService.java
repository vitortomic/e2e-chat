package com.e2echat.service;

import com.e2echat.dao.OneTimePreKeyDao;
import com.e2echat.dao.UserDao;
import com.e2echat.dto.user.*;
import com.e2echat.entity.OneTimePreKey;
import com.e2echat.entity.User;
import com.e2echat.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserDao userDao;
    private final OneTimePreKeyDao oneTimePreKeyDao;

    public UserResponse getCurrentUser(UUID userId) {
        User user = userDao.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return new UserResponse(user.getId(), user.getUsername());
    }

    public List<UserResponse> getAllUsers(UUID currentUserId) {
        return userDao.findAll().stream()
            .filter(user -> !user.getId().equals(currentUserId))
            .map(user -> new UserResponse(user.getId(), user.getUsername()))
            .toList();
    }

    @Transactional
    public UserKeysResponse getUserPublicKeys(UUID userId) {
        User user = userDao.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Get unused pre-keys for listing
        List<OneTimePreKey> preKeys = oneTimePreKeyDao.findUnusedByUserId(userId);

        // Consume one one-time pre-key for forward secrecy
        String oneTimePreKey = consumeOneTimePreKey(userId);

        List<UserKeysResponse.PreKey> preKeyList = preKeys.stream()
            .map(k -> new UserKeysResponse.PreKey(k.getKeyId(), k.getKeyData()))
            .toList();

        UserKeysResponse.SignedPreKey signedPreKey = new UserKeysResponse.SignedPreKey(
            user.getSignedPreKeyId(),
            user.getSignedPreKey(),
            user.getSignedPreKeySignature()
        );

        UserKeysResponse.PublicKeys publicKeys = new UserKeysResponse.PublicKeys(
            user.getIdentityKey(),
            signedPreKey,
            preKeyList,
            oneTimePreKey
        );

        return new UserKeysResponse(
            user.getId(),
            user.getUsername(),
            user.getRegistrationId(),
            user.getDeviceId(),
            publicKeys
        );
    }

    @Transactional
    public boolean updatePublicKeys(UUID userId, PublicKeyBundleDto publicKeys) {
        int updated = userDao.updatePublicKeys(
            userId,
            publicKeys.identityKey(),
            publicKeys.signedPreKey().publicKey(),
            publicKeys.signedPreKey().keyId(),
            publicKeys.signedPreKey().signature(),
            publicKeys.signedPreKey().timestamp(),
            publicKeys.registrationId(),
            publicKeys.deviceId()
        );

        if (updated == 0) {
            return false;
        }

        // Delete old unused one-time keys
        oneTimePreKeyDao.deleteUnusedByUserId(userId);

        // Insert new one-time pre-keys
        if (publicKeys.preKeys() != null && !publicKeys.preKeys().isEmpty()) {
            for (PublicKeyBundleDto.PreKeyDto preKey : publicKeys.preKeys()) {
                oneTimePreKeyDao.insert(userId, preKey.keyId(), preKey.publicKey());
            }
        }

        return true;
    }

    private String consumeOneTimePreKey(UUID userId) {
        return oneTimePreKeyDao.findFirstUnused(userId)
            .map(key -> {
                oneTimePreKeyDao.markAsUsed(key.getId());
                return key.getKeyData();
            })
            .orElse(null);
    }
}
