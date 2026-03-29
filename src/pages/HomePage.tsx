import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useInvoiceStore } from '../stores/invoiceStore.supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import DashboardTab from '../components/DashboardTab';
import TimesheetsTab from '../components/TimesheetsTab';
import ClientsTab from '../components/ClientsTab';
import ReportsTab from '../components/ReportsTab';
import BilansTab from '../components/BilansTab';
import ProfileTab from '../components/ProfileTab';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user, logout, isImpersonating, stopImpersonating } = useAuthStore();
  const { hydrateTimesheets } = useTimesheetStore();
  const { hydrateClients } = useClientStore();
  const { hydrateInvoices } = useInvoiceStore();

  const tabs = [
    { id: 'dashboard', label: '🏠 Accueil', icon: '🏠' },
    { id: 'timesheets', label: '📋 Pointages', icon: '📋' },
    { id: 'clients', label: '👥 Clients', icon: '👥' },
    { id: 'bilans', label: '📅 Bilans', icon: '📅' },
    { id: 'reports', label: '📊 Rapports', icon: '📊' },
    { id: 'profile', label: '⚙️ Profil', icon: '⚙️' },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab onNavigate={handleTabClick} />;
      case 'timesheets':
        return <TimesheetsTab />;
      case 'clients':
        return <ClientsTab />;
      case 'bilans':
        return <BilansTab />;
      case 'reports':
        return <ReportsTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#fff', flexDirection: 'column' }}>
      {/* Bannière impersonation */}
      {isImpersonating && (
        <div style={{
          background: '#FF9500', color: 'white', padding: '8px 20px',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px',
          fontSize: '13px', fontWeight: '600', flexShrink: 0,
        }}>
          <span>Connecté en tant que {user?.display_name} ({user?.email})</span>
          <button
            onClick={() => { stopImpersonating(); window.location.href = '/admin'; }}
            style={{ padding: '4px 14px', backgroundColor: 'white', color: '#FF9500', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
          >
            Revenir admin
          </button>
        </div>
      )}
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={handleMenuToggle}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            zIndex: 10000,
            minWidth: '56px',
            minHeight: '56px',
            padding: '16px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
          type="button"
          aria-label="Toggle menu"
        >
          ☰
        </button>
      )}

      {/* Backdrop for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          onClick={handleMenuToggle}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          width: '200px',
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #ddd',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile ? (isMobileMenuOpen ? 0 : '-220px') : 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          transition: 'left 0.3s ease',
        }}
      >
        <h2 style={{ marginBottom: '30px', fontSize: '18px' }}>DomiTemps</h2>
        <nav style={{ flex: 1 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: activeTab === tab.id ? '#007AFF' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#ff3b30',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Déconnexion
        </button>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: isMobile ? '70px 20px 20px 20px' : '40px',
          overflowY: 'auto',
        }}
      >
        {renderContent()}
      </div>
    </div>
    </div>
  );
}
