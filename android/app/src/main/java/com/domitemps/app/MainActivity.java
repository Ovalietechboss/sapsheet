package com.domitemps.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * A partir du targetSdk 35, Android impose l'edge-to-edge : la WebView dessine
     * SOUS la barre d'etat. Les icones systeme restant claires par defaut, l'heure,
     * la batterie et le reseau devenaient invisibles sur le fond blanc de l'app —
     * bande relevee a 98,7 % de blanc pur sur une capture Pixel 9a le 01/09/2026.
     *
     * Ni l'attribut de theme android:windowLightStatusBar ni un appel dans
     * onCreate() ne tiennent : le pont Capacitor reconfigure les barres systeme
     * une fois la fenetre attachee. On repose donc l'apparence a chaque passage au
     * premier plan, ce qui est le dernier mot.
     */
    private void barreEtatSombre() {
        WindowInsetsControllerCompat controleur =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controleur.setAppearanceLightStatusBars(true);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        barreEtatSombre();
    }

    @Override
    public void onResume() {
        super.onResume();
        // La WebView se peint apres onResume : on repasse derriere elle.
        getWindow().getDecorView().post(this::barreEtatSombre);
    }
}
