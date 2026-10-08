/**
 * FAC-15 — expéditeur email résolu côté serveur.
 *
 * Ce fichier est le premier test de l'Edge Function. Il porte sur les deux
 * propriétés qui comptent :
 *   1. l'adresse d'expédition est composée correctement dans les deux cas
 *      (professionnel avec son propre domaine, ou repli) ;
 *   2. un appel sans session est REFUSÉ — c'est ce qui empêche quiconque
 *      détient la clé publique du bundle web d'émettre sous l'identité d'un
 *      professionnel.
 *
 * L'import du module n'ouvre aucun serveur : `Deno.serve` est appelé derrière
 * un `typeof Deno !== 'undefined'`, faux sous Jest.
 */
import { buildFrom, extractAddress, sanitizeSenderName, handler } from '../index';

const FALLBACK = 'Bigorre Aide <facture@bigorre-aide.fr>';

describe('sanitizeSenderName', () => {
  it('laisse passer un nom normal', () => {
    expect(sanitizeSenderName('Catherine SOUMDEDOUYE-LACOSTE')).toBe('Catherine SOUMDEDOUYE-LACOSTE');
  });

  it("retire ce qui casserait l'en-tête from", () => {
    expect(sanitizeSenderName('Jean <pirate@ailleurs.fr>')).toBe('Jean pirate@ailleurs.fr');
    expect(sanitizeSenderName('A"B,C;D')).toBe('A B C D');
  });

  it('neutralise une tentative d\'injection par saut de ligne', () => {
    const out = sanitizeSenderName('Jean\r\nBcc: tout@le-monde.fr');
    expect(out).not.toMatch(/[\r\n]/);
    expect(out).toBe('Jean Bcc: tout@le-monde.fr');
  });

  it('tolère vide et nul', () => {
    expect(sanitizeSenderName(undefined)).toBe('');
    expect(sanitizeSenderName(null)).toBe('');
    expect(sanitizeSenderName('   ')).toBe('');
  });

  it('borne la longueur', () => {
    expect(sanitizeSenderName('x'.repeat(200))).toHaveLength(78);
  });
});

describe('extractAddress', () => {
  it('extrait l\'adresse d\'un from complet', () => {
    expect(extractAddress(FALLBACK)).toBe('facture@bigorre-aide.fr');
  });

  it('rend une adresse nue telle quelle', () => {
    expect(extractAddress('facture@bigorre-aide.fr')).toBe('facture@bigorre-aide.fr');
  });
});

describe('buildFrom', () => {
  it('utilise l\'adresse du professionnel quand il en a une', () => {
    expect(buildFrom({ name: 'Bigorre Aide', email: 'facture@bigorre-aide.fr' }, FALLBACK))
      .toBe('Bigorre Aide <facture@bigorre-aide.fr>');
  });

  it('garde l\'adresse de repli mais sous le nom du professionnel', () => {
    // Cas du deuxième utilisateur : pas de domaine à lui, donc pas d'adresse
    // d'expédition possible — mais son nom et ses réponses sont les siens.
    expect(buildFrom({ name: 'Jean DUPONT', email: null }, FALLBACK))
      .toBe('Jean DUPONT <facture@bigorre-aide.fr>');
  });

  it('rend le repli INCHANGÉ quand aucun nom n\'est connu', () => {
    // Garantie de non-régression : comportement d'avant FAC-15 à l'identique.
    expect(buildFrom({}, FALLBACK)).toBe(FALLBACK);
    expect(buildFrom({ name: '  ', email: '' }, FALLBACK)).toBe(FALLBACK);
  });

  it('se passe du nom si seule l\'adresse est connue', () => {
    expect(buildFrom({ email: 'moi@chezmoi.fr' }, FALLBACK)).toBe('moi@chezmoi.fr');
  });

  it('ne laisse pas un nom détourner l\'adresse d\'expédition', () => {
    const from = buildFrom({ name: 'Jean <pirate@ailleurs.fr>', email: null }, FALLBACK);
    expect(from).toBe('Jean pirate@ailleurs.fr <facture@bigorre-aide.fr>');
    expect(extractAddress(from)).toBe('facture@bigorre-aide.fr');
  });
});

describe('handler — envoi nominal', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, RESEND_API_KEY: 're_test', INVOICE_FROM_EMAIL: FALLBACK };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  /** Enchaîne les trois appels réseau de la fonction : auth, profil, Resend. */
  function mockRoundTrip(profile: Record<string, unknown>, authEmail = 'connexion@exemple.fr') {
    return jest.spyOn(globalThis, 'fetch' as never).mockImplementation((async (url: string) => {
      if (String(url).includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: 'uid-1', email: authEmail }) };
      }
      if (String(url).includes('/rest/v1/users')) {
        return { ok: true, json: async () => [profile] };
      }
      return { ok: true, json: async () => ({ id: 'resend-1' }) };
    }) as never);
  }

  const send = (fetchMock: jest.SpyInstance) => {
    const resendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('api.resend.com'));
    return JSON.parse((resendCall?.[1] as { body: string }).body);
  };

  const req = {
    method: 'POST',
    headers: { get: (k: string) => (k === 'Authorization' ? 'Bearer jwt' : 'cle') },
    json: async () => ({ to: 'mandataire@asso.fr', pdfBase64: 'JVBERi0=', subject: 'Facture 2026-001' }),
  } as unknown as Request;

  it("répond à l'adresse de CONTACT du profil, pas à celle du compte", async () => {
    // Les deux diffèrent dès que le professionnel modifie son email au profil.
    // C'est l'adresse du profil qui est imprimée sur la facture : une réponse
    // doit arriver là où le document dit d'écrire.
    const fetchMock = mockRoundTrip(
      { email: 'contact@bigorre-aide.fr', business_name: 'Bigorre Aide', invoice_from_email: 'facture@bigorre-aide.fr' },
      'connexion@exemple.fr',
    );

    const res = await handler(req);
    expect(res.status).toBe(200);

    const body = send(fetchMock);
    expect(body.reply_to).toBe('contact@bigorre-aide.fr');
    expect(body.from).toBe('Bigorre Aide <facture@bigorre-aide.fr>');
    // La copie d'archive suit la même adresse.
    expect(body.bcc).toEqual(['contact@bigorre-aide.fr']);
  });

  it("retombe sur l'email de connexion si le profil n'en porte pas", async () => {
    const fetchMock = mockRoundTrip({ display_name: 'DUPONT', first_name: 'Jean' }, 'jean@orange.fr');

    await handler(req);

    const body = send(fetchMock);
    expect(body.reply_to).toBe('jean@orange.fr');
    // Pas de domaine à lui : adresse commune, mais sous son nom.
    expect(body.from).toBe('Jean DUPONT <facture@bigorre-aide.fr>');
  });
});

describe('handler — refus des appels sans session', () => {
  const req = (headers: Record<string, string>, body: unknown = {}) => ({
    method: 'POST',
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  }) as unknown as Request;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuse un appel sans en-tête Authorization', async () => {
    const res = await handler(req({}));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Envoi réservé à un professionnel connecté (session absente).',
    });
  });

  it('refuse un jeton qui ne désigne pas un utilisateur (clé publique seule)', async () => {
    // C'est exactement le cas de la clé publique embarquée dans le bundle web :
    // l'en-tête est présent, mais /auth/v1/user ne renvoie aucun utilisateur.
    const fetchMock = jest.spyOn(globalThis, 'fetch' as never)
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as never);

    const res = await handler(req({ Authorization: 'Bearer sb_publishable_xxx' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Session invalide ou expirée : reconnectez-vous puis réessayez.',
    });
    // Aucun appel à Resend n'a été tenté.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('api.resend.com'))).toBe(false);
  });

  it('transmet l\'apikey de l\'appelant à la passerelle', async () => {
    // Sans cet en-tête la passerelle répond « No API key found » : l'identité
    // serait introuvable et plus aucun email ne partirait.
    const fetchMock = jest.spyOn(globalThis, 'fetch' as never)
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) } as never);

    await handler(req({ Authorization: 'Bearer jwt-utilisateur', apikey: 'cle-publique' }));

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.apikey).toBe('cle-publique');
    expect(init.headers.Authorization).toBe('Bearer jwt-utilisateur');
  });

  it('ne consulte jamais le corps de la requête avant d\'avoir identifié l\'appelant', async () => {
    // Si `from` pouvait venir du corps, ce test n'aurait pas de sens : il
    // verrouille le fait que l'identité est résolue AVANT toute lecture.
    const json = jest.fn();
    const res = await handler({
      method: 'POST',
      headers: { get: () => null },
      json,
    } as unknown as Request);

    expect(res.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
  });
});
