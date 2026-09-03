import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useInvoiceStore } from '../stores/invoiceStore.supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import DashboardTab from '../components/DashboardTab';
import TimesheetsTab from '../components/TimesheetsTab';
import ClientsTab from '../components/ClientsTab';
import BilansTab from '../components/BilansTab';
import InvoicesTab from '../components/InvoicesTab';
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
    { id: 'bilans', label: '📊 Bilans', icon: '📊' },
    { id: 'factures', label: '🧾 Factures', icon: '🧾' },
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
      case 'factures':
        return <InvoicesTab />;
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
            // viewport-fit=cover + status-bar-style black-translucent font dessiner
            // l'app SOUS la barre d'etat : sans ce decalage, le bouton passe sous
            // l'encoche ou la Dynamic Island. env() vaut 0 la ou il n'y en a pas.
            top: 'calc(8px + env(safe-area-inset-top))',
            left: 'calc(10px + env(safe-area-inset-left))',
            zIndex: 10000,
            // Dimensions FIXES, pas des minima : avec minWidth/minHeight, le glyphe
            // et le padding poussaient la boite a ~63x82px — un rectangle, qui en
            // plus debordait des 70px reserves au-dessus du contenu et recouvrait
            // la carte d'en-tete (mesure sur capture Pixel 9a du 01/09/2026).
            // 44px = cible tactile minimale recommandee, et 8 + 44 = 52 < 60 :
            // le contenu passe juste dessous sans etre recouvert.
            boxSizing: 'border-box',
            width: '44px',
            height: '44px',
            padding: 0,
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '22px',
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
          // Le bouton menu est en position fixe AU-DESSUS du panneau (zIndex
          // 10000) et s'etend jusqu'a 52px : sans ce degagement il recouvrait
          // le titre « DomiTemps » du panneau une fois celui-ci ouvert.
          paddingTop: isMobile
            ? 'calc(64px + env(safe-area-inset-top))'
            : 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
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

        {/* Acces a la console d'administration.
            Il n'existait qu'un lien gris clair en bas de l'accueil, quasi
            introuvable et minuscule au doigt — or c'est le seul chemin sur
            l'app native, qui n'a pas de barre d'adresse pour taper /admin.
            Masque pendant une impersonation, puisque `user` est alors la cible :
            on en sort par « Revenir admin » dans la banniere orange. */}
        {user?.role === 'admin' && (
          <button
            onClick={() => { window.location.href = '/admin'; }}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '8px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
            }}
          >
            🛠️ Administration
          </button>
        )}

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
          padding: isMobile ? '60px 20px 20px 20px' : '40px',
          paddingTop: isMobile
            ? 'calc(60px + env(safe-area-inset-top))'
            : 'calc(40px + env(safe-area-inset-top))',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
        }}
      >
        {renderContent()}
      </div>
    </div>
    </div>
  );
}
