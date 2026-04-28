package com.swp1.backend.repository;

import com.swp1.backend.model.Departamento;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
public class DepartamentoRepositoryTest {

    @Autowired
    private DepartamentoRepository departamentoRepository;

    @Test
    public void testPersistirYRecuperarDepartamento() {
        Departamento dept = new Departamento();
        dept.setNombre("TI");
        dept.setDescripcion("Departamento de Tecnología");
        
        Departamento guardado = departamentoRepository.save(dept);
        assertThat(guardado.getId()).isNotNull();

        Optional<Departamento> recuperadoOpt = departamentoRepository.findById(guardado.getId());
        assertThat(recuperadoOpt).isPresent();
        assertThat(recuperadoOpt.get().getNombre()).isEqualTo("TI");
    }
}
