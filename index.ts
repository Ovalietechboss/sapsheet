import { registerRootComponent } from 'expo';
import App from './App';
import db from './src/services/DatabaseService';

// Expose wipe helper early so it's available even before React mounts
if (typeof window !== 'undefined') {
	(window as any).sapWipe = async () => {
		await db.wipe();
		window.location.reload();
	};
}

registerRootComponent(App);
