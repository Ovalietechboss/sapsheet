import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useTimesheetStore, Timesheet } from '../stores/timesheetStore';
import { useClientStore } from '../stores/clientStore';
import TimesheetsTab from './tabs/TimesheetsTab';
import ClientsTab from './tabs/ClientsTab';
import InvoicesTab from './tabs/InvoicesTab';
import ReportsTab from './tabs/ReportsTab';
import ProfileTab from './tabs/ProfileTab';

export default function MainApp() {
  const { logout, user } = useAuthStore();
  const { activeTab, setActiveTab } = useUIStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'timesheets':
        return <TimesheetsTab />;
      case 'clients':
        return <ClientsTab />;
      case 'invoices':
        return <InvoicesTab />;
      case 'reports':
        return <ReportsTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return <TimesheetsTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SAP Sheet</Text>
          <Text style={styles.userInfo}>
            {user?.displayName} ({user?.type === 'assistant' ? 'Assistante' : 'Employeur'})
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Bottom Tab Navigation */}
      <View style={styles.tabBar}>
        {[
          { key: 'timesheets', label: 'Timesheets', icon: '📋' },
          { key: 'clients', label: 'Clients', icon: '👥' },
          { key: 'invoices', label: 'Factures', icon: '💳' },
          { key: 'reports', label: 'Rapports', icon: '📊' },
          { key: 'profile', label: 'Profil', icon: '⚙️' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    fontSize: 12,
    color: '#fff9',
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  logoutText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: 'white',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  tabButtonActive: {
    borderTopColor: '#007AFF',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    color: '#999',
  },
  tabLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
