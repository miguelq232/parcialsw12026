package com.swp1.backend.config;

import com.swp1.backend.service.PresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import java.util.Map;

@Component
public class WebSocketEventListener {

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @Autowired
    private PresenceService presenceService;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        
        Map<String, String> userInfo = presenceService.removeSession(sessionId);
        if (userInfo != null) {
            String policyId = userInfo.get("policyId");
            // Broadcast the updated list of users to the specific policy presence channel
            messagingTemplate.convertAndSend("/topic/presence/" + policyId, presenceService.getUsersForPolicy(policyId));
        }
    }
}
