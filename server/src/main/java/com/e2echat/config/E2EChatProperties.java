package com.e2echat.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "e2echat")
public class E2EChatProperties {

    private JwtProperties jwt = new JwtProperties();
    private CorsProperties cors = new CorsProperties();
    private SocketIoProperties socketio = new SocketIoProperties();

    @Data
    public static class JwtProperties {
        private String secret;
        private Long expirationMs;
    }

    @Data
    public static class CorsProperties {
        private String origin;
    }

    @Data
    public static class SocketIoProperties {
        private Integer port;
    }
}
