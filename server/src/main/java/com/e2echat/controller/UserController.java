package com.e2echat.controller;

import com.e2echat.dto.ApiResponse;
import com.e2echat.dto.user.PublicKeyBundleDto;
import com.e2echat.dto.user.UserKeysResponse;
import com.e2echat.dto.user.UserResponse;
import com.e2echat.security.CurrentUser;
import com.e2echat.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(@CurrentUser UUID userId) {
        UserResponse response = userService.getCurrentUser(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<UserResponse>>>> getAllUsers(
            @CurrentUser UUID userId) {
        List<UserResponse> users = userService.getAllUsers(userId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("users", users)));
    }

    @GetMapping("/{userId}/keys")
    public ResponseEntity<ApiResponse<UserKeysResponse>> getUserPublicKeys(
            @PathVariable UUID userId) {
        UserKeysResponse response = userService.getUserPublicKeys(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/keys")
    public ResponseEntity<ApiResponse<Map<String, String>>> updatePublicKeys(
            @CurrentUser UUID userId,
            @Valid @RequestBody Map<String, PublicKeyBundleDto> request) {
        PublicKeyBundleDto publicKeys = request.get("publicKeys");

        if (publicKeys == null) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("VALIDATION_ERROR", "Invalid public key bundle"));
        }

        boolean updated = userService.updatePublicKeys(userId, publicKeys);

        if (!updated) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(ApiResponse.success(
            Map.of("message", "Public keys updated successfully")
        ));
    }
}
