package com.e2echat.config;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.Transport;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class SocketIoConfig {

    private final E2EChatProperties properties;

    @Bean
    public SocketIOServer socketIOServer() {
        com.corundumstudio.socketio.Configuration config =
            new com.corundumstudio.socketio.Configuration();

        config.setHostname("0.0.0.0");
        config.setPort(properties.getSocketio().getPort());
        config.setOrigin(properties.getCors().getOrigin());
        config.setTransports(Transport.WEBSOCKET, Transport.POLLING);
        config.setMaxHttpContentLength(10 * 1024 * 1024); // 10MB for encrypted image messages

        return new SocketIOServer(config);
    }
}
