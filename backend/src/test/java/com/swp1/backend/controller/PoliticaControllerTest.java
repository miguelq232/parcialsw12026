package com.swp1.backend.controller;

import com.swp1.backend.model.PoliticaDeNegocio;
import com.swp1.backend.repository.PoliticaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.flowable.engine.RuntimeService;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PoliticaController.class)
public class PoliticaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PoliticaRepository politicaRepository;

    @MockBean
    private RuntimeService runtimeService;

    @MockBean
    private MongoTemplate mongoTemplate;

    @Test
    public void testGetAll() throws Exception {
        PoliticaDeNegocio p1 = new PoliticaDeNegocio();
        p1.setNombre("P1");
        p1.setDescripcion("D1");
        when(politicaRepository.findAll()).thenReturn(Arrays.asList(p1));

        mockMvc.perform(get("/api/politicas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("P1"));
    }

    @Test
    public void testGetById() throws Exception {
        PoliticaDeNegocio p1 = new PoliticaDeNegocio();
        p1.setNombre("P1");
        p1.setDescripcion("D1");
        p1.setId("id123");
        when(politicaRepository.findById("id123")).thenReturn(Optional.of(p1));

        mockMvc.perform(get("/api/politicas/id123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("P1"));
    }

    @Test
    public void testCreate() throws Exception {
        PoliticaDeNegocio p1 = new PoliticaDeNegocio();
        p1.setNombre("P1");
        p1.setDescripcion("D1");
        when(politicaRepository.save(any(PoliticaDeNegocio.class))).thenReturn(p1);

        mockMvc.perform(post("/api/politicas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\": \"P1\", \"descripcion\": \"D1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("P1"));
    }
}
