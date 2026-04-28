package com.swp1.backend.controller;

import com.swp1.backend.service.GroqIntegrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiAssistantController {

    @Autowired
    private GroqIntegrationService groqService;

    @PostMapping("/command")
    public Map<String, Object> processCommand(@RequestBody Map<String, Object> payload) {
        String prompt = (String) payload.get("prompt");
        Map<String, Object> currentState = (Map<String, Object>) payload.get("currentState");
        
        return groqService.processNaturalLanguageCommand(prompt, currentState);
    }
}

