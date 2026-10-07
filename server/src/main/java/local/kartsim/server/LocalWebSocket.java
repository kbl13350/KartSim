package local.kartsim.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** A single WebSocket carries request/reply JSON and small binary motion frames. */
@Configuration
@EnableWebSocket
public class LocalWebSocket implements WebSocketConfigurer {
    private final Handler handler;
    private final LocalNetwork network;

    public LocalWebSocket(LobbyService lobby, ObjectMapper json, LocalNetwork network) {
        handler = new Handler(lobby, json);
        this.network = network;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/multiplayer/ws")
            .setAllowedOriginPatterns(network.originPatterns());
    }

    private static final class Handler extends TextWebSocketHandler {
        private static final Logger LOG = LoggerFactory.getLogger(Handler.class);
        private final LobbyService lobby;
        private final ObjectMapper json;
        private final Map<String, LobbyService.Client> clients = new ConcurrentHashMap<>();
        private final Map<String, WebSocketSession> outbound = new ConcurrentHashMap<>();

        Handler(LobbyService lobby, ObjectMapper json) {
            this.lobby = lobby;
            this.json = json;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            WebSocketSession decorated = new ConcurrentWebSocketSessionDecorator(session, 5_000, 2_000_000);
            outbound.put(session.getId(), decorated);
            clients.put(session.getId(), new LobbyService.Client(session.getId(),
                message -> sendText(session.getId(), message),
                bytes -> sendBinary(session.getId(), bytes)));
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage incoming) {
            LobbyService.Client client = clients.get(session.getId());
            if (client == null) return;
            String requestId = null;
            try {
                JsonNode request = json.readTree(incoming.getPayload());
                if (request == null || !request.isObject()) throw new ApiError(400, "INVALID_REQUEST");
                JsonNode id = request.get("requestId");
                if (id != null) {
                    if (!id.isTextual() || id.textValue().isBlank() || id.textValue().length() > 64)
                        throw new ApiError(400, "INVALID_REQUEST_ID");
                    requestId = id.textValue();
                }
                Map<String, Object> response = lobby.handle(client, request);
                if (requestId != null) {
                    Map<String, Object> envelope = new LinkedHashMap<>(response);
                    envelope.put("requestId", requestId);
                    sendText(session.getId(), envelope);
                }
            } catch (ApiError rejected) {
                error(session.getId(), requestId, rejected.getMessage());
            } catch (Exception failed) {
                LOG.error("WebSocket command failed", failed);
                error(session.getId(), requestId, "INTERNAL_ERROR");
            }
        }

        @Override
        protected void handleBinaryMessage(WebSocketSession session, BinaryMessage incoming) {
            LobbyService.Client client = clients.get(session.getId());
            if (client == null) return;
            byte[] bytes = new byte[incoming.getPayloadLength()];
            incoming.getPayload().get(bytes);
            lobby.relayMotion(client, bytes);
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            LobbyService.Client client = clients.remove(session.getId());
            outbound.remove(session.getId());
            if (client != null) {
                try { lobby.disconnect(client); }
                catch (RuntimeException failed) {
                    LOG.warn("Room cleanup after WebSocket close failed", failed);
                }
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            LOG.warn("WebSocket transport error: {}", exception.toString());
            try { session.close(CloseStatus.SERVER_ERROR); }
            catch (Exception ignored) { /* The peer may have closed concurrently. */ }
        }

        private void error(String sessionId, String requestId, String code) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("type", "error");
            response.put("code", code);
            if (requestId != null) response.put("requestId", requestId);
            sendText(sessionId, response);
        }
        private void sendText(String sessionId, Map<String, Object> message) {
            WebSocketSession session = outbound.get(sessionId);
            if (session == null || !session.isOpen()) return;
            try { session.sendMessage(new TextMessage(json.writeValueAsString(message))); }
            catch (Exception failed) {
                // isOpen can change between the check and sendMessage.
                LOG.debug("WebSocket text send stopped: {}", failed.toString());
            }
        }
        private void sendBinary(String sessionId, byte[] frame) {
            WebSocketSession session = outbound.get(sessionId);
            if (session == null || !session.isOpen()) return;
            try { session.sendMessage(new BinaryMessage(frame)); }
            catch (Exception failed) {
                LOG.debug("WebSocket binary send stopped: {}", failed.toString());
            }
        }
    }
}
