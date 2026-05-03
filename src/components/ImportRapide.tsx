import React, { useState } from 'react';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import ClientCombobox from './ClientCombobox';

const inputStyle: React.CSSProperties = {
  padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
};

interface Row {
  date: string;
  time_arrival: string;
  time_departure: string;
  direct_hours: string;
  ik_km: number;
  notes: string;
}

interface ClientBlock {
  client_id: string;
  description: string;
  ik_rate: number;
  rows: Row[];
}

const emptyRow = (): Row => ({ date: '', time_arrival: '', time_departure: '', direct_hours: '', ik_km: 0, notes: '' });

const DEFAULT_IK_RATE = 0.603;

interface Props {
  onClose: () => void;
}

export default function ImportRapide({ onClose }: Props) {
  const { addTimesheet } = useTimesheetStore();
  const { clients } = useClientStore();
  const [blocks, setBlocks] = useState<ClientBlock[]>([{
    client_id: '', description: 'Assistance à domicile', ik_rate: DEFAULT_IK_RATE, rows: [emptyRow()],
  }]);
  const [saisieMode, setSaisieMode] = useState<'horaires' | 'duree'>('duree');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const updateBlock = (bi: number, updates: Partial<ClientBlock>) => {
    setBlocks(blocks.map((b, i) => i === bi ? { ...b, ...updates } : b));
  };

  const updateRow = (bi: number, ri: number, updates: Partial<Row>) => {
    setBlocks(blocks.map((b, i) => i === bi ? {
      ...b,
      rows: b.rows.map((r, j) => j === ri ? { ...r, ...updates } : r),
    } : b));
  };

  const addRow = (bi: number) => {
    setBlocks(blocks.map((b, i) => i === bi ? { ...b, rows: [...b.rows, emptyRow()] } : b));
  };

  const removeRow = (bi: number, ri: number) => {
    setBlocks(blocks.map((b, i) => i === bi ? { ...b, rows: b.rows.filter((_, j) => j !== ri) } : b));
  };

  const addBlock = () => {
    setBlocks([...blocks, { client_id: '', description: 'Assistance à domicile', ik_rate: DEFAULT_IK_RATE, rows: [emptyRow()] }]);
  };

  const removeBlock = (bi: number) => {
    setBlocks(blocks.filter((_, i) => i !== bi));
  };

  const isRowValid = (r: Row): boolean => {
    if (!r.date) return false;
    if (saisieMode === 'duree') {
      const h = parseFloat(r.direct_hours);
      return !isNaN(h) && h > 0;
    }
    return !!r.time_arrival && !!r.time_departure;
  };

  const validCount = blocks.reduce((s, b) => {
    if (!b.client_id) return s;
    return s + b.rows.filter(isRowValid).length;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    let created = 0;
    let errors = 0;
    try {
      for (const block of blocks) {
        if (!block.client_id) continue;
        for (const row of block.rows) {
          if (!isRowValid(row)) continue;
          try {
            let arrival: number, departure: number, duration: number;
            if (saisieMode === 'duree') {
              duration = Math.round(parseFloat(row.direct_hours) * 100) / 100;
              arrival = new Date(`${row.date}T09:00`).getTime();
              departure = arrival + duration * 3600000;
            } else {
              arrival = new Date(`${row.date}T${row.time_arrival}`).getTime();
              departure = new Date(`${row.date}T${row.time_departure}`).getTime();
              duration = Math.round(((departure - arrival) / (1000 * 60 * 60)) * 100) / 100;
              if (duration <= 0) { errors++; continue; }
            }
            const ikKm = Math.max(0, row.ik_km || 0);
            const ikAmount = Math.round(ikKm * block.ik_rate * 100) / 100;
            await addTimesheet({
              client_id: block.client_id,
              date_arrival: arrival,
              date_departure: departure,
              duration,
              frais_repas: 0,
              frais_transport: 0,
              frais_autres: 0,
              ik_km: ikKm,
              ik_rate: block.ik_rate,
              ik_amount: ikAmount,
              description: block.description || undefined,
              notes: row.notes || undefined,
            });
            created++;
          } catch (err: any) {
            console.error('[ImportRapide] Erreur pointage:', err?.message || err);
            errors++;
          }
        }
      }
      setResult(`${created} pointage${created > 1 ? 's' : ''} créé${created > 1 ? 's' : ''}${errors > 0 ? ` (${errors} erreur${errors > 1 ? 's' : ''} — vérifiez la console F12)` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const getClientLabel = (c: typeof clients[0]) =>
    [c.titre, c.first_name, c.name].filter(Boolean).join(' ');

  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ marginBottom: '8px' }}>{result}</h2>
        <p style={{ color: '#666', marginBottom: '24px' }}>Les pointages sont visibles dans l'onglet Pointages.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '12px 24px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            Fermer
          </button>
          <button onClick={() => { setResult(null); setBlocks([{ client_id: '', description: 'Assistance à domicile', ik_rate: DEFAULT_IK_RATE, rows: [emptyRow()] }]); }}
            style={{ padding: '12px 24px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
            Nouvelle saisie
          </button>
        </div>
      </div>
    );
  }

  const gridCols = saisieMode === 'duree'
    ? '130px 100px 70px 1fr 36px'
    : '130px 90px 90px 70px 1fr 36px';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Saisie rapide</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>Ajoutez plusieurs pointages d'un coup</p>
        </div>
        <button onClick={onClose} style={{ padding: '8px 16px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Retour
        </button>
      </div>

      {/* Toggle mode de saisie */}
      <div style={{ display: 'flex', backgroundColor: '#f0f2f5', borderRadius: '8px', padding: '3px', marginBottom: '20px', maxWidth: '320px' }}>
        {[
          { id: 'duree' as const, label: 'Durée directe' },
          { id: 'horaires' as const, label: 'Heures début/fin' },
        ].map((m) => (
          <button key={m.id} type="button" onClick={() => setSaisieMode(m.id)}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              backgroundColor: saisieMode === m.id ? 'white' : 'transparent',
              color: saisieMode === m.id ? '#007AFF' : '#888',
              boxShadow: saisieMode === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {blocks.map((block, bi) => (
        <div key={bi} style={{ marginBottom: '20px', border: '1px solid #ddd', borderRadius: '10px', overflow: 'hidden' }}>
          {/* En-tête du bloc */}
          <div style={{ background: '#f9f9f9', padding: '14px 16px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Client *</label>
              <ClientCombobox
                clients={clients}
                value={block.client_id}
                onChange={(id) => updateBlock(bi, { client_id: id })}
                inputStyle={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Prestation</label>
              <input type="text" value={block.description} onChange={(e) => updateBlock(bi, { description: e.target.value })}
                placeholder="Assistance à domicile" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={{ width: '100px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Tarif IK/km</label>
              <input type="number" step="0.001" value={block.ik_rate} onChange={(e) => updateBlock(bi, { ik_rate: parseFloat(e.target.value) || 0 })}
                style={{ ...inputStyle, width: '100%' }} />
            </div>
            {blocks.length > 1 && (
              <button onClick={() => removeBlock(bi)} style={{ padding: '8px 12px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                Supprimer
              </button>
            )}
          </div>

          {/* Lignes */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>DATE</span>
              {saisieMode === 'duree' ? (
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>HEURES</span>
              ) : (
                <>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>ARRIVÉE</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>DÉPART</span>
                </>
              )}
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>IK km</span>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>NOTES</span>
              <span></span>
            </div>
            {block.rows.map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '6px' }}>
                <input type="date" value={row.date} onChange={(e) => updateRow(bi, ri, { date: e.target.value })} style={inputStyle} />
                {saisieMode === 'duree' ? (
                  <input type="number" step="0.25" value={row.direct_hours}
                    onChange={(e) => updateRow(bi, ri, { direct_hours: e.target.value })}
                    placeholder="Ex: 2.5" style={{ ...inputStyle, fontWeight: 'bold', color: '#007AFF' }} />
                ) : (
                  <>
                    <input type="time" value={row.time_arrival} onChange={(e) => updateRow(bi, ri, { time_arrival: e.target.value })} style={inputStyle} />
                    <input type="time" value={row.time_departure} onChange={(e) => updateRow(bi, ri, { time_departure: e.target.value })} style={inputStyle} />
                  </>
                )}
                <input type="number" value={row.ik_km} onChange={(e) => updateRow(bi, ri, { ik_km: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                <input type="text" value={row.notes} onChange={(e) => updateRow(bi, ri, { notes: e.target.value })} placeholder="" style={inputStyle} />
                <button onClick={() => removeRow(bi, ri)} disabled={block.rows.length <= 1}
                  style={{ padding: '4px', backgroundColor: block.rows.length <= 1 ? '#eee' : '#ff3b3022', color: '#ff3b30', border: 'none', borderRadius: '6px', cursor: block.rows.length <= 1 ? 'default' : 'pointer', fontSize: '16px' }}>
                  ×
                </button>
              </div>
            ))}
            <button onClick={() => addRow(bi)}
              style={{ padding: '6px 14px', background: 'white', border: '1px dashed #007AFF', borderRadius: '6px', color: '#007AFF', cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginTop: '4px' }}>
              + Ajouter une ligne
            </button>
          </div>
        </div>
      ))}

      <button onClick={addBlock}
        style={{ width: '100%', padding: '12px', background: 'white', border: '2px dashed #34C759', borderRadius: '10px', color: '#34C759', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginBottom: '24px' }}>
        + Ajouter un autre client
      </button>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '12px 24px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving || validCount === 0}
          style={{ padding: '12px 24px', backgroundColor: saving || validCount === 0 ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: saving || validCount === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
          {saving ? 'Enregistrement...' : `Tout enregistrer (${validCount} pointage${validCount > 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}
