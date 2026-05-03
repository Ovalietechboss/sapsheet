import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Client } from '../stores/clientStore.supabase';

interface Props {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  inputStyle?: React.CSSProperties;
}

const labelOf = (c: Client) => [c.titre, c.first_name, c.name].filter(Boolean).join(' ');

const defaultInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box', backgroundColor: 'white',
};

export default function ClientCombobox({
  clients, value, onChange,
  placeholder = 'Rechercher un client…',
  required, inputStyle,
}: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => clients.find((c) => c.id === value), [clients, value]);
  const selectedLabel = selectedClient ? labelOf(selectedClient) : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => labelOf(c).toLowerCase().includes(q));
  }, [clients, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const inputValue = isOpen ? query : selectedLabel;

  const mergedInputStyle: React.CSSProperties = {
    ...defaultInputStyle,
    ...inputStyle,
    backgroundColor: 'white',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => { setQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={selectedLabel ? '' : placeholder}
        required={required && !value}
        style={mergedInputStyle}
      />
      {value && !isOpen && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '18px', color: '#888', padding: '0 4px',
          }}
          aria-label="Effacer"
        >
          ×
        </button>
      )}
      {isOpen && (
        <ul
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
            background: 'white', border: '1px solid #ddd', borderRadius: '6px',
            maxHeight: '240px', overflowY: 'auto', zIndex: 100,
            listStyle: 'none', padding: '4px 0', margin: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '12px', color: '#888', fontSize: '13px', textAlign: 'center' }}>
              Aucun client
            </li>
          ) : filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c.id); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                  background: c.id === value ? '#E8F4FF' : 'transparent',
                  cursor: 'pointer', fontSize: '14px', color: '#333',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = c.id === value ? '#E8F4FF' : 'transparent')}
              >
                {labelOf(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
