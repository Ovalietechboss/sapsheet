-- CONTROLE D'INTEGRITE DE LA FACTURATION — a lancer quand on veut, LECTURE SEULE.
--
-- Pourquoi ce fichier : entre le 05/11 et le 11/11/2026, trois defauts ont vecu en
-- production sans que rien ne les signale — une facture payee reecrite, un numero
-- emis en double, et 44 mois dont les factures ne portaient aucun pointage. Les 154
-- tests unitaires passaient : ils verifient le CODE sur des donnees inventees, jamais
-- la BASE sur des donnees reelles. Ce fichier comble ce trou.
--
-- A lancer : apres toute migration, apres toute reprise de donnees, et en routine.
-- Tout doit afficher « OK ». Une seule requete, car l'editeur SQL de Supabase
-- n'affiche que le resultat du DERNIER statement.

SELECT 'A. numeros en doublon' AS controle,
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' !!!' END AS verdict,
       coalesce(string_agg(invoice_number, ', '), '-') AS detail
FROM (SELECT invoice_number FROM invoices
      GROUP BY user_id, invoice_number HAVING count(*) > 1) a

UNION ALL
SELECT 'B. sequence annuelle utilisee 2 fois',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' a documenter' END,
       coalesce(string_agg(annee || '-' || seq, ', '), '-')
FROM (SELECT left(invoice_number, 4) AS annee,
             substring(invoice_number from '^[0-9]{4}-([0-9]+)') AS seq
      FROM invoices WHERE invoice_number ~ '^[0-9]{4}-[0-9]+' AND credit_of IS NULL
      GROUP BY 1, 2 HAVING count(*) > 1) b

UNION ALL
-- Le defaut du 11/11 : une facture qui ne porte pas ses pointages fait reapparaitre
-- un mois deja regle dans le « reste a facturer », et le bouton propose de refacturer.
SELECT 'C. factures sans pointage, mois non vide',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' !!!' END,
       coalesce(string_agg(invoice_number, ', '), '-')
FROM (SELECT i.invoice_number
      FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE c.facturation_mode = 'CLASSICAL' AND i.credit_of IS NULL
        AND NOT EXISTS (SELECT 1 FROM timesheets x WHERE x.invoice_id = i.id)
        AND EXISTS (SELECT 1 FROM timesheets t
                    WHERE t.client_id = i.client_id AND t.invoice_id IS NULL
                      AND to_char(to_timestamp(t.date_arrival/1000) AT TIME ZONE 'Europe/Paris','YYYY-MM')
                          = i.year || '-' || lpad(i.month::text, 2, '0'))) c

UNION ALL
-- Le defaut du 05/11 : le total et le detail figé divergent.
SELECT 'D. total <> somme des lignes figees',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' !!!' END,
       coalesce(string_agg(invoice_number, ', '), '-')
FROM (SELECT i.invoice_number FROM invoices i,
             LATERAL (SELECT round(sum((l->>'quantity')::numeric * (l->>'unit_price')::numeric), 2) AS s
                      FROM jsonb_array_elements(i.lines) l) x
      WHERE i.lines IS NOT NULL AND abs(x.s - i.total_amount::numeric) >= 0.01) d

UNION ALL
-- Le defaut du 09/11 : un pointage retouche APRES que sa facture soit partie.
--
-- PORTEE LIMITEE, a savoir : ce controle n'est qu'un RATTRAPAGE pour la periode ou
-- rien ne protegeait les factures. La vraie protection est ailleurs : le controle D
-- (le total doit egaler le detail fige a l'emission) et le refus, dans l'app, de
-- modifier un pointage porte par une facture transmise (TimesheetsTab/refuserSiFige).
--
-- Les trois horodatages exclus sont des REPARATIONS faites en SQL le 11/11/2026, pas
-- des retouches metier. Verifie un par un ce jour-la : les pointages concernes valent
-- exactement le montant de leur facture.
--   09:04:10 (1) reparation Leconte : IK restaurees + rattachement du 01/10
--   20:38:34 (1) reparation Favreau : rattachement du 01/10 a la facture payee
--   20:48:46 (56) reprise generale des rattachements (115 pointages, 44 factures)
--
-- LECON : une reprise technique ne doit JAMAIS ecrire `updated_at`. Ce champ sert de
-- preuve metier ; en l'horodatant, la reprise du 11/11 a aveugle ce controle sur tout
-- l'historique anterieur. Les vraies valeurs restent dans la sauvegarde du 11/11 03:17 UTC.
SELECT 'E. pointage modifie apres transmission',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' a verifier' END,
       coalesce(string_agg(DISTINCT invoice_number, ', '), '-')
FROM (SELECT i.invoice_number FROM timesheets t JOIN invoices i ON i.id = t.invoice_id
      WHERE i.sent_at IS NOT NULL AND t.updated_at > i.sent_at + 60000
        AND to_char(to_timestamp(t.updated_at/1000) AT TIME ZONE 'Europe/Paris',
                    'YYYY-MM-DD HH24:MI:SS')
            NOT IN ('2026-11-11 09:04:10', '2026-11-11 20:38:34', '2026-11-11 20:48:46')) e

UNION ALL
-- Informatif : un mois a plusieurs factures est LEGITIME (acompte + solde).
-- Mais ces mois sont exclus de toute reprise automatique : rattachement arbitraire.
SELECT 'F. mois a plusieurs factures (info)',
       CASE WHEN count(*) = 0 THEN 'aucun' ELSE count(*) || ' (normal si acompte+solde)' END,
       coalesce(string_agg(mois, ', '), '-')
FROM (SELECT i.client_id || ' ' || i.year || '-' || lpad(i.month::text, 2, '0') AS mois
      FROM invoices i WHERE i.credit_of IS NULL
      GROUP BY i.client_id, i.year, i.month HAVING count(*) > 1) f

UNION ALL
-- Un pointage ne peut pas etre porte par la facture d'un autre client.
SELECT 'G. pointage rattache au mauvais client',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE count(*) || ' !!!' END,
       coalesce(string_agg(id, ', '), '-')
FROM (SELECT t.id FROM timesheets t JOIN invoices i ON i.id = t.invoice_id
      WHERE i.client_id <> t.client_id) g

ORDER BY 1;
