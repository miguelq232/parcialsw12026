import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Marcar todas como leídas',
            onPressed: () {},
          ),
        ],
      ),
      body: ListView(
        children: [
          _buildNotificationItem(
            'Nuevo trámite asignado',
            'Se te ha asignado la tarea "Aprobación de Contrato" para el cliente Juan Pérez.',
            'Hace 5 min',
            Icons.assignment,
            Colors.blue,
            true,
          ),
          _buildNotificationItem(
            'Trámite observado',
            'La instalación del medidor CRE ha sido observada por el departamento Técnico.',
            'Hace 2 horas',
            Icons.warning,
            Colors.orange,
            false,
          ),
          _buildNotificationItem(
            'Actualización del sistema',
            'Nuevas políticas de negocio están disponibles en el motor de workflows.',
            'Hace 1 día',
            Icons.system_update,
            Colors.green,
            false,
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(String title, String body, String time, IconData icon, Color color, bool isUnread) {
    return Container(
      color: isUnread ? Colors.blue.withOpacity(0.05) : Colors.transparent,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.1),
          child: Icon(icon, color: color),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: isUnread ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(body),
            const SizedBox(height: 4),
            Text(
              time,
              style: TextStyle(
                color: Colors.black45,
                fontSize: 12,
                fontWeight: isUnread ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
        onTap: () {},
      ),
    );
  }
}
