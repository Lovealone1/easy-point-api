import { PrismaClient } from '@prisma/client';

interface CurrencySeedDef {
  code: string;
  numericCode: string;
  name: string;
  nameEs: string;
  symbol?: string;
  /** ISO 4217 minor unit. Omitted means 2. */
  decimalDigits?: number;
}

/**
 * Currencies pinned to the top of every picker, in this order. Latin America
 * first because that is where the product's users are, then the majors people
 * actually pay subscriptions in.
 */
const POPULAR_ORDER = [
  'COP', 'USD', 'EUR', 'MXN', 'ARS', 'BRL', 'CLP', 'PEN', 'GBP', 'CAD',
];

/**
 * ISO 4217 active currency list. Hardcoded on purpose: the picker and the
 * validation of a subscription's currency must work with no network and no
 * third-party availability. Exchange *rates* come from the FX provider; the
 * list of currencies does not.
 *
 * decimalDigits follows the ISO minor unit, not local writing habits — COP is
 * 2 even though Colombians never write cents. Formatting is the frontend's job.
 */
export const CURRENCIES: CurrencySeedDef[] = [
  { code: 'AED', numericCode: '784', name: 'UAE Dirham', nameEs: 'Dirham de los Emiratos Árabes Unidos', symbol: 'د.إ' },
  { code: 'AFN', numericCode: '971', name: 'Afghani', nameEs: 'Afgani afgano', symbol: '؋' },
  { code: 'ALL', numericCode: '008', name: 'Lek', nameEs: 'Lek albanés', symbol: 'L' },
  { code: 'AMD', numericCode: '051', name: 'Armenian Dram', nameEs: 'Dram armenio', symbol: '֏' },
  { code: 'ANG', numericCode: '532', name: 'Netherlands Antillean Guilder', nameEs: 'Florín antillano neerlandés', symbol: 'ƒ' },
  { code: 'AOA', numericCode: '973', name: 'Kwanza', nameEs: 'Kwanza angoleño', symbol: 'Kz' },
  { code: 'ARS', numericCode: '032', name: 'Argentine Peso', nameEs: 'Peso argentino', symbol: '$' },
  { code: 'AUD', numericCode: '036', name: 'Australian Dollar', nameEs: 'Dólar australiano', symbol: 'A$' },
  { code: 'AWG', numericCode: '533', name: 'Aruban Florin', nameEs: 'Florín arubeño', symbol: 'ƒ' },
  { code: 'AZN', numericCode: '944', name: 'Azerbaijan Manat', nameEs: 'Manat azerbaiyano', symbol: '₼' },
  { code: 'BAM', numericCode: '977', name: 'Convertible Mark', nameEs: 'Marco convertible', symbol: 'KM' },
  { code: 'BBD', numericCode: '052', name: 'Barbados Dollar', nameEs: 'Dólar de Barbados', symbol: '$' },
  { code: 'BDT', numericCode: '050', name: 'Taka', nameEs: 'Taka bangladesí', symbol: '৳' },
  { code: 'BGN', numericCode: '975', name: 'Bulgarian Lev', nameEs: 'Lev búlgaro', symbol: 'лв' },
  { code: 'BHD', numericCode: '048', name: 'Bahraini Dinar', nameEs: 'Dinar bahreiní', symbol: '.د.ب', decimalDigits: 3 },
  { code: 'BIF', numericCode: '108', name: 'Burundi Franc', nameEs: 'Franco burundés', symbol: 'FBu', decimalDigits: 0 },
  { code: 'BMD', numericCode: '060', name: 'Bermudian Dollar', nameEs: 'Dólar bermudeño', symbol: '$' },
  { code: 'BND', numericCode: '096', name: 'Brunei Dollar', nameEs: 'Dólar de Brunéi', symbol: '$' },
  { code: 'BOB', numericCode: '068', name: 'Boliviano', nameEs: 'Boliviano', symbol: 'Bs.' },
  { code: 'BRL', numericCode: '986', name: 'Brazilian Real', nameEs: 'Real brasileño', symbol: 'R$' },
  { code: 'BSD', numericCode: '044', name: 'Bahamian Dollar', nameEs: 'Dólar bahameño', symbol: '$' },
  { code: 'BTN', numericCode: '064', name: 'Ngultrum', nameEs: 'Ngultrum butanés', symbol: 'Nu.' },
  { code: 'BWP', numericCode: '072', name: 'Pula', nameEs: 'Pula de Botsuana', symbol: 'P' },
  { code: 'BYN', numericCode: '933', name: 'Belarusian Ruble', nameEs: 'Rublo bielorruso', symbol: 'Br' },
  { code: 'BZD', numericCode: '084', name: 'Belize Dollar', nameEs: 'Dólar beliceño', symbol: 'BZ$' },
  { code: 'CAD', numericCode: '124', name: 'Canadian Dollar', nameEs: 'Dólar canadiense', symbol: 'CA$' },
  { code: 'CDF', numericCode: '976', name: 'Congolese Franc', nameEs: 'Franco congoleño', symbol: 'FC' },
  { code: 'CHF', numericCode: '756', name: 'Swiss Franc', nameEs: 'Franco suizo', symbol: 'CHF' },
  { code: 'CLP', numericCode: '152', name: 'Chilean Peso', nameEs: 'Peso chileno', symbol: '$', decimalDigits: 0 },
  { code: 'CNY', numericCode: '156', name: 'Yuan Renminbi', nameEs: 'Yuan chino', symbol: '¥' },
  { code: 'COP', numericCode: '170', name: 'Colombian Peso', nameEs: 'Peso colombiano', symbol: '$' },
  { code: 'CRC', numericCode: '188', name: 'Costa Rican Colon', nameEs: 'Colón costarricense', symbol: '₡' },
  { code: 'CUP', numericCode: '192', name: 'Cuban Peso', nameEs: 'Peso cubano', symbol: '$' },
  { code: 'CVE', numericCode: '132', name: 'Cabo Verde Escudo', nameEs: 'Escudo caboverdiano', symbol: '$' },
  { code: 'CZK', numericCode: '203', name: 'Czech Koruna', nameEs: 'Corona checa', symbol: 'Kč' },
  { code: 'DJF', numericCode: '262', name: 'Djibouti Franc', nameEs: 'Franco yibutiano', symbol: 'Fdj', decimalDigits: 0 },
  { code: 'DKK', numericCode: '208', name: 'Danish Krone', nameEs: 'Corona danesa', symbol: 'kr' },
  { code: 'DOP', numericCode: '214', name: 'Dominican Peso', nameEs: 'Peso dominicano', symbol: 'RD$' },
  { code: 'DZD', numericCode: '012', name: 'Algerian Dinar', nameEs: 'Dinar argelino', symbol: 'د.ج' },
  { code: 'EGP', numericCode: '818', name: 'Egyptian Pound', nameEs: 'Libra egipcia', symbol: '£' },
  { code: 'ERN', numericCode: '232', name: 'Nakfa', nameEs: 'Nakfa eritreo', symbol: 'Nfk' },
  { code: 'ETB', numericCode: '230', name: 'Ethiopian Birr', nameEs: 'Birr etíope', symbol: 'Br' },
  { code: 'EUR', numericCode: '978', name: 'Euro', nameEs: 'Euro', symbol: '€' },
  { code: 'FJD', numericCode: '242', name: 'Fiji Dollar', nameEs: 'Dólar fiyiano', symbol: '$' },
  { code: 'FKP', numericCode: '238', name: 'Falkland Islands Pound', nameEs: 'Libra malvinense', symbol: '£' },
  { code: 'GBP', numericCode: '826', name: 'Pound Sterling', nameEs: 'Libra esterlina', symbol: '£' },
  { code: 'GEL', numericCode: '981', name: 'Lari', nameEs: 'Lari georgiano', symbol: '₾' },
  { code: 'GHS', numericCode: '936', name: 'Ghana Cedi', nameEs: 'Cedi ghanés', symbol: '₵' },
  { code: 'GIP', numericCode: '292', name: 'Gibraltar Pound', nameEs: 'Libra gibraltareña', symbol: '£' },
  { code: 'GMD', numericCode: '270', name: 'Dalasi', nameEs: 'Dalasi gambiano', symbol: 'D' },
  { code: 'GNF', numericCode: '324', name: 'Guinean Franc', nameEs: 'Franco guineano', symbol: 'FG', decimalDigits: 0 },
  { code: 'GTQ', numericCode: '320', name: 'Quetzal', nameEs: 'Quetzal guatemalteco', symbol: 'Q' },
  { code: 'GYD', numericCode: '328', name: 'Guyana Dollar', nameEs: 'Dólar guyanés', symbol: '$' },
  { code: 'HKD', numericCode: '344', name: 'Hong Kong Dollar', nameEs: 'Dólar de Hong Kong', symbol: 'HK$' },
  { code: 'HNL', numericCode: '340', name: 'Lempira', nameEs: 'Lempira hondureño', symbol: 'L' },
  { code: 'HRK', numericCode: '191', name: 'Kuna', nameEs: 'Kuna croata', symbol: 'kn' },
  { code: 'HTG', numericCode: '332', name: 'Gourde', nameEs: 'Gourde haitiano', symbol: 'G' },
  { code: 'HUF', numericCode: '348', name: 'Forint', nameEs: 'Forinto húngaro', symbol: 'Ft' },
  { code: 'IDR', numericCode: '360', name: 'Rupiah', nameEs: 'Rupia indonesia', symbol: 'Rp' },
  { code: 'ILS', numericCode: '376', name: 'New Israeli Sheqel', nameEs: 'Nuevo séquel israelí', symbol: '₪' },
  { code: 'INR', numericCode: '356', name: 'Indian Rupee', nameEs: 'Rupia india', symbol: '₹' },
  { code: 'IQD', numericCode: '368', name: 'Iraqi Dinar', nameEs: 'Dinar iraquí', symbol: 'ع.د', decimalDigits: 3 },
  { code: 'IRR', numericCode: '364', name: 'Iranian Rial', nameEs: 'Rial iraní', symbol: '﷼' },
  { code: 'ISK', numericCode: '352', name: 'Iceland Krona', nameEs: 'Corona islandesa', symbol: 'kr', decimalDigits: 0 },
  { code: 'JMD', numericCode: '388', name: 'Jamaican Dollar', nameEs: 'Dólar jamaiquino', symbol: 'J$' },
  { code: 'JOD', numericCode: '400', name: 'Jordanian Dinar', nameEs: 'Dinar jordano', symbol: 'د.ا', decimalDigits: 3 },
  { code: 'JPY', numericCode: '392', name: 'Yen', nameEs: 'Yen japonés', symbol: '¥', decimalDigits: 0 },
  { code: 'KES', numericCode: '404', name: 'Kenyan Shilling', nameEs: 'Chelín keniano', symbol: 'KSh' },
  { code: 'KGS', numericCode: '417', name: 'Som', nameEs: 'Som kirguís', symbol: 'с' },
  { code: 'KHR', numericCode: '116', name: 'Riel', nameEs: 'Riel camboyano', symbol: '៛' },
  { code: 'KMF', numericCode: '174', name: 'Comorian Franc', nameEs: 'Franco comorense', symbol: 'CF', decimalDigits: 0 },
  { code: 'KPW', numericCode: '408', name: 'North Korean Won', nameEs: 'Won norcoreano', symbol: '₩' },
  { code: 'KRW', numericCode: '410', name: 'Won', nameEs: 'Won surcoreano', symbol: '₩', decimalDigits: 0 },
  { code: 'KWD', numericCode: '414', name: 'Kuwaiti Dinar', nameEs: 'Dinar kuwaití', symbol: 'د.ك', decimalDigits: 3 },
  { code: 'KYD', numericCode: '136', name: 'Cayman Islands Dollar', nameEs: 'Dólar de las Islas Caimán', symbol: '$' },
  { code: 'KZT', numericCode: '398', name: 'Tenge', nameEs: 'Tenge kazajo', symbol: '₸' },
  { code: 'LAK', numericCode: '418', name: 'Lao Kip', nameEs: 'Kip laosiano', symbol: '₭' },
  { code: 'LBP', numericCode: '422', name: 'Lebanese Pound', nameEs: 'Libra libanesa', symbol: 'ل.ل' },
  { code: 'LKR', numericCode: '144', name: 'Sri Lanka Rupee', nameEs: 'Rupia de Sri Lanka', symbol: 'Rs' },
  { code: 'LRD', numericCode: '430', name: 'Liberian Dollar', nameEs: 'Dólar liberiano', symbol: '$' },
  { code: 'LSL', numericCode: '426', name: 'Loti', nameEs: 'Loti lesotense', symbol: 'L' },
  { code: 'LYD', numericCode: '434', name: 'Libyan Dinar', nameEs: 'Dinar libio', symbol: 'ل.د', decimalDigits: 3 },
  { code: 'MAD', numericCode: '504', name: 'Moroccan Dirham', nameEs: 'Dirham marroquí', symbol: 'د.م.' },
  { code: 'MDL', numericCode: '498', name: 'Moldovan Leu', nameEs: 'Leu moldavo', symbol: 'L' },
  { code: 'MGA', numericCode: '969', name: 'Malagasy Ariary', nameEs: 'Ariary malgache', symbol: 'Ar', decimalDigits: 0 },
  { code: 'MKD', numericCode: '807', name: 'Denar', nameEs: 'Denar macedonio', symbol: 'ден' },
  { code: 'MMK', numericCode: '104', name: 'Kyat', nameEs: 'Kyat birmano', symbol: 'K' },
  { code: 'MNT', numericCode: '496', name: 'Tugrik', nameEs: 'Tugrik mongol', symbol: '₮' },
  { code: 'MOP', numericCode: '446', name: 'Pataca', nameEs: 'Pataca macaense', symbol: 'MOP$' },
  { code: 'MRU', numericCode: '929', name: 'Ouguiya', nameEs: 'Uguiya mauritana', symbol: 'UM' },
  { code: 'MUR', numericCode: '480', name: 'Mauritius Rupee', nameEs: 'Rupia de Mauricio', symbol: '₨' },
  { code: 'MVR', numericCode: '462', name: 'Rufiyaa', nameEs: 'Rufiyaa maldiva', symbol: 'Rf' },
  { code: 'MWK', numericCode: '454', name: 'Malawi Kwacha', nameEs: 'Kwacha malauí', symbol: 'MK' },
  { code: 'MXN', numericCode: '484', name: 'Mexican Peso', nameEs: 'Peso mexicano', symbol: '$' },
  { code: 'MYR', numericCode: '458', name: 'Malaysian Ringgit', nameEs: 'Ringgit malayo', symbol: 'RM' },
  { code: 'MZN', numericCode: '943', name: 'Mozambique Metical', nameEs: 'Metical mozambiqueño', symbol: 'MT' },
  { code: 'NAD', numericCode: '516', name: 'Namibia Dollar', nameEs: 'Dólar namibio', symbol: '$' },
  { code: 'NGN', numericCode: '566', name: 'Naira', nameEs: 'Naira nigeriana', symbol: '₦' },
  { code: 'NIO', numericCode: '558', name: 'Cordoba Oro', nameEs: 'Córdoba nicaragüense', symbol: 'C$' },
  { code: 'NOK', numericCode: '578', name: 'Norwegian Krone', nameEs: 'Corona noruega', symbol: 'kr' },
  { code: 'NPR', numericCode: '524', name: 'Nepalese Rupee', nameEs: 'Rupia nepalí', symbol: '₨' },
  { code: 'NZD', numericCode: '554', name: 'New Zealand Dollar', nameEs: 'Dólar neozelandés', symbol: 'NZ$' },
  { code: 'OMR', numericCode: '512', name: 'Rial Omani', nameEs: 'Rial omaní', symbol: 'ر.ع.', decimalDigits: 3 },
  { code: 'PAB', numericCode: '590', name: 'Balboa', nameEs: 'Balboa panameño', symbol: 'B/.' },
  { code: 'PEN', numericCode: '604', name: 'Sol', nameEs: 'Sol peruano', symbol: 'S/' },
  { code: 'PGK', numericCode: '598', name: 'Kina', nameEs: 'Kina papuana', symbol: 'K' },
  { code: 'PHP', numericCode: '608', name: 'Philippine Peso', nameEs: 'Peso filipino', symbol: '₱' },
  { code: 'PKR', numericCode: '586', name: 'Pakistan Rupee', nameEs: 'Rupia pakistaní', symbol: '₨' },
  { code: 'PLN', numericCode: '985', name: 'Zloty', nameEs: 'Esloti polaco', symbol: 'zł' },
  { code: 'PYG', numericCode: '600', name: 'Guarani', nameEs: 'Guaraní paraguayo', symbol: '₲', decimalDigits: 0 },
  { code: 'QAR', numericCode: '634', name: 'Qatari Rial', nameEs: 'Rial catarí', symbol: 'ر.ق' },
  { code: 'RON', numericCode: '946', name: 'Romanian Leu', nameEs: 'Leu rumano', symbol: 'lei' },
  { code: 'RSD', numericCode: '941', name: 'Serbian Dinar', nameEs: 'Dinar serbio', symbol: 'дин' },
  { code: 'RUB', numericCode: '643', name: 'Russian Ruble', nameEs: 'Rublo ruso', symbol: '₽' },
  { code: 'RWF', numericCode: '646', name: 'Rwanda Franc', nameEs: 'Franco ruandés', symbol: 'FRw', decimalDigits: 0 },
  { code: 'SAR', numericCode: '682', name: 'Saudi Riyal', nameEs: 'Riyal saudí', symbol: 'ر.س' },
  { code: 'SBD', numericCode: '090', name: 'Solomon Islands Dollar', nameEs: 'Dólar salomonense', symbol: '$' },
  { code: 'SCR', numericCode: '690', name: 'Seychelles Rupee', nameEs: 'Rupia seychelense', symbol: '₨' },
  { code: 'SDG', numericCode: '938', name: 'Sudanese Pound', nameEs: 'Libra sudanesa', symbol: 'ج.س.' },
  { code: 'SEK', numericCode: '752', name: 'Swedish Krona', nameEs: 'Corona sueca', symbol: 'kr' },
  { code: 'SGD', numericCode: '702', name: 'Singapore Dollar', nameEs: 'Dólar de Singapur', symbol: 'S$' },
  { code: 'SHP', numericCode: '654', name: 'Saint Helena Pound', nameEs: 'Libra de Santa Elena', symbol: '£' },
  { code: 'SLE', numericCode: '925', name: 'Leone', nameEs: 'Leone sierraleonés', symbol: 'Le' },
  { code: 'SOS', numericCode: '706', name: 'Somali Shilling', nameEs: 'Chelín somalí', symbol: 'Sh' },
  { code: 'SRD', numericCode: '968', name: 'Surinam Dollar', nameEs: 'Dólar surinamés', symbol: '$' },
  { code: 'SSP', numericCode: '728', name: 'South Sudanese Pound', nameEs: 'Libra sursudanesa', symbol: '£' },
  { code: 'STN', numericCode: '930', name: 'Dobra', nameEs: 'Dobra santotomense', symbol: 'Db' },
  { code: 'SVC', numericCode: '222', name: 'El Salvador Colon', nameEs: 'Colón salvadoreño', symbol: '₡' },
  { code: 'SYP', numericCode: '760', name: 'Syrian Pound', nameEs: 'Libra siria', symbol: '£' },
  { code: 'SZL', numericCode: '748', name: 'Lilangeni', nameEs: 'Lilangeni suazi', symbol: 'L' },
  { code: 'THB', numericCode: '764', name: 'Baht', nameEs: 'Baht tailandés', symbol: '฿' },
  { code: 'TJS', numericCode: '972', name: 'Somoni', nameEs: 'Somoni tayiko', symbol: 'ЅМ' },
  { code: 'TMT', numericCode: '934', name: 'Turkmenistan New Manat', nameEs: 'Manat turcomano', symbol: 'm' },
  { code: 'TND', numericCode: '788', name: 'Tunisian Dinar', nameEs: 'Dinar tunecino', symbol: 'د.ت', decimalDigits: 3 },
  { code: 'TOP', numericCode: '776', name: "Pa'anga", nameEs: 'Paanga tongano', symbol: 'T$' },
  { code: 'TRY', numericCode: '949', name: 'Turkish Lira', nameEs: 'Lira turca', symbol: '₺' },
  { code: 'TTD', numericCode: '780', name: 'Trinidad and Tobago Dollar', nameEs: 'Dólar de Trinidad y Tobago', symbol: 'TT$' },
  { code: 'TWD', numericCode: '901', name: 'New Taiwan Dollar', nameEs: 'Nuevo dólar taiwanés', symbol: 'NT$' },
  { code: 'TZS', numericCode: '834', name: 'Tanzanian Shilling', nameEs: 'Chelín tanzano', symbol: 'TSh' },
  { code: 'UAH', numericCode: '980', name: 'Hryvnia', nameEs: 'Grivna ucraniana', symbol: '₴' },
  { code: 'UGX', numericCode: '800', name: 'Uganda Shilling', nameEs: 'Chelín ugandés', symbol: 'USh', decimalDigits: 0 },
  { code: 'USD', numericCode: '840', name: 'US Dollar', nameEs: 'Dólar estadounidense', symbol: 'US$' },
  { code: 'UYU', numericCode: '858', name: 'Peso Uruguayo', nameEs: 'Peso uruguayo', symbol: '$U' },
  { code: 'UZS', numericCode: '860', name: 'Uzbekistan Sum', nameEs: 'Som uzbeko', symbol: "so'm" },
  { code: 'VES', numericCode: '928', name: 'Bolívar Soberano', nameEs: 'Bolívar venezolano', symbol: 'Bs.' },
  { code: 'VND', numericCode: '704', name: 'Dong', nameEs: 'Dong vietnamita', symbol: '₫', decimalDigits: 0 },
  { code: 'VUV', numericCode: '548', name: 'Vatu', nameEs: 'Vatu vanuatuense', symbol: 'VT', decimalDigits: 0 },
  { code: 'WST', numericCode: '882', name: 'Tala', nameEs: 'Tala samoano', symbol: 'T' },
  { code: 'XAF', numericCode: '950', name: 'CFA Franc BEAC', nameEs: 'Franco CFA de África Central', symbol: 'FCFA', decimalDigits: 0 },
  { code: 'XCD', numericCode: '951', name: 'East Caribbean Dollar', nameEs: 'Dólar del Caribe Oriental', symbol: 'EC$' },
  { code: 'XOF', numericCode: '952', name: 'CFA Franc BCEAO', nameEs: 'Franco CFA de África Occidental', symbol: 'CFA', decimalDigits: 0 },
  { code: 'XPF', numericCode: '953', name: 'CFP Franc', nameEs: 'Franco CFP', symbol: '₣', decimalDigits: 0 },
  { code: 'YER', numericCode: '886', name: 'Yemeni Rial', nameEs: 'Rial yemení', symbol: '﷼' },
  { code: 'ZAR', numericCode: '710', name: 'Rand', nameEs: 'Rand sudafricano', symbol: 'R' },
  { code: 'ZMW', numericCode: '967', name: 'Zambian Kwacha', nameEs: 'Kwacha zambiano', symbol: 'ZK' },
  { code: 'ZWG', numericCode: '924', name: 'Zimbabwe Gold', nameEs: 'Oro de Zimbabue', symbol: 'ZiG' },
];

export async function seedCurrencies(prisma: PrismaClient): Promise<{ currenciesUpserted: number }> {
  console.log('🌱 Seeding ISO 4217 currency catalog...\n');

  let currenciesUpserted = 0;
  for (const def of CURRENCIES) {
    const popularIndex = POPULAR_ORDER.indexOf(def.code);
    const isPopular = popularIndex !== -1;
    const sortOrder = isPopular ? popularIndex : 100;

    const payload = {
      numericCode: def.numericCode,
      name: def.name,
      nameEs: def.nameEs,
      symbol: def.symbol ?? null,
      decimalDigits: def.decimalDigits ?? 2,
      isActive: true,
      isPopular,
      sortOrder,
    };

    await prisma.currency.upsert({
      where: { code: def.code },
      update: payload,
      create: { code: def.code, ...payload },
    });
    currenciesUpserted++;
  }

  console.log(`  ✅ ${currenciesUpserted} currencies (${POPULAR_ORDER.length} pinned as popular)\n`);

  return { currenciesUpserted };
}
