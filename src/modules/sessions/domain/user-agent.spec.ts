import { describeUserAgent } from './user-agent.js';

describe('describeUserAgent', () => {
  // Real strings, copied from the browsers they belong to. Synthetic ones
  // would pass any parser, including a wrong one.
  const AGENTS = {
    chromeWindows:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    edgeWindows:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.81',
    operaWindows:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/124.0.0.0',
    safariMac:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    safariIphone:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    chromeIphone:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    chromeAndroidPhone:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    chromeAndroidTablet:
      'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    safariIpad:
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    samsung:
      'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    postman: 'PostmanRuntime/7.43.0',
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  };

  it.each([
    ['chromeWindows', 'Chrome 140 on Windows'],
    ['edgeWindows', 'Edge 140 on Windows'],
    ['operaWindows', 'Opera 124 on Windows'],
    ['safariMac', 'Safari 18 on macOS 10.15.7'],
    ['firefoxLinux', 'Firefox 131 on Linux'],
    ['safariIphone', 'Safari 18 on iOS 18.5'],
    ['chromeIphone', 'Chrome 126 on iOS 17.5'],
    ['chromeAndroidPhone', 'Chrome 140 on Android 14'],
    ['samsung', 'Samsung Internet 23 on Android 13'],
    ['safariIpad', 'Safari 17 on iPadOS 17.5'],
  ] as const)('labels %s as "%s"', (key, expected) => {
    expect(describeUserAgent(AGENTS[key]).label).toBe(expected);
  });

  describe('the brands that hide behind Chrome', () => {
    // Every Chromium browser carries a `Chrome/` token, and Chrome itself
    // carries `Safari/`. Getting these right is the whole reason the rule
    // tables are ordered rather than alphabetical.
    it.each([
      ['edgeWindows', 'Edge'],
      ['operaWindows', 'Opera'],
      ['samsung', 'Samsung Internet'],
      ['chromeWindows', 'Chrome'],
      ['safariMac', 'Safari'],
    ] as const)('reads %s as %s, not the brand it impersonates', (key, browser) => {
      expect(describeUserAgent(AGENTS[key]).browser).toBe(browser);
    });
  });

  describe('device type', () => {
    it('separates an Android phone from an Android tablet by the Mobile token', () => {
      expect(describeUserAgent(AGENTS.chromeAndroidPhone).type).toBe('mobile');
      expect(describeUserAgent(AGENTS.chromeAndroidTablet).type).toBe('tablet');
    });

    it('calls an iPad a tablet and an iPhone a phone', () => {
      expect(describeUserAgent(AGENTS.safariIpad).type).toBe('tablet');
      expect(describeUserAgent(AGENTS.safariIphone).type).toBe('mobile');
    });

    it('calls a desktop browser a desktop', () => {
      expect(describeUserAgent(AGENTS.chromeWindows).type).toBe('desktop');
      expect(describeUserAgent(AGENTS.safariMac).type).toBe('desktop');
    });
  });

  it('names an API client instead of guessing at a browser', () => {
    const postman = describeUserAgent(AGENTS.postman);
    expect(postman.browser).toBe('Postman');
    expect(postman.label).toBe('Postman 7');
  });

  it('flags a crawler rather than dressing it up as a device', () => {
    const bot = describeUserAgent(AGENTS.googlebot);
    expect(bot.type).toBe('bot');
    expect(bot.label).toBe('Automated client');
  });

  it('reports Windows without a version rather than claiming "10 or 11"', () => {
    // NT 10.0 covers both, so a version here would be a guess presented as a
    // fact. Older kernels do map to a name people recognise.
    expect(describeUserAgent(AGENTS.chromeWindows).osVersion).toBeNull();
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 6.1; Win64; x64) Chrome/109.0.0.0 Safari/537.36')
        .osVersion,
    ).toBe('7');
  });

  describe('never breaks the session list', () => {
    // These all arrive in production. `getSessions` must render a row for
    // each of them rather than throwing on the way to the screen.
    it.each([
      ['an empty string', ''],
      ['whitespace', '   '],
      ['the literal the middleware substitutes', 'unknown'],
      ['a truncated header', 'Mozilla/5.0 (Windows'],
      ['something that is not a UA at all', '¯\\_(ツ)_/¯'],
    ])('survives %s', (_name, ua) => {
      const result = describeUserAgent(ua);
      expect(result.label.length).toBeGreaterThan(0);
    });

    it.each([[null], [undefined]])('survives %p', value => {
      expect(describeUserAgent(value).label).toBe('Unknown device');
    });
  });
});
