// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useInvoiceStore } from '../../stores/invoiceStore';

export default function InvoicesTab() {
  const { invoices } = useInvoiceStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Factures</Text>
      </View>

      {invoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucune facture créée</Text>
          <Text style={styles.emptyHint}>
            Créez des pointages pour générer des factures
          </Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          renderItem={({ item }) => (
            <View style={styles.invoiceCard}>
              <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
              <Text style={styles.invoiceTotal}>{item.totalTTC.toFixed(2)}€</Text>
              <Text style={styles.invoiceStatus}>{item.status}</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: '#999',
  },
  list: {
    padding: 12,
  },
  invoiceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  invoiceTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34C759',
    marginTop: 4,
  },
  invoiceStatus: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textTransform: 'capitalize',
  },
});
