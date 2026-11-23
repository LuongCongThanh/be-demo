import { BadGatewayException } from '@nestjs/common';

export async function postJson(
  url: string,
  payload: Record<string, string | number>,
  providerName: string,
): Promise<Record<string, unknown>> {
  const response = await sendRequest(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    },
    providerName,
  );
  if (!response.ok) throw new BadGatewayException(`${providerName} returned HTTP ${response.status}`);
  return readJsonObject(response, providerName);
}

export async function postForm(
  url: string,
  payload: URLSearchParams,
  providerName: string,
): Promise<Record<string, unknown>> {
  const response = await sendRequest(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      signal: AbortSignal.timeout(10_000),
    },
    providerName,
  );
  if (!response.ok) throw new BadGatewayException(`${providerName} returned HTTP ${response.status}`);
  return readJsonObject(response, providerName);
}

async function readJsonObject(response: Response, providerName: string): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BadGatewayException(`${providerName} returned invalid JSON`);
  }
  if (!isRecord(body)) {
    throw new BadGatewayException(`${providerName} returned an invalid response`);
  }
  return body;
}

async function sendRequest(url: string, init: RequestInit, providerName: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new BadGatewayException(`${providerName} is unavailable`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
