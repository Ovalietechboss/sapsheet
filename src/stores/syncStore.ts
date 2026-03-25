import { create } from 'zustand';

export interface SyncQueueItem {
  id: string;
  entityType: 'TIMESHEET' | 'CLIENT' | 'USER' | 'INVOICE';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  status: 'pending' | 'synced' | 'failed';
  retries: number;
  error?: string;
  createdAt: number;
  syncedAt?: number;
}

interface SyncState {
  syncQueue: SyncQueueItem[];
  lastSyncTime: number | null;
  isOnline: boolean;
  isSyncing: boolean;
  
  // Queue operations
  queueChange: (item: SyncQueueItem) => void;
  markSynced: (itemId: string) => void;
  removeFromQueue: (itemId: string) => void;
  
  // Status
  setOnlineStatus: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  
  // Queries
  getPendingItems: () => SyncQueueItem[];
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncQueue: [],
  lastSyncTime: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  
  queueChange: (item: SyncQueueItem) => {
    set((state) => ({
      syncQueue: [...state.syncQueue, item],
    }));
  },
  
  markSynced: (itemId: string) => {
    set((state) => ({
      syncQueue: state.syncQueue.map((item) =>
        item.id === itemId
          ? { ...item, status: 'synced', syncedAt: Date.now() }
          : item
      ),
    }));
  },
  
  removeFromQueue: (itemId: string) => {
    set((state) => ({
      syncQueue: state.syncQueue.filter((item) => item.id !== itemId),
    }));
  },
  
  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online });
  },
  
  setSyncing: (syncing: boolean) => {
    set({ isSyncing: syncing });
  },
  
  setLastSyncTime: (time: number) => {
    set({ lastSyncTime: time });
  },
  
  getPendingItems: () => {
    return get().syncQueue.filter((item) => item.status === 'pending');
  },
}));
