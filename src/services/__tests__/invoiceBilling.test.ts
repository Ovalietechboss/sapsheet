import { editableInvoiceOf, billableTimesheetsOf, BillableInvoice } from '../invoiceBilling';

const facture = (over: Partial<BillableInvoice> = {}): BillableInvoice => ({
  id: 'inv_1', status: 'draft', sent_at: null, paid_at: null, credit_of: null, ...over,
});

const pointage = (id: string, invoice_id: string | null = null) => ({ id, invoice_id });

describe('editableInvoiceOf — ce qu on s autorise a reecrire', () => {
  it('reecrit un brouillon jamais transmis', () => {
    const b = facture({ id: 'brouillon' });
    expect(editableInvoiceOf([b])?.id).toBe('brouillon');
  });

  it('ne reecrit JAMAIS une facture payee (incident octobre 2026)', () => {
    const payee = facture({ id: 'payee', status: 'paid', paid_at: 1_700_000_000_000 });
    expect(editableInvoiceOf([payee])).toBeNull();
  });

  it('ne reecrit pas une facture envoyee, meme restee en statut brouillon', () => {
    // Cas reel : le PDF est parti par email, le statut n a pas ete bascule a la main.
    // `sent_at` fait foi, pas `status`.
    const envoyee = facture({ id: 'envoyee', status: 'draft', sent_at: 1_700_000_000_000 });
    expect(editableInvoiceOf([envoyee])).toBeNull();
  });

  it('ne reecrit pas un avoir', () => {
    const avoir = facture({ id: 'avoir', credit_of: '2026-001' });
    expect(editableInvoiceOf([avoir])).toBeNull();
  });

  it('trouve le brouillon au milieu de factures deja emises', () => {
    const r = editableInvoiceOf([
      facture({ id: 'payee', status: 'paid', paid_at: 1 }),
      facture({ id: 'brouillon' }),
    ]);
    expect(r?.id).toBe('brouillon');
  });
});

describe('billableTimesheetsOf — ce que porte la prochaine facture', () => {
  it('prend les pointages encore libres', () => {
    const cts = [pointage('a'), pointage('b')];
    expect(billableTimesheetsOf(cts, null).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('ecarte les pointages deja portes par une facture emise', () => {
    const cts = [pointage('deja_facture', 'inv_payee'), pointage('libre')];
    expect(billableTimesheetsOf(cts, null).map((t) => t.id)).toEqual(['libre']);
  });

  it('reprend les pointages du brouillon en cours quand on le regenere', () => {
    const brouillon = facture({ id: 'inv_draft' });
    const cts = [pointage('du_brouillon', 'inv_draft'), pointage('libre')];
    expect(billableTimesheetsOf(cts, brouillon).map((t) => t.id))
      .toEqual(['du_brouillon', 'libre']);
  });

  it('ne rend rien quand tout le mois est deja facture', () => {
    const cts = [pointage('a', 'inv_payee'), pointage('b', 'inv_payee')];
    expect(billableTimesheetsOf(cts, null)).toEqual([]);
  });
});

describe('Non-regression : le scenario exact d octobre 2026', () => {
  // 06/10 : une facture est emise en avance sur un seul pointage (2 h + IK), envoyee,
  // puis payee. Fin octobre, le reste du mois doit etre facture — sans toucher a la
  // premiere facture, et sans refacturer les 2 h deja reglees.
  const payeeDu6 = facture({
    id: 'inv_avance', status: 'paid', sent_at: 1_696_550_000_000, paid_at: 1_696_900_000_000,
  });
  const moisComplet = [
    pointage('ts_01_10', 'inv_avance'), // les 2 h deja facturees ET payees
    pointage('ts_08_10'),
    pointage('ts_15_10'),
    pointage('ts_22_10'),
  ];

  it('la facture payee n est pas proposee a la reecriture', () => {
    expect(editableInvoiceOf([payeeDu6])).toBeNull();
  });

  it('la facture de fin de mois ne reprend pas le pointage deja paye', () => {
    const aFacturer = billableTimesheetsOf(moisComplet, editableInvoiceOf([payeeDu6]));
    expect(aFacturer.map((t) => t.id)).toEqual(['ts_08_10', 'ts_15_10', 'ts_22_10']);
    expect(aFacturer.map((t) => t.id)).not.toContain('ts_01_10');
  });

  it('une fois le solde facture, il ne reste plus rien a facturer', () => {
    const solde = facture({ id: 'inv_solde', status: 'sent', sent_at: 1_698_000_000_000 });
    const apres = moisComplet.map((t) =>
      t.invoice_id ? t : { ...t, invoice_id: 'inv_solde' });
    expect(billableTimesheetsOf(apres, editableInvoiceOf([payeeDu6, solde]))).toEqual([]);
  });
});
