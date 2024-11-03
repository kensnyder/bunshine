import bunshinePkg from '../../../package.json';
import dasherize from '../../dasherize/dasherize.ts';
import {
  CSPDirectives,
  CSPSource,
  PermittedApis,
  ReportOptions,
  SandboxOptions,
  SecurityHeaderValue,
} from './securityHeaders.types.ts';

export default function serialize(
  dasherizedName: string,
  value: SecurityHeaderValue | PermittedApis | CSPDirectives | string
): string | null {
  if (value === false || value === null || value === undefined) {
    return null;
  }
  if (dasherizedName === 'x-powered-by' && value === true) {
    return `Bunshine v${bunshinePkg.version}`;
  } else if (dasherizedName === 'content-security-policy') {
    return _getCspHeader(value as CSPDirectives);
  } else if (dasherizedName === 'permissions-policy') {
    return _getPpHeader(value as PermittedApis);
  }
  return String(value);
}

export function _getCspHeader(directives: CSPDirectives) {
  const items: string[] = [];
  for (const [key, originalValue] of Object.entries(directives)) {
    let value:
      | true
      | CSPSource[]
      | SandboxOptions
      | ReportOptions
      | string
      | undefined = originalValue;
    if (key === 'sandbox' && typeof value === 'object') {
      value = _getSandboxString(value as SandboxOptions);
    } else if (key === 'report' && typeof value === 'object') {
      value = _getReportString(value as ReportOptions);
    } else if (Array.isArray(value) && value.length > 0) {
      value = [...new Set(value)];
      items.push(`${dasherize(key)} ${value.map(_getCspItem).join(' ')}`);
    }
    if (typeof value === 'string' && value !== '') {
      items.push(value);
    }
  }
  return items.join('; ');
}

export function _getCspItem(source: CSPSource) {
  if (typeof source === 'string') {
    return source;
  } else if ('uris' in source) {
    return source.uris.join(' ');
  } else if ('uri' in source) {
    return source.uri;
  } else if ('nonce' in source) {
    return `nonce-${source.nonce}`;
  } else if ('nonces' in source) {
    return source.nonces.map(n => `nonce-${n}`).join(' ');
  } else if ('hash' in source) {
    return source.hash;
  } else if ('hashes' in source) {
    return source.hashes.join(' ');
  }
}

export function _getPpHeader(apis: PermittedApis) {
  const items: string[] = [];
  for (const [name, value] of Object.entries(apis)) {
    items.push(`${dasherize(name)}=(${value.join(' ')})`);
  }
  return items.join(', ');
}

export function _getSandboxString(options: SandboxOptions) {
  const items: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (value) {
      items.push(dasherize(name));
    }
  }
  if (items.length === 0) {
    return '';
  }
  items.unshift('sandbox');
  return items.join(' ');
}

export function _getReportString(reportOption: ReportOptions) {
  if (reportOption.uri) {
    return `report-uri ${reportOption.uri}`;
  }
  if (reportOption.to) {
    return `report-to ${reportOption.to}`;
  }
}
