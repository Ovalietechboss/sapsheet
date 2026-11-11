# LOP — Liste des points ouverts (DomiTemps)

Toute remarque faite en seance est consignee ici **le jour meme**, numerotee, et relue au
debut de chaque session. Un point ne se ferme que lorsqu'il est livre ET verifie.

| # | Ouvert le | Point | Etat |
|---|---|---|---|
| P1 | 2026-11-11 | **Envoyer une facture CLASSIQUE depuis Bilans**, avec suivi de la date d'envoi, comme le ✉️ des releves CESU. Annule la decision d'archi du 31/08 (envoi limite au CESU). Voie retenue : **extraire l'envoi dans un service unique** appele par `BilansTab` ET `InvoicesTab`, pour n'avoir qu'un seul chemin qui ecrit `invoices.sent_at` / `status` / `sent_channel`. | ⏳ a faire apres la reparation Favreau |
| P2 | 2026-11-11 | **Registre 2026 irregulier, herite de l'import de reprise** : `2026-020` manquant, `2026-021` utilise deux fois (`(2600009)` et `(FAC-2026-05-MASSOC)`), et depuis le 10/11 `2026-001` + `2026-002` en doublon de sequence avec les entrees de reprise. Decision PO du 11/11 : on laisse, on repart a `2026-022`. A documenter pour le comptable. | 🟡 accepte, a documenter |
| P3 | 2026-11-11 | **Bandeau de version** (`GET /app/version`, comme DOMMS Comm) : un onglet reste ouvert sert l'ancien bundle apres un deploiement Vercel, ce qui a fabrique les doublons des 05/11 et 09/11. Palliatif actuel : exiger un Ctrl+Shift+R. | ⏳ a faire |
| P4 | 2026-09-03 | **`contact@bigorre-aide.fr` redirige vers la boite de Cathy** alors que les pages publiques en font le contact RGPD de l'EDITEUR. A dissocier avant d'ouvrir a d'autres utilisateurs. Meme sujet que l'editeur non nomme dans `public/confidentialite.html`. | ⏳ a faire |
| P5 | 2026-09-03 | **Fermer l'inscription libre ?** Choix PRODUIT : si DomiTemps reste sur invitation, on desactive la confirmation d'email et l'invite ne recoit plus qu'UN seul email au lieu de deux. | ⏳ arbitrage PO |
