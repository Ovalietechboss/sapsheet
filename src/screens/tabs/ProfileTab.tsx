import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

export default function ProfileTab() {
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Profil</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom:</Text>
            <Text style={styles.fieldValue}>{user?.displayName}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email:</Text>
            <Text style={styles.fieldValue}>{user?.email}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Type de compte:</Text>
            <Text style={styles.fieldValue}>
              {user?.type === 'assistant' ? 'Assistante' : 'Employeur'}
            </Text>
          </View>
        </View>

        {user?.type === 'assistant' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations CESU</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>N° CESU:</Text>
              <Text style={styles.fieldValue}>{user?.cesuNumber || 'Non configuré'}</Text>
            </View>
          </View>
        )}

        {user?.type === 'employer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations Légales</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>SIREN:</Text>
              <Text style={styles.fieldValue}>{user?.siren || 'Non configuré'}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>SIRET:</Text>
              <Text style={styles.fieldValue}>{user?.siret || 'Non configuré'}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
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
  profileCard: {
    backgroundColor: 'white',
    margin: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});
