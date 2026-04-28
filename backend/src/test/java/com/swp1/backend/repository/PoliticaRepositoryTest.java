package com.swp1.backend.repository;

import com.swp1.backend.model.Conexion;
import com.swp1.backend.model.Nodo;
import com.swp1.backend.model.PoliticaDeNegocio;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
public class PoliticaRepositoryTest {

    @Autowired
    private PoliticaRepository politicaRepository;

    @Test
    public void testPersistirYRecuperarPolitica() {
        // 1. Crear Nodos
        Nodo inicio = new Nodo();
        inicio.setId("n1");
        inicio.setNombre("Inicio Proceso");
        inicio.setTipo(Nodo.TipoNodo.INICIO);
        inicio.setX(100);
        inicio.setY(100);

        Nodo actividad = new Nodo();
        actividad.setId("n2");
        actividad.setNombre("Revisar Documentación");
        actividad.setTipo(Nodo.TipoNodo.ACTIVIDAD);
        actividad.setDepartamentoId("dept-legal");
        actividad.setX(300);
        actividad.setY(100);

        // 2. Crear Conexion
        Conexion c1 = new Conexion();
        c1.setId("c1");
        c1.setOrigenId("n1");
        c1.setDestinoId("n2");
        c1.setCondicion("DEFAULT");

        // 3. Crear Política
        PoliticaDeNegocio politica = new PoliticaDeNegocio();
        politica.setNombre("Politica de Prueba");
        politica.setDescripcion("Descripción de prueba");
        politica.setNodos(Arrays.asList(inicio, actividad));
        politica.setConexiones(Arrays.asList(c1));

        // 4. Persistir
        PoliticaDeNegocio guardada = politicaRepository.save(politica);
        assertThat(guardada.getId()).isNotNull();

        // 5. Recuperar
        Optional<PoliticaDeNegocio> recuperadaOpt = politicaRepository.findById(guardada.getId());
        assertThat(recuperadaOpt).isPresent();
        
        PoliticaDeNegocio recuperada = recuperadaOpt.get();
        assertThat(recuperada.getNombre()).isEqualTo("Politica de Prueba");
        assertThat(recuperada.getNodos()).hasSize(2);
        assertThat(recuperada.getConexiones()).hasSize(1);
        assertThat(recuperada.getConexiones().get(0).getOrigenId()).isEqualTo("n1");
    }
}
