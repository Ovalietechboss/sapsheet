// @ts-nocheck
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Modal,
  TextInput,
} from 'react-native';
import { useTimesheetStore, Timesheet } from '../../stores/timesheetStore';
import { useClientStore } from '../../stores/clientStore';
import { v4 as uuid } from 'uuid';

export default function TimesheetsTab() {
  const { timesheets, addTimesheet, deleteTimesheet } = useTimesheetStore();
  const { clients } = useClientStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const todayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    date: todayStr(),
    dateArrival: '',
    timeDeparture: '',
  });

  const handleCreateTimesheet = () => {
    if (!formData.clientId || !formData.dateArrival || !formData.timeDeparture) {
      alert('Tous les champs sont requis');
      return;
    }

    // Calculate duration (même jour pour les deux)
    const arrivalTime = new Date(`${formData.date}T${formData.dateArrival}:00`);
    const departureTime = new Date(`${formData.date}T${formData.timeDeparture}:00`);
    const durationMinutes = Math.round(
      (departureTime.getTime() - arrivalTime.getTime()) / (1000 * 60)
    );

    if (durationMinutes <= 0) {
      alert('Heure de départ doit être après arrivée');
      return;
    }

    const newTimesheet: Timesheet = {
      id: `ts_${uuid()}`,
      assistantId: 'user_123', // Placeholder
      clientId: formData.clientId,
      dateArrival: `${formData.date} ${formData.dateArrival}`,
      timeDeparture: `${formData.date} ${formData.timeDeparture}`,
      durationMinutes,
      durationHours: Math.round((durationMinutes / 60) * 100) / 100,
      fraisAnnexes: [],
      status: 'draft',
      cesuNumber: 'CESU123456',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addTimesheet(newTimesheet);
    setShowModal(false);
    setFormData({ clientId: clients[0]?.id || '', date: todayStr(), dateArrival: '', timeDeparture: '' });
  };

  const renderTimesheet = ({ item }: { item: Timesheet }) => {
    const client = clients.find((c) => c.id === item.clientId);
    return (
      <View style={styles.timesheetCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{client?.name}</Text>
          <Text style={styles.cardTime}>
            {item.dateArrival.split(' ')[1]} - {item.timeDeparture.split(' ')[1]}
          </Text>
        </View>
        <Text style={styles.cardDuration}>{item.durationHours}h</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => setSelectedTimesheet(item)}
            style={styles.detailButton}
          >
            <Text style={styles.detailButtonText}>Détails</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteTimesheet(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Pointages</Text>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={timesheets}
        renderItem={renderTimesheet}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />

      {/* Modal: Create Timesheet */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Pointage</Text>

            <Text style={styles.label}>Client</Text>
            <View style={styles.picker}>
              <Text>{clients.find((c) => c.id === formData.clientId)?.name}</Text>
            </View>

            <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-03-29"
              value={formData.date}
              onChangeText={(text) => setFormData({ ...formData, date: text })}
            />

            <Text style={styles.label}>Heure Arrivée (HH:mm)</Text>
            <TextInput
              style={styles.input}
              placeholder="08:00"
              value={formData.dateArrival}
              onChangeText={(text) => setFormData({ ...formData, dateArrival: text })}
            />

            <Text style={styles.label}>Heure Départ (HH:mm)</Text>
            <TextInput
              style={styles.input}
              placeholder="17:00"
              value={formData.timeDeparture}
              onChangeText={(text) => setFormData({ ...formData, timeDeparture: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTimesheet}
                style={styles.createButton}
              >
                <Text style={styles.createButtonText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Timesheet Details */}
      {selectedTimesheet && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Détails du Pointage</Text>
              <Text style={styles.label}>
                Date: {selectedTimesheet.dateArrival.split(' ')[0]}
              </Text>
              <Text style={styles.label}>
                Arrivée: {selectedTimesheet.dateArrival.split(' ')[1]}
              </Text>
              <Text style={styles.label}>
                Départ: {selectedTimesheet.timeDeparture.split(' ')[1]}
              </Text>
              <Text style={styles.label}>Durée: {selectedTimesheet.durationHours}h</Text>
              <Text style={styles.label}>
                Frais annexes: {selectedTimesheet.fraisAnnexes.length} item(s)
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedTimesheet(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: 12,
  },
  timesheetCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cardTime: {
    fontSize: 12,
    color: '#666',
  },
  cardDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    justifyContent: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
