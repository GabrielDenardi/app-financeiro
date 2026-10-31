import {
  buildAlreadySubscribedEmail,
  buildConfirmationEmail,
  buildUpdateEmail,
  createResendSender,
  escapeHtml,
  handleConfirm,
  handleSend,
  handleSubscribe,
  handleUnsubscribe,
  isValidToken,
  normalizeEmail,
  readProductUpdateConfig,
  type EmailMessage,
  type MailResult,
} from '../../../supabase/functions/_shared/productUpdateSubscriptions';

const config = readProductUpdateConfig(
  (key) =>
    ({
      SUPABASE_URL: 'https://projeto.supabase.test/',
      RESEND_API_KEY: 'chave-de-teste',
      RESEND_FROM_EMAIL: 'nitin <novidades@nitin.com.br>',
    })[key],
);

const CONFIRM_TOKEN = 'a'.repeat(64);
const UNSUBSCRIBE_TOKEN = 'b'.repeat(64);
const UPDATE_ID = '11111111-1111-4111-8111-111111111111';
const SEND_ID = '22222222-2222-4222-8222-222222222222';

type Rpc = { data?: unknown; error?: { message: string; code?: string } | null };

function fakeDb(overrides: Record<string, Rpc> = {}) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      const defaults: Record<string, Rpc> = {
        consume_product_update_limit: { data: true },
        subscribe_to_product_updates: {
          data: [{ outcome: 'confirm', confirm_token: CONFIRM_TOKEN, unsubscribe_token: UNSUBSCRIBE_TOKEN }],
        },
        confirm_product_update_subscription: { data: true },
        unsubscribe_from_product_updates: { data: true },
        start_product_update_send: {
          data: [{ send_id: SEND_ID, slug: 'novidade', title: 'Título', summary: 'Resumo' }],
        },
        claim_product_update_deliveries: { data: [] },
        finish_product_update_deliveries: {
          data: [{ total: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, completed_at: null }],
        },
      };
      const result = overrides[name] ?? defaults[name] ?? { data: null };
      return { data: result.data ?? null, error: result.error ?? null };
    },
  };
}

function fakeSender(results: MailResult[] = []) {
  const sent: { message: EmailMessage; key?: string }[] = [];
  const send = async (message: EmailMessage, key?: string) => {
    sent.push({ message, key });
    return results.shift() ?? { kind: 'sent' as const, id: `id-${sent.length}` };
  };
  return { send, sent };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://projeto.supabase.test/functions/v1/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nitin.com.br', ...headers },
    body: JSON.stringify(body),
  });

const subscribeBody = {
  email: 'pessoa@example.test',
  consent: true,
  consentVersion: '2026-10-31',
  source: 'novidades',
};

describe('validação', () => {
  it('normaliza e-mails e recusa os inválidos', () => {
    expect(normalizeEmail('  Pessoa@Example.TEST ')).toBe('pessoa@example.test');
    for (const invalid of [
      'sem-arroba',
      'a@b',
      'duas@arrobas@example.test',
      'com espaco@example.test',
      'injecao@example.test\r\nBcc: x@example.test',
      'Nome <pessoa@example.test>',
      `${'a'.repeat(250)}@example.test`,
      null,
      42,
    ]) {
      expect(normalizeEmail(invalid)).toBeNull();
    }
  });

  it('só aceita tokens no formato gerado pelo banco', () => {
    expect(isValidToken(CONFIRM_TOKEN)).toBe(true);
    expect(isValidToken('a'.repeat(63))).toBe(false);
    expect(isValidToken('Z'.repeat(64))).toBe(false);
    expect(isValidToken(undefined)).toBe(false);
  });

  it('escapa HTML', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});

describe('e-mails', () => {
  const messages: [string, EmailMessage][] = [
    ['confirmação', buildConfirmationEmail(config, 'p@example.test', CONFIRM_TOKEN, UNSUBSCRIBE_TOKEN)],
    ['já inscrito', buildAlreadySubscribedEmail(config, 'p@example.test', UNSUBSCRIBE_TOKEN)],
    [
      'novidade',
      buildUpdateEmail(config, 'p@example.test', UNSUBSCRIBE_TOKEN, {
        slug: 'novidade',
        title: 'Título',
        summary: 'Resumo',
      }),
    ],
  ];

  it.each(messages)('%s leva descadastro no corpo e nos cabeçalhos', (_name, message) => {
    const pageLink = `https://nitin.com.br/novidades/inscricao/cancelar#token=${UNSUBSCRIBE_TOKEN}`;
    expect(message.html).toContain(pageLink);
    expect(message.text).toContain(pageLink);
    expect(message.headers['List-Unsubscribe']).toBe(
      `<https://projeto.supabase.test/functions/v1/product-update-unsubscribe?token=${UNSUBSCRIBE_TOKEN}>`,
    );
    expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('confirmação leva o link com o token no fragmento', () => {
    const [, message] = messages[0];
    expect(message.text).toContain(`https://nitin.com.br/novidades/inscricao/confirmar#token=${CONFIRM_TOKEN}`);
  });

  it('já inscrito não oferece link de confirmação', () => {
    const [, message] = messages[1];
    expect(message.text).not.toContain('/confirmar');
  });

  it('novidade escapa o conteúdo e não permite quebrar o assunto', () => {
    const message = buildUpdateEmail(config, 'p@example.test', UNSUBSCRIBE_TOKEN, {
      slug: 'novidade',
      title: 'Título\r\nBcc: x@example.test <script>',
      summary: '<img src=x onerror=alert(1)>',
    });
    expect(message.subject).toBe('Novidade do nitin: Título Bcc: x@example.test <script>');
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('<img');
    expect(message.text).toContain('https://nitin.com.br/novidades/novidade');
  });
});

describe('remetente Resend', () => {
  const message = buildConfirmationEmail(config, 'p@example.test', CONFIRM_TOKEN, UNSUBSCRIBE_TOKEN);
  const replyWith = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    jest.fn(async () => new Response(JSON.stringify(body), { status, headers }));

  it('envia com autenticação, User-Agent, cabeçalhos e chave de idempotência', async () => {
    const fetchImpl = replyWith(200, { id: 'abc' });
    await expect(createResendSender(config, fetchImpl as never)(message, 'chave')).resolves.toEqual({
      kind: 'sent',
      id: 'abc',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(init.body as string);
    expect(url).toBe('https://api.resend.com/emails');
    expect(headers.Authorization).toBe('Bearer chave-de-teste');
    expect(headers['User-Agent']).toBeTruthy();
    expect(headers['Idempotency-Key']).toBe('chave');
    expect(body.from).toBe('nitin <novidades@nitin.com.br>');
    expect(body.reply_to).toBe('contato@nitin.com.br');
    expect(body.to).toBe('p@example.test');
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it.each([
    [429, { name: 'rate_limit_exceeded' }, { 'retry-after': '7' }, { kind: 'retry', retryAfterSeconds: 7 }],
    [429, { name: 'daily_quota_exceeded' }, {}, { kind: 'retry', retryAfterSeconds: 30 }],
    [503, {}, {}, { kind: 'retry', retryAfterSeconds: 30 }],
    [409, { name: 'concurrent_idempotent_requests' }, {}, { kind: 'retry', retryAfterSeconds: 30 }],
    [409, { name: 'invalid_idempotent_request' }, {}, { kind: 'rejected', code: 'invalid_idempotent_request' }],
    [403, { name: 'validation_error', message: 'domain is not verified' }, {}, { kind: 'blocked', code: 'validation_error' }],
    [401, { name: 'missing_api_key' }, {}, { kind: 'blocked', code: 'missing_api_key' }],
    [422, { name: 'validation_error', message: 'Invalid `from` field' }, {}, { kind: 'blocked', code: 'validation_error' }],
    [422, { name: 'validation_error', message: 'Invalid `to` field' }, {}, { kind: 'rejected', code: 'validation_error' }],
  ])('classifica status %i %j', async (status, body, headers, expected) => {
    const fetchImpl = replyWith(status, body, headers as Record<string, string>);
    await expect(createResendSender(config, fetchImpl as never)(message)).resolves.toEqual(expected);
  });

  it('pede nova tentativa em falha de rede', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('rede');
    });
    await expect(createResendSender(config, fetchImpl as never)(message)).resolves.toEqual({
      kind: 'retry',
      retryAfterSeconds: 30,
    });
  });

  it('não chama o provedor sem chave ou remetente configurados', async () => {
    const fetchImpl = jest.fn();
    const unconfigured = readProductUpdateConfig(() => undefined);
    await expect(createResendSender(unconfigured, fetchImpl as never)(message)).resolves.toEqual({
      kind: 'blocked',
      code: 'provider_not_configured',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('inscrição', () => {
  const deps = (db = fakeDb(), sender = fakeSender()) => ({ db, config, sendEmail: sender.send });

  it('responde igual para quem é novo e para quem já está inscrito', async () => {
    const newcomer = fakeSender();
    const existing = fakeSender();
    const first = await handleSubscribe(post(subscribeBody), deps(fakeDb(), newcomer));
    const second = await handleSubscribe(
      post(subscribeBody),
      deps(
        fakeDb({
          subscribe_to_product_updates: {
            data: [{ outcome: 'already_confirmed', confirm_token: null, unsubscribe_token: UNSUBSCRIBE_TOKEN }],
          },
        }),
        existing,
      ),
    );
    expect(first.status).toBe(second.status);
    expect(await first.text()).toBe(await second.text());
    expect(newcomer.sent).toHaveLength(1);
    expect(existing.sent).toHaveLength(1);
    expect(newcomer.sent[0].message.text).toContain('/confirmar#token=');
    expect(existing.sent[0].message.text).not.toContain('/confirmar');
  });

  it('exige consentimento explícito, versão e origem conhecidas', async () => {
    for (const body of [
      { ...subscribeBody, consent: undefined },
      { ...subscribeBody, consent: 'true' },
      { ...subscribeBody, consentVersion: '2020-01-01' },
      { ...subscribeBody, source: 'outro-site' },
      { ...subscribeBody, email: 'invalido' },
    ]) {
      const db = fakeDb();
      const response = await handleSubscribe(post(body), deps(db));
      expect(response.status).toBe(400);
      expect(db.calls).toHaveLength(0);
    }
  });

  it('aceita sem gravar quando o campo oculto vem preenchido', async () => {
    const db = fakeDb();
    const sender = fakeSender();
    const response = await handleSubscribe(post({ ...subscribeBody, website: 'spam' }), deps(db, sender));
    expect(await response.json()).toEqual({ accepted: true });
    expect(db.calls).toHaveLength(0);
    expect(sender.sent).toHaveLength(0);
  });

  it('limita por e-mail com a chave em hash e depois no total', async () => {
    const db = fakeDb();
    await handleSubscribe(post(subscribeBody), deps(db));
    const [perEmail, global] = db.calls;
    expect(perEmail.args?.p_feature).toBe('news_subscribe_email');
    expect(perEmail.args?.p_subject).toMatch(/^[0-9a-f]{64}$/);
    expect(String(perEmail.args?.p_subject)).not.toContain('pessoa');
    expect(global.args?.p_feature).toBe('news_subscribe');
  });

  it('responde 429 e nada envia acima do limite ou com o limite indisponível', async () => {
    for (const limit of [{ data: false }, { error: { message: 'falhou' } }]) {
      const db = fakeDb({ consume_product_update_limit: limit });
      const sender = fakeSender();
      const response = await handleSubscribe(post(subscribeBody), deps(db, sender));
      expect(response.status).toBe(429);
      expect(sender.sent).toHaveLength(0);
      expect(db.calls.map((call) => call.name)).not.toContain('subscribe_to_product_updates');
    }
  });

  it('informa falha de envio sem confirmar a inscrição', async () => {
    const response = await handleSubscribe(
      post(subscribeBody),
      deps(fakeDb(), fakeSender([{ kind: 'retry', retryAfterSeconds: 5 }])),
    );
    expect(response.status).toBe(502);
  });

  it('recusa origem de outro site, corpo fora de JSON e outros métodos', async () => {
    const db = fakeDb();
    const foreign = await handleSubscribe(post(subscribeBody, { Origin: 'https://ataque.test' }), deps(db));
    expect(foreign.status).toBe(403);
    const plainText = await handleSubscribe(
      new Request('https://x.test', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(subscribeBody) }),
      deps(db),
    );
    expect(plainText.status).toBe(400);
    const get = await handleSubscribe(new Request('https://x.test'), deps(db));
    expect(get.status).toBe(405);
    expect(db.calls).toHaveLength(0);
  });

  it('libera o preflight só para origens permitidas', async () => {
    const allowed = await handleSubscribe(
      new Request('https://x.test', { method: 'OPTIONS', headers: { Origin: 'https://www.nitin.com.br' } }),
      deps(),
    );
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://www.nitin.com.br');
    const refused = await handleSubscribe(
      new Request('https://x.test', { method: 'OPTIONS', headers: { Origin: 'https://ataque.test' } }),
      deps(),
    );
    expect(refused.status).toBe(403);
  });
});

describe('confirmação', () => {
  it('confirma com token válido', async () => {
    const db = fakeDb();
    const response = await handleConfirm(post({ token: CONFIRM_TOKEN }), { db, config });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ confirmed: true });
  });

  it('não consulta o banco com token malformado', async () => {
    const db = fakeDb();
    const response = await handleConfirm(post({ token: 'curto' }), { db, config });
    expect(response.status).toBe(404);
    expect(db.calls).toHaveLength(0);
  });

  it('responde igual para token vencido, usado ou inexistente', async () => {
    const db = fakeDb({ confirm_product_update_subscription: { data: false } });
    const response = await handleConfirm(post({ token: CONFIRM_TOKEN }), { db, config });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ confirmed: false });
  });

  it('não confirma por GET e respeita o limite', async () => {
    const db = fakeDb();
    expect((await handleConfirm(new Request(`https://x.test/?token=${CONFIRM_TOKEN}`), { db, config })).status).toBe(405);
    expect(db.calls).toHaveLength(0);
    const limited = fakeDb({ consume_product_update_limit: { data: false } });
    expect((await handleConfirm(post({ token: CONFIRM_TOKEN }), { db: limited, config })).status).toBe(429);
    expect(limited.calls.map((call) => call.name)).not.toContain('confirm_product_update_subscription');
  });
});

describe('descadastro', () => {
  const oneClick = (body = 'List-Unsubscribe=One-Click') =>
    new Request(`https://x.test/?token=${UNSUBSCRIBE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

  it('GET só redireciona para a página, sem descadastrar', async () => {
    const db = fakeDb();
    const response = await handleUnsubscribe(new Request(`https://x.test/?token=${UNSUBSCRIBE_TOKEN}`), { db, config });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      `https://nitin.com.br/novidades/inscricao/cancelar#token=${UNSUBSCRIBE_TOKEN}`,
    );
    expect(db.calls).toHaveLength(0);
  });

  it('GET com token malformado não o repassa', async () => {
    const response = await handleUnsubscribe(new Request('https://x.test/?token=<script>'), { db: fakeDb(), config });
    expect(response.headers.get('Location')).toBe('https://nitin.com.br/novidades/inscricao/cancelar');
  });

  it('aceita o clique único dos provedores de e-mail, sem Origin', async () => {
    const db = fakeDb();
    const response = await handleUnsubscribe(oneClick(), { db, config });
    expect(response.status).toBe(200);
    expect(db.calls.at(-1)).toEqual({
      name: 'unsubscribe_from_product_updates',
      args: { p_token: UNSUBSCRIBE_TOKEN },
    });
  });

  it('recusa formulário que não seja o clique único', async () => {
    const db = fakeDb();
    expect((await handleUnsubscribe(oneClick('outro=1'), { db, config })).status).toBe(404);
    expect(db.calls).toHaveLength(0);
  });

  it('aceita o JSON da página e informa token desconhecido', async () => {
    const db = fakeDb({ unsubscribe_from_product_updates: { data: false } });
    const response = await handleUnsubscribe(post({ token: UNSUBSCRIBE_TOKEN }), { db, config });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ unsubscribed: false });
  });

  it('respeita o limite', async () => {
    const db = fakeDb({ consume_product_update_limit: { data: false } });
    expect((await handleUnsubscribe(post({ token: UNSUBSCRIBE_TOKEN }), { db, config })).status).toBe(429);
  });
});

describe('envio', () => {
  const editorClient = (allowed: unknown = true, user: { id: string } | null = { id: 'editor' }) => ({
    auth: { getUser: async () => ({ data: { user }, error: user ? null : new Error('sem sessão') }) },
    rpc: async () => ({ data: allowed, error: null }),
  });
  const authorized = (body: unknown = { updateId: UPDATE_ID }) => post(body, { Authorization: 'Bearer sessao' });
  const recipients = ['1', '2', '3'].map((id) => ({
    subscriber_id: id,
    email: `${id}@example.test`,
    unsubscribe_token: id.repeat(64),
  }));
  const claimed = () => fakeDb({ claim_product_update_deliveries: { data: recipients } });
  const resultsOf = (db: ReturnType<typeof fakeDb>) =>
    db.calls.find((call) => call.name === 'finish_product_update_deliveries')?.args?.p_results;

  it('exige sessão e permissão de editor antes de tocar nos dados', async () => {
    for (const [request, client, status] of [
      [post({ updateId: UPDATE_ID }), editorClient(), 401],
      [authorized(), editorClient(true, null), 401],
      [authorized(), editorClient(false), 403],
    ] as const) {
      const db = fakeDb();
      const response = await handleSend(request, {
        db,
        config,
        sendEmail: fakeSender().send,
        createUserClient: () => client,
      });
      expect(response.status).toBe(status);
      expect(db.calls).toHaveLength(0);
    }
  });

  it('recusa identificador inválido e publicação que não esteja no ar', async () => {
    const invalid = await handleSend(authorized({ updateId: 'x' }), {
      db: fakeDb(),
      config,
      sendEmail: fakeSender().send,
      createUserClient: () => editorClient(),
    });
    expect(invalid.status).toBe(400);
    const draft = await handleSend(authorized(), {
      db: fakeDb({ start_product_update_send: { error: { message: 'x', code: 'P0002' } } }),
      config,
      sendEmail: fakeSender().send,
      createUserClient: () => editorClient(),
    });
    expect(draft.status).toBe(409);
  });

  it('envia um e-mail por inscrito, com chave de idempotência própria', async () => {
    const db = claimed();
    const sender = fakeSender();
    const response = await handleSend(authorized(), { db, config, sendEmail: sender.send, createUserClient: () => editorClient() });
    expect(response.status).toBe(200);
    expect(sender.sent.map((item) => item.message.to)).toEqual(['1@example.test', '2@example.test', '3@example.test']);
    expect(sender.sent.map((item) => item.key)).toEqual([`${SEND_ID}:1`, `${SEND_ID}:2`, `${SEND_ID}:3`]);
    expect(sender.sent[0].message.headers['List-Unsubscribe']).toContain('1'.repeat(64));
    expect(resultsOf(db)).toEqual([
      { subscriber_id: '1', status: 'sent', provider_id: 'id-1' },
      { subscriber_id: '2', status: 'sent', provider_id: 'id-2' },
      { subscriber_id: '3', status: 'sent', provider_id: 'id-3' },
    ]);
  });

  it('marca só o endereço recusado como falha e segue', async () => {
    const db = claimed();
    const sender = fakeSender([{ kind: 'rejected', code: 'validation_error' }]);
    await handleSend(authorized(), { db, config, sendEmail: sender.send, createUserClient: () => editorClient() });
    expect(sender.sent).toHaveLength(3);
    expect(resultsOf(db)).toEqual([
      { subscriber_id: '1', status: 'failed', error_code: 'validation_error' },
      { subscriber_id: '2', status: 'sent', provider_id: 'id-2' },
      { subscriber_id: '3', status: 'sent', provider_id: 'id-3' },
    ]);
  });

  it.each([
    ['limite do provedor', { kind: 'retry', retryAfterSeconds: 9 } as MailResult, 9, false],
    ['provedor mal configurado', { kind: 'blocked', code: 'validation_error' } as MailResult, null, true],
  ])('%s interrompe o lote e devolve o restante à fila', async (_name, failure, retryAfterSeconds, blocked) => {
    const db = claimed();
    const sender = fakeSender([{ kind: 'sent', id: 'id-1' }, failure]);
    const response = await handleSend(authorized(), { db, config, sendEmail: sender.send, createUserClient: () => editorClient() });
    const body = await response.json();
    expect(sender.sent).toHaveLength(2);
    expect(body.retryAfterSeconds).toBe(retryAfterSeconds);
    expect(body.blocked).toBe(blocked);
    expect(resultsOf(db)).toEqual([
      { subscriber_id: '1', status: 'sent', provider_id: 'id-1' },
      { subscriber_id: '2', status: 'pending' },
      { subscriber_id: '3', status: 'pending' },
    ]);
  });

  it('não devolve e-mails nem tokens ao painel', async () => {
    const response = await handleSend(authorized(), {
      db: claimed(),
      config,
      sendEmail: fakeSender().send,
      createUserClient: () => editorClient(),
    });
    const body = await response.text();
    expect(body).not.toContain('@example.test');
    expect(body).not.toContain('1'.repeat(64));
  });
});
