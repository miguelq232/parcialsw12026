package com.swp1.backend.controller;

import com.swp1.backend.service.GroqIntegrationService;
import com.swp1.backend.service.AiPredictionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiAssistantController {

    @Autowired
    private GroqIntegrationService groqService;

    @Autowired
    private AiPredictionService aiPredictionService;

    @PostMapping("/command")
    public Map<String, Object> processCommand(@RequestBody Map<String, Object> payload) {
        String prompt = (String) payload.get("prompt");
        Map<String, Object> currentState = (Map<String, Object>) payload.get("currentState");
        
        return groqService.processNaturalLanguageCommand(prompt, currentState);
    }

    @PostMapping("/form-fill")
    public Map<String, Object> processFormFill(@RequestBody Map<String, Object> payload) {
        String transcript = (String) payload.get("transcript");
        Map<String, Object> formContext = (Map<String, Object>) payload.get("formContext");

        return groqService.processFormFillCommand(transcript, formContext);
    }

    @GetMapping("/tramites/{tramiteId}/prediction")
    public ResponseEntity<?> predictTramite(@PathVariable String tramiteId) {
        try {
            return ResponseEntity.ok(aiPredictionService.predictTramite(tramiteId));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error generando prediccion: " + e.getMessage()));
        }
    }
}
