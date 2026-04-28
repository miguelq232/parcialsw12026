package com.swp1.backend.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import com.swp1.backend.service.PresenceService;
import java.util.Map;
import java.util.List;

@Controller
public class CollaborationController {

    @Autowired
    private PresenceService presenceService;

    @MessageMapping("/designer/sync/{policyId}")
    @SendTo("/topic/policy/{policyId}")
    public Map<String, Object> syncWorkflow(@DestinationVariable String policyId, @Payload Map<String, Object> state) {
        // Broadcasts the payload (which includes nodes, connections, and senderId) 
        // to all subscribers of /topic/policy/{policyId}
        return state;
    }

    @Autowired
    private org.springframework.messaging.simp.SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/designer/presence/join/{policyId}")
    public void joinPresence(@DestinationVariable String policyId, @Payload Map<String, String> user, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        presenceService.addSession(sessionId, policyId, user);
        
        // Broadcast the updated list of users to the specific policy presence channel
        messagingTemplate.convertAndSend("/topic/presence/" + policyId, presenceService.getUsersForPolicy(policyId));
    }
}
