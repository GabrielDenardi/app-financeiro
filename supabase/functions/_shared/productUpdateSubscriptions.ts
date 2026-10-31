import { PayloadValidationError, readBoundedJsonRequest } from './securityControls.ts';

export const CONSENT_VERSIONS = ['2026-10-31'];
export const CONSENT_SOURCES = ['novidades', 'publicacao'];

const MAX_BODY_BYTES = 1024;
const SEND_BATCH_SIZE = 25;
const GLOBAL_LIMIT_SUBJECT = 'product-updates-global';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^@\s<>,;:"'`\\()[\]]{1,64}@[^@\s<>,;:"'`\\()[\]]+\.[^@\s<>,;:"'`\\()[\]]+$/;
const DEFAULT_ORIGINS = 'https://nitin.com.br,https://www.nitin.com.br';
const DEFAULT_SITE_URL = 'https://nitin.com.br';
const DEFAULT_CONTACT_EMAIL = 'contato@nitin.com.br';
const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_SECONDS = 30;

type RpcResult = { data: any; error: { message: string; code?: string } | null };

export type ServiceDb = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type UserClient = {
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string): PromiseLike<RpcResult>;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export type MailResult =
  | { kind: 'sent'; id: string }
  | { kind: 'rejected'; code: string }
  | { kind: 'blocked'; code: string }
  | { kind: 'retry'; retryAfterSeconds: number };

export type SendEmail = (message: EmailMessage, idempotencyKey?: string) => Promise<MailResult>;

export type ProductUpdateConfig = {
  siteUrl: string;
  functionsUrl: string;
  allowedOrigins: string[];
  contactEmail: string;
  fromEmail: string;
  resendApiKey: string;
};

export function readProductUpdateConfig(env: (key: string) => string | undefined): ProductUpdateConfig {
  return {
    siteUrl: (env('PRODUCT_UPDATES_SITE_URL') || DEFAULT_SITE_URL).replace(/\/+$/, ''),
    functionsUrl: `${(env('SUPABASE_URL') ?? '').replace(/\/+$/, '')}/functions/v1`,
    allowedOrigins: (env('PRODUCT_UPDATES_ALLOWED_ORIGINS') || DEFAULT_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    contactEmail: env('PRODUCT_UPDATES_CONTACT_EMAIL') || DEFAULT_CONTACT_EMAIL,
    fromEmail: env('RESEND_FROM_EMAIL') ?? '',
    resendApiKey: env('RESEND_API_KEY') ?? '',
  };
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export const isValidToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const unsubscribePageUrl = (config: ProductUpdateConfig, token: string) =>
  `${config.siteUrl}/novidades/inscricao/cancelar#token=${token}`;

const confirmPageUrl = (config: ProductUpdateConfig, token: string) =>
  `${config.siteUrl}/novidades/inscricao/confirmar#token=${token}`;

type EmailContent = {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
};

function composeEmail(
  config: ProductUpdateConfig,
  to: string,
  unsubscribeToken: string,
  content: EmailContent,
): EmailMessage {
  const unsubscribeUrl = unsubscribePageUrl(config, unsubscribeToken);
  const reason = 'Você recebeu este e-mail porque este endereço foi informado na página de novidades do nitin.';
  const body = content.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#161f36">${escapeHtml(paragraph)}</p>`)
    .join('');
  const action = content.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1d60f5;color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(content.action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f2f6fe;font-family:Inter,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px;border-radius:16px;background:#ffffff"><p style="margin:0 0 24px;font-size:22px;font-weight:800;color:#02040c">nitin</p><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#02040c">${escapeHtml(content.heading)}</h1>${body}${action}<hr style="margin:28px 0 16px;border:0;border-top:1px solid #dde4f2"><p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4d5975">${escapeHtml(reason)}</p><p style="margin:0;font-size:13px;line-height:1.5;color:#4d5975"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#0330b0">Cancelar inscrição</a> · ${escapeHtml(config.contactEmail)}</p></div></body></html>`;
  const text = [
    'nitin',
    content.heading,
    ...content.paragraphs,
    ...(content.action ? [`${content.action.label}: ${content.action.url}`] : []),
    reason,
    `Cancelar inscrição: ${unsubscribeUrl}`,
    `Fale com a gente: ${config.contactEmail}`,
  ].join('\n\n');

  return {
    to,
    subject: singleLine(content.subject),
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${config.functionsUrl}/product-update-unsubscribe?token=${unsubscribeToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export const buildConfirmationEmail = (
  config: ProductUpdateConfig,
  to: string,
  confirmToken: string,
  unsubscribeToken: string,
) =>
  composeEmail(config, to, unsubscribeToken, {
    subject: 'Confirme sua inscrição nas novidades do nitin',
    heading: 'Confirme sua inscrição',
    paragraphs: [
      'Recebemos um pedido para enviar as novidades do nitin a este endereço. Falta só confirmar que foi você.',
      'O link vale por 48 horas. Se você não fez esse pedido, ignore este e-mail: sem a confirmação, nada será enviado e o cadastro é apagado.',
    ],
    action: { label: 'Confirmar inscrição', url: confirmPageUrl(config, confirmToken) },
  });

export const buildAlreadySubscribedEmail = (
  config: ProductUpdateConfig,
  to: string,
  unsubscribeToken: string,
) =>
  composeEmail(config, to, unsubscribeToken, {
    subject: 'Você já recebe as novidades do nitin',
    heading: 'Sua inscrição já está ativa',
    paragraphs: [
      'Recebemos um novo pedido de inscrição para este endereço, que já recebe as novidades do nitin. Você não precisa fazer nada.',
      'Se quiser parar de receber, use o link de cancelamento abaixo.',
    ],
  });

export const buildUpdateEmail = (
  config: ProductUpdateConfig,
  to: string,
  unsubscribeToken: string,
  post: { slug: string; title: string; summary: string },
) =>
  composeEmail(config, to, unsubscribeToken, {
    subject: `Novidade do nitin: ${post.title}`,
    heading: post.title,
    paragraphs: [post.summary],
    action: { label: 'Ler a novidade', url: `${config.siteUrl}/novidades/${post.slug}` },
  });

function classifyProviderFailure(status: number, payload: { name?: string; message?: string }, retryAfter: string | null): MailResult {
  const code = String(payload.name ?? `http_${status}`).slice(0, 100);
  if (code === 'invalid_idempotent_request') return { kind: 'rejected', code };
  if (status === 409 || status === 429 || status >= 500) {
    const seconds = Number(retryAfter);
    return {
      kind: 'retry',
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_SECONDS,
    };
  }
  if ((status === 400 || status === 422) && /`to`/.test(payload.message ?? '')) {
    return { kind: 'rejected', code };
  }
  return { kind: 'blocked', code };
}

export function createResendSender(config: ProductUpdateConfig, fetchImpl: typeof fetch = fetch): SendEmail {
  return async (message, idempotencyKey) => {
    if (!config.resendApiKey || !config.fromEmail) return { kind: 'blocked', code: 'provider_not_configured' };
    try {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'nitin-product-updates',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        body: JSON.stringify({
          from: config.fromEmail,
          reply_to: config.contactEmail,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && typeof payload.id === 'string') return { kind: 'sent', id: payload.id };
      if (response.ok) return { kind: 'retry', retryAfterSeconds: DEFAULT_RETRY_SECONDS };
      return classifyProviderFailure(response.status, payload, response.headers.get('retry-after'));
    } catch {
      return { kind: 'retry', retryAfterSeconds: DEFAULT_RETRY_SECONDS };
    }
  };
}

function corsHeaders(request: Request, config: ProductUpdateConfig) {
  const origin = request.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

function respond(request: Request, config: ProductUpdateConfig, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, config), 'Content-Type': 'application/json' },
  });
}

function guardRequest(request: Request, config: ProductUpdateConfig) {
  const origin = request.headers.get('origin');
  if (origin && !config.allowedOrigins.includes(origin)) {
    return respond(request, config, { error: 'Origem nao permitida.' }, 403);
  }
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request, config) });
  }
  return null;
}

const invalidRequest = (request: Request, config: ProductUpdateConfig) =>
  respond(request, config, { error: 'Requisição inválida.' }, 400);

const tooManyAttempts = (request: Request, config: ProductUpdateConfig) =>
  respond(request, config, { error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429);

const serverFailure = (request: Request, config: ProductUpdateConfig) =>
  respond(request, config, { error: 'Não foi possível concluir agora. Tente novamente em instantes.' }, 500);

async function readJson(request: Request) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    throw new PayloadValidationError('Tipo de conteúdo inválido.', 415);
  }
  return readBoundedJsonRequest(request, MAX_BODY_BYTES);
}

async function withinLimit(db: ServiceDb, feature: string, subject: string) {
  const { data, error } = await db.rpc('consume_product_update_limit', {
    p_feature: feature,
    p_subject: subject,
  });
  return !error && data === true;
}

export type PublicDeps = { db: ServiceDb; config: ProductUpdateConfig; sendEmail: SendEmail };

export async function handleSubscribe(request: Request, { db, config, sendEmail }: PublicDeps) {
  const guarded = guardRequest(request, config);
  if (guarded) return guarded;
  if (request.method !== 'POST') return respond(request, config, { error: 'Método não permitido.' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await readJson(request);
  } catch {
    return invalidRequest(request, config);
  }

  if (String(payload.website ?? '').trim()) return respond(request, config, { accepted: true });

  const email = normalizeEmail(payload.email);
  const source = String(payload.source ?? '');
  const consentVersion = String(payload.consentVersion ?? '');
  if (
    !email ||
    payload.consent !== true ||
    !CONSENT_SOURCES.includes(source) ||
    !CONSENT_VERSIONS.includes(consentVersion)
  ) {
    return invalidRequest(request, config);
  }

  if (!(await withinLimit(db, 'news_subscribe_email', await sha256(email)))) {
    return tooManyAttempts(request, config);
  }
  if (!(await withinLimit(db, 'news_subscribe', GLOBAL_LIMIT_SUBJECT))) {
    return tooManyAttempts(request, config);
  }

  const { data, error } = await db.rpc('subscribe_to_product_updates', {
    p_email: email,
    p_source: source,
    p_consent_version: consentVersion,
  });
  const row = data?.[0];
  if (error || !row) return serverFailure(request, config);

  const message =
    row.outcome === 'confirm'
      ? buildConfirmationEmail(config, email, row.confirm_token, row.unsubscribe_token)
      : buildAlreadySubscribedEmail(config, email, row.unsubscribe_token);
  const result = await sendEmail(message);
  if (result.kind !== 'sent') {
    return respond(request, config, { error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' }, 502);
  }

  return respond(request, config, { accepted: true });
}

export async function handleConfirm(request: Request, { db, config }: Pick<PublicDeps, 'db' | 'config'>) {
  const guarded = guardRequest(request, config);
  if (guarded) return guarded;
  if (request.method !== 'POST') return respond(request, config, { error: 'Método não permitido.' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await readJson(request);
  } catch {
    return invalidRequest(request, config);
  }
  if (!isValidToken(payload.token)) return respond(request, config, { confirmed: false }, 404);

  if (!(await withinLimit(db, 'news_confirm', GLOBAL_LIMIT_SUBJECT))) {
    return tooManyAttempts(request, config);
  }

  const { data, error } = await db.rpc('confirm_product_update_subscription', { p_token: payload.token });
  if (error) return serverFailure(request, config);
  return respond(request, config, { confirmed: data === true }, data === true ? 200 : 404);
}

async function readUnsubscribeToken(request: Request, url: URL) {
  const queryToken = url.searchParams.get('token');
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.startsWith('application/x-www-form-urlencoded') || contentType.startsWith('multipart/form-data')) {
    const form = await request.formData();
    return form.get('List-Unsubscribe') === 'One-Click' ? queryToken : null;
  }
  return (await readJson(request)).token;
}

export async function handleUnsubscribe(request: Request, { db, config }: Pick<PublicDeps, 'db' | 'config'>) {
  const guarded = guardRequest(request, config);
  if (guarded) return guarded;

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const token = url.searchParams.get('token');
    const location = isValidToken(token)
      ? unsubscribePageUrl(config, token)
      : `${config.siteUrl}/novidades/inscricao/cancelar`;
    return new Response(null, { status: 303, headers: { Location: location, 'Referrer-Policy': 'no-referrer' } });
  }
  if (request.method !== 'POST') return respond(request, config, { error: 'Método não permitido.' }, 405);

  let token: unknown;
  try {
    token = await readUnsubscribeToken(request, url);
  } catch {
    return invalidRequest(request, config);
  }
  if (!isValidToken(token)) return respond(request, config, { unsubscribed: false }, 404);

  if (!(await withinLimit(db, 'news_unsubscribe', GLOBAL_LIMIT_SUBJECT))) {
    return tooManyAttempts(request, config);
  }

  const { data, error } = await db.rpc('unsubscribe_from_product_updates', { p_token: token });
  if (error) return serverFailure(request, config);
  return respond(request, config, { unsubscribed: data === true }, data === true ? 200 : 404);
}

export type SendDeps = PublicDeps & { createUserClient: (authorization: string) => UserClient };

export async function handleSend(request: Request, { db, config, sendEmail, createUserClient }: SendDeps) {
  const guarded = guardRequest(request, config);
  if (guarded) return guarded;
  if (request.method !== 'POST') return respond(request, config, { error: 'Método não permitido.' }, 405);

  const authorization = request.headers.get('authorization');
  if (!authorization) return respond(request, config, { error: 'Não autenticado.' }, 401);
  const userClient = createUserClient(authorization);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return respond(request, config, { error: 'Não autenticado.' }, 401);
  const { data: allowed, error: roleError } = await userClient.rpc('is_site_editor');
  if (roleError || allowed !== true) return respond(request, config, { error: 'Acesso negado.' }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await readJson(request);
  } catch {
    return invalidRequest(request, config);
  }
  const updateId = String(payload.updateId ?? '');
  if (!UUID_PATTERN.test(updateId)) return invalidRequest(request, config);

  const started = await db.rpc('start_product_update_send', {
    p_update_id: updateId,
    p_editor: userData.user.id,
  });
  if (started.error?.code === 'P0002') {
    return respond(request, config, { error: 'Publique a novidade antes de enviar.' }, 409);
  }
  const post = started.data?.[0];
  if (started.error || !post) return serverFailure(request, config);

  const claimed = await db.rpc('claim_product_update_deliveries', {
    p_send_id: post.send_id,
    p_limit: SEND_BATCH_SIZE,
  });
  if (claimed.error) return serverFailure(request, config);

  const results: Record<string, unknown>[] = [];
  let retryAfterSeconds: number | null = null;
  let blockedCode: string | null = null;

  for (const recipient of claimed.data ?? []) {
    if (retryAfterSeconds !== null || blockedCode) {
      results.push({ subscriber_id: recipient.subscriber_id, status: 'pending' });
      continue;
    }
    const result = await sendEmail(
      buildUpdateEmail(config, recipient.email, recipient.unsubscribe_token, post),
      `${post.send_id}:${recipient.subscriber_id}`,
    );
    if (result.kind === 'sent') {
      results.push({ subscriber_id: recipient.subscriber_id, status: 'sent', provider_id: result.id });
    } else if (result.kind === 'rejected') {
      results.push({ subscriber_id: recipient.subscriber_id, status: 'failed', error_code: result.code });
    } else {
      if (result.kind === 'retry') retryAfterSeconds = result.retryAfterSeconds;
      else blockedCode = result.code;
      results.push({ subscriber_id: recipient.subscriber_id, status: 'pending' });
    }
  }

  const finished = await db.rpc('finish_product_update_deliveries', {
    p_send_id: post.send_id,
    p_results: results,
  });
  const summary = finished.data?.[0];
  if (finished.error || !summary) return serverFailure(request, config);

  return respond(request, config, {
    total: summary.total,
    sent: summary.sent,
    failed: summary.failed,
    skipped: summary.skipped,
    remaining: summary.remaining,
    completedAt: summary.completed_at,
    retryAfterSeconds,
    blocked: Boolean(blockedCode),
  });
}
