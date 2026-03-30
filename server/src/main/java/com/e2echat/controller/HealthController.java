package com.e2echat.controller;

import com.e2echat.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> healthData = Map.of(
            "status", "ok",
            "timestamp", Instant.now().toString()
        );

        return ResponseEntity.ok(ApiResponse.success(healthData));
    }
}
