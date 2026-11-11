# Flow de facturation — DomiTemps

> **Document de référence.** Extrait du code le 2026-11-11, pas inventé : chaque règle
> énoncée ici est tracée vers le fichier qui l'applique. Une story se vérifie contre ce
> document ; si le code et lui divergent, l'un des deux est un défaut.

## Pourquoi ce document existe

`invoiceNumbering.ts:2` cite « l'arbitrage #4 du brief ». **Ce brief n'existe nulle part** —
ni dans le dépôt, ni dans `docs/`. C'était une conversation, elle est perdue, et les
arbitrages #1, #2, #3 et #5 avec elle.

Conséquence mesurée : entre le 2026-11-05 et le 2026-11-11, les règles de facturation
vivaient éparpillées en commentaires dans **sept fichiers**, chacun n'en connaissant qu'un
morceau. Trois régressions en sont sorties, dont une facture payée écrasée et un numéro
émis en double chez un client. Personne n'avait la vue d'ensemble.

## 1. Deux natures de document, et c'est la clé de tout

L'application produit **deux documents qui n'ont rien en commun**, et presque toutes les
confusions viennent de les traiter pareil.

| | Relevé CESU | Facture classique |
|---|---|---|
| Nature | Récapitulatif **vivant** du mois | **Pièce comptable figée** |
| Nombre par mois | Toujours **un seul** | **Un ou plusieurs** (avance + solde) |
| Numéro | `CESU-AAAA-MM-NOMCLIENT` — une clé, pas un numéro | `AAAA-NNN` — série annuelle continue |
| Régénération | Toujours permise, il se recalcule | Interdite dès qu'il est transmis |
| Détail figé | Non, il n'a rien à figer | Oui, dans `invoices.lines` |
| État stocké dans | `billing_period_clients` | `invoices` |
| S'envoie depuis | Onglet **Bilans** | Onglet **Factures** |
| Correction | Régénérer | **Avoir** `AV-AAAA-NNN` |

Le relevé CESU n'est pas une facture : c'est un état de pointages envoyé au mandataire
**pour validation avant paiement**. Le rémunérateur, c'est le CESU.

## 2. Cycle de vie d'une facture

```
   Bilans « Facture » / « Facturer le reste »
   Bilans « Facture société » (lignes libres)
                   |
                   v
             [ draft ] ---- envoi email, ou « Remis » ----> [ sent ]
            brouillon <--- retour arrière (sélecteur) -----  transmise
                                                               |
                                                  encaissement (date DEMANDÉE)
                                                               v
                                                           [ paid ]  payée
                                                               |
                                        correction ----> AVOIR AV-AAAA-NNN
                                                    (jamais une retouche)
```

**Ce qui fait foi, ce n'est pas `status` mais `sent_at`.** `status` peut être basculé à la
main dans le sélecteur de l'onglet Factures sans qu'aucun email ne soit parti — c'est
exactement ce qui a fait dire « envoyée » à une facture jamais transmise le 2026-11-10.
L'écran Bilans lit donc `sent_at`, jamais `status` (`BilansTab.tsx:174`).

**Un mois n'est pas un document.** Depuis qu'un mois peut porter plusieurs factures,
afficher l'état de la plus récente est un mensonge. La règle est dans `monthDocState`
(`invoiceBilling.ts`) : le mois n'est « envoyé » que lorsque **plus rien n'attend** — aucune
heure à facturer, et aucune facture non transmise.

## 3. Les invariants

Chacun est né d'un incident réel. Les casser, c'est rejouer l'incident.

1. **Un numéro de facture est unique.** Garanti par la base depuis le 2026-11-11 :
   index `uniq_invoices_user_number` sur `(user_id, invoice_number)`. Avant, la garantie
   reposait sur le code du navigateur — c'est-à-dire sur rien dès qu'un onglet servait une
   version périmée.
2. **La série est annuelle, continue et gap-safe.** Prochain numéro = `max + 1`, jamais
   `count + 1` (`invoiceNumbering.ts`). Les numéros de **reprise** s'écrivent
   `AAAA-NNN (ancien numéro)` et comptent dans la série : les ignorer a fait repartir la
   numérotation à 001 et envoyé `2026-002` chez un client alors que
   `2026-002 (FAC-2026-03-PLET)` existait déjà.
3. **Une facture transmise ou encaissée n'est JAMAIS réécrite.** Seul un brouillon jamais
   transmis et jamais encaissé est modifiable (`editableInvoiceOf`). Tout le reste empile
   une facture de plus. Sans ce garde-fou, une facture payée le 14/10 a été écrasée le
   05/11 par le montant du mois entier.
4. **Une facture fige son détail à l'émission** dans `invoices.lines`, et **son total EST la
   somme de ses lignes** (`invoiceSnapshot.ts`). Tant qu'une facture n'est qu'une vue
   recalculée sur les pointages, modifier un pointage réécrit rétroactivement un document
   déjà encaissé — arrivé le 09/11 sur une facture payée le 14/10.
5. **Un pointage n'appartient qu'à une facture** (`timesheets.invoice_id`). C'est ce qui
   permet plusieurs factures dans un mois sans jamais recompter les mêmes heures.
6. **Un pointage porté par une facture transmise ou payée ne se modifie plus**, ne se
   supprime plus, ne repasse plus en brouillon (`TimesheetsTab`, `refuserSiFige`).
7. **Un avoir TOTAL libère les pointages** ; un avoir **PARTIEL** ne libère rien — c'est une
   correction de montant, la prestation reste facturée, sinon elle repartirait en double le
   mois suivant.
8. **La date d'encaissement est demandée, jamais devinée.** C'est son mois qui range la
   recette dans le relevé URSSAF trimestriel.
9. **Aucun envoi pendant une usurpation de compte** : l'expéditeur est résolu côté serveur
   depuis la session, qui reste celle de l'administrateur.

## 4. La carte : où un document naît, où il part

**Quatre points de création** — c'est déjà trop, et c'est la racine du problème.

| # | Où | Quoi | Lignes figées | Imputation |
|---|---|---|---|---|
| 1 | `BilansTab.handleGenerate` | Facture depuis les pointages | oui | oui |
| 2 | `BilansTab.handleGenerateSociete` | Facture société, lignes libres | oui | sans objet |
| 3 | `InvoicesTab.handleCreateCredit` | Avoir | oui | libère si total |
| 4 | `InvoicesTab.handleGenerateInvoice` | **CODE MORT** (voir D7) | non | non |

**Deux points d'envoi**, et ils n'écrivent pas au même endroit :

- `BilansTab.sendCesuEmail` écrit `billing_period_clients` (CESU seulement) ;
- `InvoicesTab.sendInvoiceEmail` écrit `invoices.sent_at` (factures et avoirs).

Les deux passent par la même Edge Function `send-invoice` (Resend), générique.
Règle de destinataire identique : **mandataire** d'abord, sinon email du client, sinon
premier contact supplémentaire ; les autres contacts en copie. `replyTo` = email du
professionnel qui envoie.

## 5. Le défaut structurel : deux sources de vérité

L'état d'un document vit dans **deux tables selon le mode**, et c'est assumé dans le code
(`BilansTab.tsx:171`) :

- CESU vers `billing_period_clients.status / sent_at / sent_channel`
- CLASSIQUE vers `invoices.status / sent_at / sent_channel`

**Conséquence visible pour l'utilisateur** : sur l'écran Bilans, le bouton d'envoi n'existe
que pour le CESU (`BilansTab.tsx:1169`). Une facture classique s'affiche avec son badge et
sa date, mais doit être envoyée depuis l'onglet Factures. Le suivi et l'action sont à deux
endroits différents.

La décision du 2026-08-31 était de **ne pas** envoyer les factures classiques depuis Bilans,
au motif que deux points d'envoi feraient diverger le suivi. **Cet argument ne tient plus
depuis le 2026-11-05** : une facture est désormais une pièce avec son état propre, que
Bilans lit déjà. La bonne réponse n'est pas d'interdire l'envoi, c'est d'**extraire l'envoi
dans un service unique** appelé par les deux onglets — un seul chemin de code, donc un seul
suivi. C'est le point **P1** du LOP.

## 6. Défauts trouvés pendant l'extraction (2026-11-11)

Aucun n'était connu avant cette lecture. Ils ne sont **pas corrigés** : ils sont décrits
ici pour être arbitrés.

| # | Où | Défaut | Gravité |
|---|---|---|---|
| D1 | `InvoicesTab.buildInvoiceHtml` | Le PDF réimprimé est reconstruit depuis **tous les pointages du mois** (filtre client+année+mois), sans regarder `invoice_id`. Sur un mois à deux factures, une facture sans `lines` réimprime le mois entier. Le taux horaire utilisé est le taux **ACTUEL** du client, pas celui de l'époque. | 🔴 élevée |
| D2 | `billingPeriodStore.upsertClientStatus` | Le chemin INSERT omet `sent_channel` : à la **première** transmission d'un client CESU, le canal est perdu, et le badge affiche « envoyé par email » même pour une remise en main propre. | 🟠 moyenne |
| D3 | `InvoicesTab`, sélecteur de statut | Repasser une facture **payée** en brouillon écrit `paid_at: null` sans aucune confirmation : la date d'encaissement, base du relevé URSSAF, disparaît en un clic. | 🟠 moyenne |
| D4 | `BilansTab.marquerRemis` | Pour une facture classique, cible `row.invoiceId` = la facture **la plus récente** du mois. Sur un mois à plusieurs factures, « Remis » marque la mauvaise. | 🟠 moyenne |
| D5 | `invoiceStore.getInvoicesByMonth` | Filtre sur `created_at` au lieu des colonnes `year`/`month`. Une facture d'octobre créée en novembre est classée en novembre. | 🟡 faible |
| D6 | `timesheetStore.addTimesheet` | `id = timesheet_${now}` sans suffixe aléatoire. Le correctif appliqué aux factures (collision à la même milliseconde) n'a pas été reporté ici. | 🟡 faible |
| D7 | `InvoicesTab.handleGenerateInvoice` | **Code mort** : `setShowModal(true)` n'existe nulle part. Mais ce chemin crée une facture **sans lignes figées et sans imputation** — il rejouerait l'incident d'octobre si on le rebranchait. À supprimer. | 🟡 faible, à supprimer |

## 7. Registre des arbitrages

### Retrouvés et toujours en vigueur

| # | Arbitrage | Décidé | Trace |
|---|---|---|---|
| A4 | Série annuelle continue `AAAA-NNN` pour les factures | brief perdu | `invoiceNumbering.ts:2` |
| A6 | L'historique `FAC-AAAA-MM-NOM` est conservé tel quel, les deux formats cohabitent | PO, 2026-11-05 | `BilansTab.tsx:320` |
| A7 | Envoi limité au CESU depuis Bilans | 2026-08-31 | **CADUC** — voir §5 et P1 |
| A8 | Un email par client en envoi groupé CESU (le mandataire reçoit un dossier par bénéficiaire) | PO | `handleSendBulkCesu` |
| A9 | Le registre 2026 garde ses irrégularités héritées de l'import (020 manquant, 021 et 002 en double) ; on repart à 022 | PO, 2026-11-11 | LOP P2 |

### Perdus avec le brief — à retrancher

**A1, A2, A3, A5 : contenu inconnu.** À reconstituer avec le PO. Les questions qu'ils
couvraient probablement, et qui restent sans réponse écrite :

- Que devient une facture impayée au-delà de 30 jours ? L'écran la signale « EN RETARD »,
  mais aucune relance n'est prévue.
- Peut-on clôturer un mois (`lockPeriod`) s'il reste des heures non facturées ? Aujourd'hui
  oui, sans avertissement.
- Un client peut-il changer de mode (CESU vers CLASSIQUE) en cours d'année, et qu'advient-il
  des documents déjà émis ?
- Le taux horaire est-il historisé ? **Non** aujourd'hui : il est lu sur la fiche client au
  moment du calcul. C'est la cause de D1 et de deux faux écarts constatés le 2026-11-11.

## Contrôle

`supabase-controle-integrite.sql` vérifie en lecture seule que la base respecte les
invariants du §3. À lancer après toute migration et en routine. Tout doit afficher `OK`,
sauf **B** et **F** qui sont documentés comme acceptés (LOP P2).
