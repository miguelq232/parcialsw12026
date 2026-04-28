package com.swp1.backend.controller;

import com.swp1.backend.model.Departamento;
import com.swp1.backend.repository.DepartamentoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.flowable.engine.RuntimeService;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DepartamentoController.class)
public class DepartamentoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DepartamentoRepository departamentoRepository;

    @MockBean
    private RuntimeService runtimeService;

    @MockBean
    private MongoTemplate mongoTemplate;

    @Test
    public void testGetAll() throws Exception {
        Departamento d1 = new Departamento();
        d1.setNombre("TI");
        d1.setDescripcion("Tech");
        when(departamentoRepository.findAll()).thenReturn(Arrays.asList(d1));

        mockMvc.perform(get("/api/departamentos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("TI"));
    }
}
