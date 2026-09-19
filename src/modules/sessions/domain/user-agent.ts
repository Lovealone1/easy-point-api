/**
 * Turns a raw `User-Agent` header into something a person can recognise in a
 * session list: "Chrome 140 on Windows", "Safari on iPhone".
 *
 * Hand-rolled rather than pulled from a library on purpose. The two obvious
 * candidates are `ua-parser-js`, whose 2.x line is AGPL unless you buy a
 * licence, and `useragent`, which is unmaintained. Neither is worth taking on
 * for what this needs: a session list wants a recognisable label, not a
 * forensic device database, and a wrong guess here costs a slightly vague row
 * — not a security decision. Nothing downstream branches on this output.
 *
 * Order matters in every table below. Every Chromium browser says "Chrome" in
 * its UA, and Chrome itself says "Safari", so the specific brands have to be
 * tested before the generic ones.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceDescription {
  /** `null` when the agent is a bot or an unrecognisable string. */
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  type: DeviceType;
  /** Ready to render: "Chrome 140 on macOS". Never empty. */
  label: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
}

/** Non-browser callers. Worth naming — a script in a session list is news. */
const CLIENT_RULES: readonly Rule[] = [
  { name: 'Postman', pattern: /PostmanRuntime\/([\d.]+)/ },
  { name: 'Insomnia', pattern: /insomnia\/([\d.]+)/i },
  { name: 'curl', pattern: /curl\/([\d.]+)/i },
  { name: 'Wget', pattern: /Wget\/([\d.]+)/i },
  { name: 'HTTPie', pattern: /HTTPie\/([\d.]+)/i },
  { name: 'axios', pattern: /axios\/([\d.]+)/i },
  { name: 'Node.js', pattern: /node-fetch\/([\d.]+)/i },
  { name: 'Python requests', pattern: /python-requests\/([\d.]+)/i },
  { name: 'Go', pattern: /Go-http-client\/([\d.]+)/i },
  { name: 'OkHttp', pattern: /okhttp\/([\d.]+)/i },
];

const BROWSER_RULES: readonly Rule[] = [
  // Edge, in its four disguises: iOS, Android, Chromium desktop, legacy.
  { name: 'Edge', pattern: /Edg(?:iOS|A|e)?\/([\d.]+)/ },
  { name: 'Opera', pattern: /(?:OPR|OPiOS|OPT)\/([\d.]+)/ },
  { name: 'Opera', pattern: /Opera[ /]([\d.]+)/ },
  { name: 'Samsung Internet', pattern: /SamsungBrowser\/([\d.]+)/ },
  { name: 'Yandex', pattern: /YaBrowser\/([\d.]+)/ },
  { name: 'Vivaldi', pattern: /Vivaldi\/([\d.]+)/ },
  { name: 'Brave', pattern: /Brave\/([\d.]+)/ },
  { name: 'UC Browser', pattern: /UCBrowser\/([\d.]+)/ },
  { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: 'Internet Explorer', pattern: /(?:MSIE |rv:)([\d.]+)\)?.*Trident/ },
  { name: 'Chrome', pattern: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: 'Chromium', pattern: /Chromium\/([\d.]+)/ },
  // Safari reports the browser release in `Version/`; the `Safari/` token
  // carries a WebKit build number that means nothing to a reader.
  { name: 'Safari', pattern: /Version\/([\d.]+).*Safari\// },
  { name: 'Safari', pattern: /Safari\/([\d.]+)/ },
];

/**
 * Windows never reports a marketing name, only an NT kernel version — and it
 * stopped moving at 10.0, which covers both Windows 10 and 11. Reporting
 * "10 or 11" is less useful than reporting nothing, so that one collapses to
 * a bare "Windows".
 */
const WINDOWS_NT_NAMES: Record<string, string | null> = {
  '10.0': null,
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
  '6.0': 'Vista',
  '5.1': 'XP',
};

function matchOs(ua: string): { os: string | null; osVersion: string | null } {
  const windows = /Windows NT ([\d.]+)/.exec(ua);
  if (windows) return { os: 'Windows', osVersion: WINDOWS_NT_NAMES[windows[1]] ?? null };
  if (/Windows Phone/.test(ua)) return { os: 'Windows Phone', osVersion: null };
  if (/Windows/.test(ua)) return { os: 'Windows', osVersion: null };

  // Android has to precede Linux: every Android UA also says "Linux".
  const android = /Android[ /]([\d.]+)/.exec(ua);
  if (android) return { os: 'Android', osVersion: android[1] };
  if (/Android/.test(ua)) return { os: 'Android', osVersion: null };

  const ipad = /iPad;.*?OS ([\d_]+)/.exec(ua);
  if (ipad) return { os: 'iPadOS', osVersion: normalizeVersion(ipad[1]) };

  const iphone = /(?:iPhone|iPod).*?OS ([\d_]+)/.exec(ua);
  if (iphone) return { os: 'iOS', osVersion: normalizeVersion(iphone[1]) };
  if (/iPhone|iPod/.test(ua)) return { os: 'iOS', osVersion: null };
  if (/iPad/.test(ua)) return { os: 'iPadOS', osVersion: null };

  if (/CrOS/.test(ua)) return { os: 'ChromeOS', osVersion: null };

  const mac = /Mac OS X ([\d_.]+)/.exec(ua);
  if (mac) return { os: 'macOS', osVersion: normalizeVersion(mac[1]) };
  if (/Macintosh|Mac OS X/.test(ua)) return { os: 'macOS', osVersion: null };

  if (/Ubuntu/.test(ua)) return { os: 'Ubuntu', osVersion: null };
  if (/Linux/.test(ua)) return { os: 'Linux', osVersion: null };
  if (/FreeBSD|OpenBSD|NetBSD|SunOS|X11/.test(ua)) return { os: 'Unix', osVersion: null };

  return { os: null, osVersion: null };
}

function matchDeviceType(ua: string, os: string | null): DeviceType {
  if (os === 'iPadOS' || /\b(iPad|Tablet|PlayBook|Silk|Kindle)\b/.test(ua)) return 'tablet';
  // An Android UA without the "Mobile" token is a tablet; with it, a phone.
  if (os === 'Android') return /Mobile/.test(ua) ? 'mobile' : 'tablet';
  if (/Mobi|iPhone|iPod|Windows Phone|Opera Mini|IEMobile/.test(ua)) return 'mobile';
  if (os !== null) return 'desktop';
  return 'unknown';
}

/** iOS writes versions with underscores ("17_5_1"); everyone else uses dots. */
function normalizeVersion(raw: string): string {
  return raw.replace(/_/g, '.');
}

/**
 * Only the major component survives in the label. "Chrome 140" is readable;
 * "Chrome 140.0.7339.208" is noise, and it changes every fortnight, which
 * makes one browser look like a different device after every auto-update.
 * The full string is still returned in `browserVersion` for anyone who wants
 * it.
 */
function shortenVersion(raw: string | null): string | null {
  if (!raw) return null;
  const [major] = raw.split('.');
  return /^\d+$/.test(major) ? major : null;
}

function firstMatch(
  ua: string,
  rules: readonly Rule[],
): { name: string; version: string | null } | null {
  for (const rule of rules) {
    const match = rule.pattern.exec(ua);
    if (match) {
      return { name: rule.name, version: match[1] ? normalizeVersion(match[1]) : null };
    }
  }
  return null;
}

function buildLabel(
  browser: string | null,
  browserVersion: string | null,
  os: string | null,
  osVersion: string | null,
): string {
  const left = browser ? [browser, shortenVersion(browserVersion)].filter(Boolean).join(' ') : null;
  const right = os ? [os, osVersion].filter(Boolean).join(' ') : null;

  if (left && right) return `${left} on ${right}`;
  return left ?? right ?? 'Unknown device';
}

/**
 * Never throws and never returns an empty label: this feeds a UI row, and a
 * malformed header must not be able to break a user's session list.
 */
export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const ua = (userAgent ?? '').trim();

  if (ua === '' || ua.toLowerCase() === 'unknown') {
    return {
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      type: 'unknown',
      label: 'Unknown device',
    };
  }

  if (/\b(bot|crawler|spider|crawling|slurp|bingpreview|headlesschrome)\b/i.test(ua)) {
    return {
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      type: 'bot',
      label: 'Automated client',
    };
  }

  const { os, osVersion } = matchOs(ua);

  // API clients are matched before browsers because several of them embed a
  // browser token — and because "Postman" is the useful answer, not "Chrome".
  const client = firstMatch(ua, CLIENT_RULES);
  if (client) {
    return {
      browser: client.name,
      browserVersion: client.version,
      os,
      osVersion,
      type: os === null ? 'unknown' : matchDeviceType(ua, os),
      label: buildLabel(client.name, client.version, os, osVersion),
    };
  }

  const browser = firstMatch(ua, BROWSER_RULES);

  return {
    browser: browser?.name ?? null,
    browserVersion: browser?.version ?? null,
    os,
    osVersion,
    type: matchDeviceType(ua, os),
    label: buildLabel(browser?.name ?? null, browser?.version ?? null, os, osVersion),
  };
}
