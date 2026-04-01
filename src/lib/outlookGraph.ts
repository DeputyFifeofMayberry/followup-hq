import type {
  OutlookConnectionSettings,
  OutlookFolderName,
  OutlookMailboxProfile,
  OutlookMessage,
  OutlookTokenSet,
} from '../types';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const DEFAULT_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];

function authorityBase(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId || 'common'}/oauth2/v2.0`;
}

function encodeBase64Url(input: Uint8Array): string {
  const binary = Array.from(input).map((byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function selectClause(): string {
  return [
    'id',
    'internetMessageId',
    'conversationId',
    'subject',
    'bodyPreview',
    'from',
    'toRecipients',
    'ccRecipients',
    'receivedDateTime',
    'sentDateTime',
    'isRead',
    'importance',
    'hasAttachments',
    'categories',
    'flag',
    'webLink',
  ].join(',');
}

export function getDefaultOutlookSettings(): OutlookConnectionSettings {
  return {
    clientId: '',
    tenantId: 'common',
    redirectUri: 'http://localhost',
    scopes: DEFAULT_SCOPES,
    syncLimit: 15,
    autoPullSent: true,
  };
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = encodeBase64Url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = encodeBase64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function generateState(): string {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

export function buildAuthorizationUrl(settings: OutlookConnectionSettings, state: string, codeChallenge: string): string {
  const authority = `${authorityBase(settings.tenantId)}/authorize`;
  const params = new URLSearchParams({
    client_id: settings.clientId,
    response_type: 'code',
    redirect_uri: settings.redirectUri,
    response_mode: 'query',
    scope: settings.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${authority}?${params.toString()}`;
}

export function parseAuthorizationResponse(input: string): { code: string; state?: string } {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') ?? undefined;
    if (!code) throw new Error('No authorization code found in callback URL.');
    return { code, state };
  } catch {
    const params = new URLSearchParams(trimmed.replace(/^\?/, ''));
    const code = params.get('code');
    const state = params.get('state') ?? undefined;
    if (!code) throw new Error('Paste the full callback URL or a query string containing code=.');
    return { code, state };
  }
}

async function postTokenForm(tenantId: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(`${authorityBase(tenantId)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json.error_description ?? json.error ?? 'Microsoft token request failed.'));
  }
  return json;
}

export async function exchangeCodeForTokens(
  settings: OutlookConnectionSettings,
  code: string,
  codeVerifier: string,
): Promise<OutlookTokenSet> {
  const payload = await postTokenForm(
    settings.tenantId,
    new URLSearchParams({
      client_id: settings.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: settings.redirectUri,
      code_verifier: codeVerifier,
      scope: settings.scopes.join(' '),
    }),
  );

  const expiresIn = Number(payload.expires_in ?? 3600);
  const acquiredAt = new Date().toISOString();
  return {
    accessToken: String(payload.access_token ?? ''),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : undefined,
    acquiredAt,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function refreshAccessToken(settings: OutlookConnectionSettings, refreshToken: string): Promise<OutlookTokenSet> {
  const payload = await postTokenForm(
    settings.tenantId,
    new URLSearchParams({
      client_id: settings.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: settings.redirectUri,
      scope: settings.scopes.join(' '),
    }),
  );

  const expiresIn = Number(payload.expires_in ?? 3600);
  const acquiredAt = new Date().toISOString();
  return {
    accessToken: String(payload.access_token ?? ''),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : refreshToken,
    acquiredAt,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

async function graphGetUrl<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'IdType="ImmutableId"',
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const error = json?.error?.message || json?.error?.code || 'Microsoft Graph request failed.';
    throw new Error(error);
  }
  return json as T;
}

async function graphGet<T>(token: string, path: string): Promise<T> {
  return graphGetUrl<T>(token, `${GRAPH_ROOT}${path}`);
}

export async function fetchMailboxProfile(token: string): Promise<OutlookMailboxProfile> {
  const json = await graphGet<Record<string, unknown>>(token, '/me?$select=id,displayName,mail,userPrincipalName');
  return {
    userId: String(json.id ?? ''),
    displayName: String(json.displayName ?? ''),
    email: String(json.mail ?? json.userPrincipalName ?? ''),
  };
}

function mapRecipient(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const emailAddress = (entry as { emailAddress?: { address?: string; name?: string } }).emailAddress;
      if (!emailAddress) return '';
      return emailAddress.name ? `${emailAddress.name} <${emailAddress.address ?? ''}>` : (emailAddress.address ?? '');
    })
    .filter(Boolean);
}

function mapImportance(raw: unknown): 'low' | 'normal' | 'high' {
  const value = String(raw ?? 'normal').toLowerCase();
  if (value === 'low' || value === 'high') return value;
  return 'normal';
}

function mapMessage(message: Record<string, unknown>, folder: OutlookFolderName): OutlookMessage | null {
  if ((message as { ['@removed']?: unknown })['@removed']) return null;
  const sender = (message.from as { emailAddress?: { address?: string; name?: string } } | undefined)?.emailAddress;
  const from = sender?.name ? `${sender.name} <${sender.address ?? ''}>` : String(sender?.address ?? 'Unknown sender');
  const flagStatus = (message.flag as { flagStatus?: string } | undefined)?.flagStatus;
  return {
    id: String(message.id ?? ''),
    internetMessageId: message.internetMessageId ? String(message.internetMessageId) : undefined,
    conversationId: message.conversationId ? String(message.conversationId) : undefined,
    subject: String(message.subject ?? '(no subject)'),
    bodyPreview: String(message.bodyPreview ?? ''),
    from,
    toRecipients: mapRecipient(message.toRecipients),
    ccRecipients: mapRecipient(message.ccRecipients),
    receivedDateTime: message.receivedDateTime ? String(message.receivedDateTime) : undefined,
    sentDateTime: message.sentDateTime ? String(message.sentDateTime) : undefined,
    isRead: Boolean(message.isRead),
    importance: mapImportance(message.importance),
    hasAttachments: Boolean(message.hasAttachments),
    categories: Array.isArray(message.categories) ? message.categories.map((entry) => String(entry)) : [],
    flagStatus: flagStatus ? String(flagStatus) : undefined,
    webLink: message.webLink ? String(message.webLink) : undefined,
    folder,
    sourceRef: `Outlook/${folder}/${String(message.id ?? '')}`,
  };
}

export async function fetchMessages(token: string, folder: OutlookFolderName, limit: number): Promise<OutlookMessage[]> {
  const query = `/me/mailFolders/${folder}/messages?$top=${limit}&$orderby=${folder === 'sentitems' ? 'sentDateTime desc' : 'receivedDateTime desc'}&$select=${encodeURIComponent(selectClause())}`;
  const json = await graphGet<{ value?: Array<Record<string, unknown>> }>(token, query);
  return (json.value ?? []).map((message) => mapMessage(message, folder)).filter((message): message is OutlookMessage => Boolean(message));
}

export async function fetchDeltaMessages(
  token: string,
  folder: OutlookFolderName,
  limit: number,
  deltaLink?: string,
): Promise<{ messages: OutlookMessage[]; removedIds: string[]; deltaLink?: string; usedDelta: boolean }> {
  let url = deltaLink
    ? deltaLink
    : `${GRAPH_ROOT}/me/mailFolders/${folder}/messages/delta?$top=${Math.max(10, limit)}&$select=${encodeURIComponent(selectClause())}`;
  const messages: OutlookMessage[] = [];
  const removedIds: string[] = [];
  let latestDeltaLink = deltaLink;
  let pageCount = 0;

  while (url && pageCount < 6) {
    const json = await graphGetUrl<Record<string, unknown>>(token, url);
    const values = Array.isArray(json.value) ? (json.value as Array<Record<string, unknown>>) : [];
    values.forEach((entry) => {
      if ((entry as { ['@removed']?: unknown })['@removed']) {
        if (entry.id) removedIds.push(String(entry.id));
        return;
      }
      const mapped = mapMessage(entry, folder);
      if (mapped) messages.push(mapped);
    });

    latestDeltaLink = typeof json['@odata.deltaLink'] === 'string' ? String(json['@odata.deltaLink']) : latestDeltaLink;
    url = typeof json['@odata.nextLink'] === 'string' ? String(json['@odata.nextLink']) : '';
    pageCount += 1;
    if (!deltaLink && messages.length >= limit && latestDeltaLink) {
      break;
    }
  }

  return {
    messages,
    removedIds: [...new Set(removedIds)],
    deltaLink: latestDeltaLink,
    usedDelta: Boolean(deltaLink),
  };
}

export function isTokenExpired(token?: OutlookTokenSet): boolean {
  if (!token?.expiresAt) return true;
  return new Date(token.expiresAt).getTime() <= Date.now() + 60_000;
}
