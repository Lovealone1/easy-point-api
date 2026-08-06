import { PrismaClient } from '@prisma/client';

interface CategorySeedDef {
  key: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface ProviderSeedDef {
  key: string;
  name: string;
  categoryKey: string;
  logoUrl: string;
  brandColor: string;
  websiteUrl?: string;
}

const ICON_CDN = 'https://cdn.simpleicons.org';

export const SUBSCRIPTION_CATEGORIES: CategorySeedDef[] = [
  { key: 'entertainment', name: 'Entretenimiento', icon: 'movie-rounded', color: '#E50914', sortOrder: 1 },
  { key: 'music', name: 'Música', icon: 'music-note-rounded', color: '#1DB954', sortOrder: 2 },
  { key: 'gaming', name: 'Videojuegos', icon: 'sports-esports-rounded', color: '#107C10', sortOrder: 3 },
  { key: 'ai', name: 'Inteligencia Artificial', icon: 'smart-toy-rounded', color: '#6366F1', sortOrder: 4 },
  { key: 'productivity', name: 'Productividad', icon: 'task-alt-rounded', color: '#0052CC', sortOrder: 5 },
  { key: 'cloud', name: 'Almacenamiento en la nube', icon: 'cloud-rounded', color: '#4285F4', sortOrder: 6 },
  { key: 'fitness', name: 'Gimnasio y bienestar', icon: 'fitness-center-rounded', color: '#FF6B00', sortOrder: 7 },
  { key: 'news', name: 'Noticias y lectura', icon: 'newspaper-rounded', color: '#1A8917', sortOrder: 8 },
  { key: 'education', name: 'Educación', icon: 'school-rounded', color: '#F97316', sortOrder: 9 },
  { key: 'other', name: 'Otros', icon: 'category-rounded', color: '#6B7280', sortOrder: 99 },
];

export const SUBSCRIPTION_PROVIDERS: ProviderSeedDef[] = [
  // Entretenimiento
  { key: 'netflix', name: 'Netflix', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/netflix/E50914`, brandColor: '#E50914', websiteUrl: 'https://netflix.com' },
  { key: 'disney-plus', name: 'Disney+', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/disneyplus/113CCF`, brandColor: '#113CCF', websiteUrl: 'https://disneyplus.com' },
  { key: 'hbo-max', name: 'HBO Max', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/hbo/000000`, brandColor: '#000000', websiteUrl: 'https://max.com' },
  { key: 'amazon-prime-video', name: 'Amazon Prime Video', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/primevideo/00A8E1`, brandColor: '#00A8E1', websiteUrl: 'https://primevideo.com' },
  { key: 'youtube-premium', name: 'YouTube Premium', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/youtube/FF0000`, brandColor: '#FF0000', websiteUrl: 'https://youtube.com/premium' },
  { key: 'crunchyroll', name: 'Crunchyroll', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/crunchyroll/F47521`, brandColor: '#F47521', websiteUrl: 'https://crunchyroll.com' },
  { key: 'paramount-plus', name: 'Paramount+', categoryKey: 'entertainment', logoUrl: `${ICON_CDN}/paramountplus/0064FF`, brandColor: '#0064FF', websiteUrl: 'https://paramountplus.com' },

  // Música
  { key: 'spotify', name: 'Spotify', categoryKey: 'music', logoUrl: `${ICON_CDN}/spotify/1DB954`, brandColor: '#1DB954', websiteUrl: 'https://spotify.com' },
  { key: 'apple-music', name: 'Apple Music', categoryKey: 'music', logoUrl: `${ICON_CDN}/applemusic/FA243C`, brandColor: '#FA243C', websiteUrl: 'https://music.apple.com' },
  { key: 'youtube-music', name: 'YouTube Music', categoryKey: 'music', logoUrl: `${ICON_CDN}/youtubemusic/FF0000`, brandColor: '#FF0000', websiteUrl: 'https://music.youtube.com' },
  { key: 'tidal', name: 'Tidal', categoryKey: 'music', logoUrl: `${ICON_CDN}/tidal/000000`, brandColor: '#000000', websiteUrl: 'https://tidal.com' },

  // Videojuegos
  { key: 'playstation-plus', name: 'PlayStation Plus', categoryKey: 'gaming', logoUrl: `${ICON_CDN}/playstation/003791`, brandColor: '#003791', websiteUrl: 'https://playstation.com/ps-plus' },
  { key: 'xbox-game-pass', name: 'Xbox Game Pass', categoryKey: 'gaming', logoUrl: `${ICON_CDN}/xbox/107C10`, brandColor: '#107C10', websiteUrl: 'https://xbox.com/game-pass' },
  { key: 'nintendo-switch-online', name: 'Nintendo Switch Online', categoryKey: 'gaming', logoUrl: `${ICON_CDN}/nintendoswitch/E60012`, brandColor: '#E60012', websiteUrl: 'https://nintendo.com/switch/online' },
  { key: 'ea-play', name: 'EA Play', categoryKey: 'gaming', logoUrl: `${ICON_CDN}/ea/000000`, brandColor: '#000000', websiteUrl: 'https://ea.com/ea-play' },
  { key: 'steam', name: 'Steam', categoryKey: 'gaming', logoUrl: `${ICON_CDN}/steam/000000`, brandColor: '#000000', websiteUrl: 'https://store.steampowered.com' },

  // IA
  { key: 'anthropic', name: 'Claude (Anthropic)', categoryKey: 'ai', logoUrl: `${ICON_CDN}/anthropic/191919`, brandColor: '#191919', websiteUrl: 'https://claude.ai' },
  { key: 'openai', name: 'ChatGPT (OpenAI)', categoryKey: 'ai', logoUrl: `${ICON_CDN}/openai/412991`, brandColor: '#412991', websiteUrl: 'https://chatgpt.com' },
  { key: 'google-gemini', name: 'Google Gemini', categoryKey: 'ai', logoUrl: `${ICON_CDN}/googlegemini/8E75B2`, brandColor: '#8E75B2', websiteUrl: 'https://gemini.google.com' },
  { key: 'midjourney', name: 'Midjourney', categoryKey: 'ai', logoUrl: `${ICON_CDN}/midjourney/000000`, brandColor: '#000000', websiteUrl: 'https://midjourney.com' },
  { key: 'perplexity', name: 'Perplexity', categoryKey: 'ai', logoUrl: `${ICON_CDN}/perplexity/1FB8CD`, brandColor: '#1FB8CD', websiteUrl: 'https://perplexity.ai' },
  { key: 'github-copilot', name: 'GitHub Copilot', categoryKey: 'ai', logoUrl: `${ICON_CDN}/githubcopilot/000000`, brandColor: '#000000', websiteUrl: 'https://github.com/features/copilot' },

  // Productividad
  { key: 'notion', name: 'Notion', categoryKey: 'productivity', logoUrl: `${ICON_CDN}/notion/000000`, brandColor: '#000000', websiteUrl: 'https://notion.so' },
  { key: 'microsoft-365', name: 'Microsoft 365', categoryKey: 'productivity', logoUrl: `${ICON_CDN}/microsoftoffice/D83B01`, brandColor: '#D83B01', websiteUrl: 'https://microsoft.com/microsoft-365' },
  { key: 'canva', name: 'Canva Pro', categoryKey: 'productivity', logoUrl: `${ICON_CDN}/canva/00C4CC`, brandColor: '#00C4CC', websiteUrl: 'https://canva.com' },
  { key: 'adobe-creative-cloud', name: 'Adobe Creative Cloud', categoryKey: 'productivity', logoUrl: `${ICON_CDN}/adobe/FF0000`, brandColor: '#FF0000', websiteUrl: 'https://adobe.com/creativecloud' },
  { key: 'figma', name: 'Figma', categoryKey: 'productivity', logoUrl: `${ICON_CDN}/figma/F24E1E`, brandColor: '#F24E1E', websiteUrl: 'https://figma.com' },

  // Cloud
  { key: 'google-one', name: 'Google One', categoryKey: 'cloud', logoUrl: `${ICON_CDN}/google/4285F4`, brandColor: '#4285F4', websiteUrl: 'https://one.google.com' },
  { key: 'icloud-plus', name: 'iCloud+', categoryKey: 'cloud', logoUrl: `${ICON_CDN}/icloud/3693F3`, brandColor: '#3693F3', websiteUrl: 'https://icloud.com' },
  { key: 'dropbox', name: 'Dropbox', categoryKey: 'cloud', logoUrl: `${ICON_CDN}/dropbox/0061FF`, brandColor: '#0061FF', websiteUrl: 'https://dropbox.com' },

  // Gimnasio y bienestar
  { key: 'smartfit', name: 'Smart Fit', categoryKey: 'fitness', logoUrl: `${ICON_CDN}/smartfit/EE2C24`, brandColor: '#EE2C24', websiteUrl: 'https://smartfit.com' },
  { key: 'strava', name: 'Strava', categoryKey: 'fitness', logoUrl: `${ICON_CDN}/strava/FC4C02`, brandColor: '#FC4C02', websiteUrl: 'https://strava.com' },

  // Noticias
  { key: 'medium', name: 'Medium', categoryKey: 'news', logoUrl: `${ICON_CDN}/medium/000000`, brandColor: '#000000', websiteUrl: 'https://medium.com' },

  // Educación
  { key: 'duolingo', name: 'Duolingo Plus', categoryKey: 'education', logoUrl: `${ICON_CDN}/duolingo/58CC02`, brandColor: '#58CC02', websiteUrl: 'https://duolingo.com' },
  { key: 'udemy', name: 'Udemy', categoryKey: 'education', logoUrl: `${ICON_CDN}/udemy/A435F0`, brandColor: '#A435F0', websiteUrl: 'https://udemy.com' },
];

export async function seedSubscriptionCatalog(prisma: PrismaClient) {
  console.log('\n🌱 Seeding subscription catalog (categories + providers)...');

  const categoryIdByKey = new Map<string, string>();
  let categoriesUpserted = 0;

  for (const def of SUBSCRIPTION_CATEGORIES) {
    const category = await prisma.subscriptionCategory.upsert({
      where: { key: def.key },
      update: { name: def.name, icon: def.icon, color: def.color, sortOrder: def.sortOrder, isActive: true },
      create: { key: def.key, name: def.name, icon: def.icon, color: def.color, sortOrder: def.sortOrder, isActive: true },
    });
    categoryIdByKey.set(def.key, category.id);
    categoriesUpserted++;
    console.log(`  ✅ Category: ${category.name}`);
  }

  let providersUpserted = 0;
  for (const def of SUBSCRIPTION_PROVIDERS) {
    const categoryId = categoryIdByKey.get(def.categoryKey);
    if (!categoryId) {
      throw new Error(`Unknown category key "${def.categoryKey}" for provider "${def.key}"`);
    }

    const provider = await prisma.subscriptionProvider.upsert({
      where: { key: def.key },
      update: {
        name: def.name,
        categoryId,
        logoUrl: def.logoUrl,
        brandColor: def.brandColor,
        websiteUrl: def.websiteUrl ?? null,
        isActive: true,
      },
      create: {
        key: def.key,
        name: def.name,
        categoryId,
        logoUrl: def.logoUrl,
        brandColor: def.brandColor,
        websiteUrl: def.websiteUrl ?? null,
        isActive: true,
      },
    });
    providersUpserted++;
    console.log(`  ✅ Provider: ${provider.name}`);
  }

  return { categoriesUpserted, providersUpserted };
}
