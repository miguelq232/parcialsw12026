package com.swp1.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GroqIntegrationService {

    @Value("${groq.api.key:}") // Dejar vacío por defecto, el usuario debe configurarlo
    private String apiKey;

    private final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> processNaturalLanguageCommand(String prompt, Map<String, Object> currentState) {
        if (apiKey == null || apiKey.isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Falta la API Key de Groq. Configura groq.api.key en application.properties o variables de entorno.");
            return error;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            String systemPrompt = "Eres un asistente para editar diagramas BPMN de trámites. " +
                    "Devuelve SOLO un objeto JSON válido. " +
                    "Formato esperado: {\"message\": \"Explicación corta\", \"actions\": [{\"action\": \"ADD_NODE\", \"tipo\": \"ACTIVIDAD|INICIO|FIN\", \"nombre\": \"Nombre\", \"departamentoId\": \"1|2|3\"}, {\"action\": \"ADD_CONNECTION\", \"origenNombre\": \"Nodo A\", \"destinoNombre\": \"Nodo B\"}, {\"action\": \"ADD_FIELD\", \"nodeNombre\": \"Nombre de la Actividad\", \"etiqueta\": \"Nombre del campo\", \"tipo\": \"TEXTO|NUMERO|SELECCION|FOTO\"}]}. " +
                    "Departamentos: 1=Atención al Cliente, 2=Revisión Técnica / Riesgos, 3=Dirección / Aprobación. " +
                    "Si el usuario pide subir archivos, usa el tipo FOTO. " +
                    "No incluyas texto fuera del JSON.";

            String userPrompt = "Estado actual del diagrama: " + objectMapper.writeValueAsString(currentState) +
                    "\nComando del usuario: " + prompt;

            Map<String, Object> messageSystem = Map.of("role", "system", "content", systemPrompt);
            Map<String, Object> messageUser = Map.of("role", "user", "content", userPrompt);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "openai/gpt-oss-120b");
            requestBody.put("messages", List.of(messageSystem, messageUser));
            requestBody.put("response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(GROQ_API_URL, request, Map.class);
            Map<String, Object> responseBody = response.getBody();

            List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");

            return objectMapper.readValue(content, Map.class);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Error procesando la solicitud con Groq: " + e.getMessage());
            return error;
        }
    }
}
