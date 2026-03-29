import React, { useEffect, useState } from 'react';
import { useAuthStore } from './src/stores/authStore';
import { useClientStore } from './src/stores/clientStore.supabase';
import { useTimesheetStore } from './src/stores/timesheetStore.supabase';
import { useInvoiceStore } from './src/stores/invoiceStore.supabase';
import { useMandataireStore } from './src/stores/mandataireStore.supabase';
import { useBillingPeriodStore } from './src/stores/billingPeriodStore.supabase';
import LoginPage from './src/pages/LoginPage';
import HomePage from './src/pages/HomePage';
import ResetPasswordPage from './src/pages/ResetPasswordPage';

export default function App() {
  const { isAuthenticated, isCheckingSession, checkSession, loadUser } = useAuthStore();
  const { hydrateClients } = useClientStore();
  const { hydrateTimesheets } = useTimesheetStore();
  const { hydrateInvoices } = useInvoiceStore();
  const { hydrateMandataires } = useMandataireStore();
  const { hydratePeriods } = useBillingPeriodStore();
  const [isHydrating, setIsHydrating] = useState(false);

  // Vérifier la session existante au démarrage
  useEffect(() => {
    checkSession();
  }, []);

  // Charger les données une fois connecté
  useEffect(() => {
    if (isAuthenticated && !isHydrating) {
      setIsHydrating(true);
      Promise.all([
        loadUser().catch(err => console.error('User load error:', err)),
        hydrateClients().catch(err => console.error('Clients hydration error:', err)),
        hydrateMandataires().catch(err => console.error('Mandataires hydration error:', err)),
        hydratePeriods().catch(err => console.error('Periods hydration error:', err)),
        hydrateTimesheets().catch(err => console.error('Timesheets hydration error:', err)),
        hydrateInvoices().catch(err => console.error('Invoices hydration error:', err)),
      ]).finally(() => setIsHydrating(false));
    }
  }, [isAuthenticated]);

  // Écran de chargement initial (vérification de session)
  if (isCheckingSession) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f0f2f5',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e0e0e0',
            borderTop: '4px solid #007AFF',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>SAP Sheet</p>
      </div>
    );
  }

  // Écran de chargement des données
  if (isHydrating) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#f0f2f5',
        }}
      >
        <p style={{ fontSize: '18px', color: '#333' }}>Chargement...</p>
      </div>
    );
  }

  // Page de reset password (lien depuis email Supabase)
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  return isAuthenticated ? <HomePage /> : <LoginPage />;
}
