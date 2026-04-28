package com.swp1.backend.controller;

import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.repository.PoliticaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/politicas")
@CrossOrigin(origins = "*")
public class PoliticaController {

    @Autowired
    private PoliticaRepository politicaRepository;

    @Autowired
    private com.swp1.backend.service.WorkflowEngineService workflowEngineService;

    @GetMapping
    public List<PoliticaDeNegocio> getAll() {
        return politicaRepository.findAll();
    }

    @PostMapping
    public org.springframework.http.ResponseEntity<?> save(@RequestBody PoliticaDeNegocio politica) {
        try {
            PoliticaDeNegocio saved = politicaRepository.save(politica);
            workflowEngineService.deployPolitica(saved);
            return org.springframework.http.ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return org.springframework.http.ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Map.of("error", "Error al guardar/desplegar el flujo: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public PoliticaDeNegocio getById(@PathVariable String id) {
        return politicaRepository.findById(id).orElse(null);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        politicaRepository.deleteById(id);
    }
}
