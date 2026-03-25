import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function ReportsTab() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rapports & Statistiques</Text>
      </View>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>📊 Rapports en développement</Text>
        <Text style={styles.comingSoonHint}>
          Cette fonctionnalité arrive bientôt
        </Text>
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
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  comingSoonHint: {
    fontSize: 14,
    color: '#999',
  },
});
