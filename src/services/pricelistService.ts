import pricelistRaw from '../data/pricelistData.json';

export interface PricelistItem {
  id: string;
  brand: string;
  type: string;
  model: string;
  price: number;
  contractorPrice: number;
  dealerPrice: number;
  endUserPrice: number;
  description: string;
  sourceFile: string;
}

export interface SearchOptions {
  brand?: string;
  category?: string;
  maxResults?: number;
  userType?: 'endUser' | 'contractor' | 'dealer' | 'srp';
}

export interface PricelistMatchResult {
  item: PricelistItem;
  score: number;
  matchType: 'exact_model' | 'partial_model' | 'alternative_category' | 'keyword';
}

export interface EstimatedItemPricing {
  itemQuery: string;
  foundInPricelist: boolean;
  isAlternative?: boolean;
  brand: string;
  model: string;
  description: string;
  price: number; // Base / SRP
  contractorPrice: number;
  dealerPrice: number;
  endUserPrice: number;
  effectivePrice: number; // Active price based on user tier
  source: string; // "Pricelist (File.csv)" or "Pricelist Recommended Alternative (File.csv)" or "Market Estimate (Not in Pricelist)"
  sourceFile?: string;
  rationale?: string;
  confidence: number; // 0 - 100
}

const catalog: PricelistItem[] = pricelistRaw as PricelistItem[];

const KNOWN_BRANDS = [
  'HIKVISION', 'BOSCH', 'AIPHONE', 'ZKTECO', 'DAHUA', 'HONEYWELL',
  'ASENWARE', 'APOLLO', 'EDWARDS', 'NOTIFIER', 'HOCHIKI', 'FARFISA',
  'AJAX', 'SIEMENS', 'SIMPLEX', 'TOA', 'AVTECH', 'EZVIZ', 'IMOU', 'ITC', 'RUIJIE', 'UNIQSCAN', 'GARRETT'
];

const STOP_WORDS = new Set([
  'can', 'you', 'tell', 'me', 'how', 'much', 'is', 'a', 'an', 'the', 'what',
  'where', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'please', 'give', 'find',
  'show', 'price', 'prices', 'cost', 'costs', 'estimate', 'estimation', 'rate',
  'rates', 'srp', 'dealer', 'contractor', 'enduser', 'item', 'device', 'equipment'
]);

const GENERIC_SPEC_WORDS = new Set([
  '1m', '2m', '3m', '4m', '5m', '6m', '10m', '15m', '20m', '50m', '100m',
  'length', 'width', 'height', 'size', 'pcs', 'pc', 'set', 'pack', 'unit',
  'meter', 'meters', 'mm', 'cm', 'kg', 'v', 'volt', 'amp', 'w', 'watt', 'mhz', 'ghz',
  'rec', 'alt', 'recommended', 'alternative'
]);

function normalizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Searches the catalog for products matching a query.
 */
export function searchPricelist(query: string, options: SearchOptions = {}): PricelistItem[] {
  if (!query || !query.trim()) {
    return catalog.slice(0, options.maxResults || 50);
  }

  const rawQuery = query.trim().toLowerCase();
  const rawTokens = rawQuery.split(/\s+/).filter(t => t.length > 1);
  const meaningfulTokens = rawTokens.filter(t => !STOP_WORDS.has(t));
  const tokensToUse = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  const normQuery = normalizeKey(tokensToUse.join(' '));

  // Detect if user query mentions a specific brand
  const queryBrand = options.brand 
    ? options.brand 
    : KNOWN_BRANDS.find(b => rawQuery.includes(b.toLowerCase()));

  const scored = catalog.map(item => {
    let score = 0;
    const rawModel = (item.model || '').trim();
    const rawBrand = (item.brand || '').trim();
    const rawType = (item.type || '').trim();
    const rawDesc = (item.description || '').trim();

    const normModel = normalizeKey(rawModel);
    const normBrand = normalizeKey(rawBrand);
    const normType = normalizeKey(rawType);

    // If user query mentions a brand, heavily boost matching brand and penalize mismatched brand
    if (queryBrand) {
      const normQueryBrand = normalizeKey(queryBrand);
      if (normBrand.includes(normQueryBrand) || normQueryBrand.includes(normBrand)) {
        score += 2000;
      } else {
        score -= 2000;
      }
    }

    // 1. Exact normalized model match (Highest Priority)
    if (normModel.length > 1 && normQuery === normModel) {
      score += 1000;
    } else if (normModel.length > 2 && normQuery.includes(normModel)) {
      score += 500;
    } else if (normQuery.length > 2 && normModel.includes(normQuery)) {
      score += 400;
    }

    // 2. Exact raw model substring in query
    if (rawModel.length > 2 && rawQuery.includes(rawModel.toLowerCase())) {
      score += 300;
    }

    // 3. Token matching against model, brand, type, and description
    tokensToUse.forEach(token => {
      const normToken = normalizeKey(token);
      if (!normToken) return;

      const isGenericSpec = GENERIC_SPEC_WORDS.has(token.toLowerCase()) || GENERIC_SPEC_WORDS.has(normToken);
      const tokenWeightMultiplier = isGenericSpec ? 0.05 : 1.0;

      if (normModel === normToken) {
        score += 200 * tokenWeightMultiplier;
      } else if (normModel.includes(normToken)) {
        score += 80 * tokenWeightMultiplier;
      }

      if (normType.includes(normToken)) {
        score += 120 * tokenWeightMultiplier;
      }

      if (normBrand === normToken) {
        score += 50 * tokenWeightMultiplier;
      } else if (normBrand.includes(normToken)) {
        score += 20 * tokenWeightMultiplier;
      }

      if (rawDesc.toLowerCase().includes(token.toLowerCase())) {
        score += 25 * tokenWeightMultiplier;
      }
    });

    return { item, score };
  });

  const filtered = scored
    .filter(s => s.score > 15) // require meaningful minimum score threshold
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);

  return filtered.slice(0, options.maxResults || 50);
}

/**
 * Finds the best single match in the pricelist folder catalog.
 */
export function findBestPricelistMatch(itemQuery: string): PricelistMatchResult | null {
  if (!itemQuery || !itemQuery.trim()) return null;
  const results = searchPricelist(itemQuery, { maxResults: 1 });
  if (results.length === 0) return null;

  const item = results[0];
  const normQuery = normalizeKey(itemQuery);
  const normModel = normalizeKey(item.model);

  let score = 0.5;
  let matchType: 'exact_model' | 'partial_model' | 'alternative_category' | 'keyword' = 'keyword';

  if (normModel && (normQuery === normModel || normQuery.includes(normModel))) {
    score = 1.0;
    matchType = 'exact_model';
  } else if (normModel.length > 2 && normModel.includes(normQuery)) {
    score = 0.85;
    matchType = 'partial_model';
  } else {
    score = 0.60;
  }

  return { item, score, matchType };
}

/**
 * Finds the Next Best Alternative item in our catalog when the specific TOR brand/model is not directly carried.
 */
export function findNextBestAlternative(itemQuery: string): PricelistItem | null {
  if (!itemQuery || !itemQuery.trim()) return null;

  const qLower = itemQuery.toLowerCase();
  
  // Strip out any non-carried brand name to search purely by category & features
  let searchCategory = itemQuery;
  KNOWN_BRANDS.forEach(b => {
    searchCategory = searchCategory.replace(new RegExp(b, 'gi'), '');
  });
  searchCategory = searchCategory.trim();

  if (!searchCategory) searchCategory = itemQuery;

  // Extract non-spec primary keywords from search query
  const primaryKeywords = searchCategory
    .toLowerCase()
    .split(/\s+/)
    .map(t => normalizeKey(t))
    .filter(t => t.length > 2 && !STOP_WORDS.has(t) && !GENERIC_SPEC_WORDS.has(t));

  // Search pricelist for equivalent items from AA2000 carried flagship brands
  const candidates = searchPricelist(searchCategory, { maxResults: 10 });
  
  // Filter candidates: candidate MUST match at least one primary keyword in model, type, or description
  const relevantCandidates = candidates.filter(c => {
    if (primaryKeywords.length === 0) return true;
    const itemStr = normalizeKey(`${c.brand} ${c.model} ${c.type} ${c.description}`);
    return primaryKeywords.some(pk => itemStr.includes(pk));
  });

  if (relevantCandidates.length > 0) {
    // Prefer carried flagship brands: Asenware, Hikvision, Dahua, ZKTeco, Bosch, Aiphone, Ruijie
    const preferredFlagship = relevantCandidates.find(c => {
      const b = c.brand.toUpperCase();
      return b.includes('ASENWARE') || b.includes('HIKVISION') || b.includes('DAHUA') || b.includes('ZKTECO') || b.includes('BOSCH') || b.includes('AIPHONE') || b.includes('RUIJIE');
    });

    return preferredFlagship || relevantCandidates[0];
  }

  return null;
}

/**
 * Gets product catalog stats for system prompts & UI reference
 */
export function getCatalogStats() {
  const totalProducts = catalog.length;
  const brands = Array.from(new Set(catalog.map(c => c.brand).filter(Boolean))).sort();
  const sourceFiles = Array.from(new Set(catalog.map(c => c.sourceFile).filter(Boolean))).sort();
  return { totalProducts, totalBrands: brands.length, brands, sourceFilesCount: sourceFiles.length };
}

/**
 * Gets the API key for Mistral AI
 */
function getMistralApiKey(): string {
  return import.meta.env.VITE_MISTRAL_API_KEY || localStorage.getItem('mistral_api_key') || '';
}

/**
 * Uses Mistral AI to verify whether a pricelist item (exact match or alternative) is genuinely
 * fit for the requested item — checking both product category AND description-level specs.
 * Returns true ONLY if the item is suitable for the requirement.
 */
async function verifyCandidateSuitability(
  requestedItem: string,
  candidate: PricelistItem,
  isExactMatch: boolean = false
): Promise<boolean> {
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    // Without AI: check that meaningful keywords from request appear in type + model + description
    const typeNorm = normalizeKey(candidate.type || '');
    const modelNorm = normalizeKey(candidate.model || '');
    const descNorm = normalizeKey(candidate.description || '');
    const combinedNorm = `${typeNorm}${modelNorm}${descNorm}`;
    const keywords = requestedItem.toLowerCase().split(/\s+/)
      .map(t => normalizeKey(t))
      .filter(t => t.length > 3 && !STOP_WORDS.has(t) && !GENERIC_SPEC_WORDS.has(t));
    return keywords.length === 0 || keywords.some(k => combinedNorm.includes(k));
  }

  try {
    const matchLabel = isExactMatch ? 'EXACT PRICELIST MATCH' : 'PROPOSED ALTERNATIVE';
    const prompt = `You are a strict electronic security and safety systems product suitability verifier for a Philippine systems integrator.

REQUESTED ITEM: "${requestedItem}"
${matchLabel}:
  Brand: ${candidate.brand}
  Model: ${candidate.model}
  Type/Category: ${candidate.type}
  Description: "${candidate.description}"

Your job is to verify two things:
1. CATEGORY CHECK: Is this item in the same product category and serve the same function as the requested item?
2. DESCRIPTION/SPEC CHECK: Does the product description confirm this item is appropriate for the requested requirement?
   - Read the description carefully for clues: cable specs, camera type, detector type, interface, dimensions, etc.
   - If the description reveals it is clearly a DIFFERENT product type (e.g., thermal receipt printer description for a camera request, tyre killer description for a cable tray, etc.), mark as NOT suitable.
   - If the description is consistent with the requirement or cannot contradict it, mark as suitable.

Examples:
  - Request: "Cat6 UTP Cable" / Description: "CAT6 23AWG UTP cable, 305m roll" → suitable
  - Request: "Cat6 UTP Cable" / Description: "58mm Portable Thermal Receipt Printer, Bluetooth 4.0" → NOT suitable
  - Request: "2MP IP Dome Camera" / Description: "2MP Fixed Turret Network Camera, H.265+" → suitable
  - Request: "Smoke Detector" / Description: "Tyre Killer, Motor Drive, Spike thickness 12mm" → NOT suitable
  - Request: "Access Control Reader" / Description: "13.56MHz Mifare Card Reader, Wiegand output" → suitable

Respond ONLY with valid JSON: { "suitable": true } or { "suitable": false }
Do NOT include any explanation or extra text.`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) return false;

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    return result.suitable === true;
  } catch {
    // On error, be permissive for exact matches and strict for alternatives
    return isExactMatch;
  }
}

/**
 * Standard Philippine Electronic Security, Networking, & Electrical Market Benchmark Table
 * Provides highly accurate, realistic baseline pricing for common site auxiliaries, consumables, and hardware.
 */
function getPhilippineMarketBenchmark(itemQuery: string, userTier: 'endUser' | 'contractor' | 'dealer' | 'srp'): EstimatedItemPricing | null {
  const q = itemQuery.toLowerCase();

  // 1. RJ45 Connectors / Plugs / Keystone Jacks / Faceplates
  if (q.includes('rj45') || q.includes('rj-45') || q.includes('jc688') || q.includes('information outlet') || q.includes('keystone')) {
    const isJack = q.includes('jc688') || q.includes('information outlet') || q.includes('keystone') || q.includes('jack') || q.includes('face plate') || q.includes('faceplate');
    const srp = isJack ? 320 : 35;
    const contractor = isJack ? 280 : 28;
    const dealer = isJack ? 250 : 22;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('panduit') ? 'Panduit' : 'Standard',
      model: isJack ? 'Cat6 Modular Jack / Information Outlet' : 'Cat6 RJ45 Connector Plug',
      description: isJack ? 'Cat6 RJ45 Modular Jack with Faceplate' : 'Cat6 RJ45 8P8C Modular Connector Plug',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Realistic Philippine market rate for Cat6 network terminations.',
      confidence: 90,
    };
  }

  // 2. Patch Cords (1m, 2m, 3m, 5m)
  if (q.includes('patch cord') || q.includes('patchcord') || q.includes('patch cable')) {
    const srp = 220;
    const contractor = 180;
    const dealer = 150;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('panduit') ? 'Panduit' : 'Standard',
      model: 'Cat6 Molded Patch Cord (1m-2m)',
      description: 'Factory-crimped Cat6 UTP Molded Patch Cord',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial rate for Cat6 patch cord.',
      confidence: 90,
    };
  }

  // 3. Patch Panel 24-Port / 48-Port
  if (q.includes('patch panel') || q.includes('pp24') || q.includes('pp48')) {
    const is48 = q.includes('48');
    const srp = is48 ? 6500 : 3800;
    const contractor = is48 ? 5500 : 3200;
    const dealer = is48 ? 4800 : 2800;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('panduit') ? 'Panduit' : 'Standard',
      model: is48 ? '48-Port Cat6 Patch Panel 2U' : '24-Port Cat6 Patch Panel 1U',
      description: is48 ? '48-Port 19-inch Rackmount Cat6 Patch Panel' : '24-Port 19-inch Rackmount Cat6 Patch Panel',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial rate for rackmount patch panel.',
      confidence: 90,
    };
  }

  // 4. Electrical THHN / THWN Copper Wire (per meter / roll)
  if (q.includes('thhn') || q.includes('thwn') || (q.includes('phelps dodge') && q.includes('wire'))) {
    const isBox = q.includes('box') || q.includes('roll') || q.includes('150m');
    const srp = isBox ? 5800 : 42;
    const contractor = isBox ? 5100 : 36;
    const dealer = isBox ? 4600 : 32;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Phelps Dodge',
      model: 'THHN/THWN-2 3.5mm² (12 AWG) Copper Wire',
      description: isBox ? 'Phelps Dodge 3.5mm² THHN/THWN-2 Stranded Copper Wire (150m Box)' : 'Phelps Dodge 3.5mm² THHN/THWN-2 Stranded Copper Wire (Per Meter)',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Current Philippine electrical market benchmark for building wire.',
      confidence: 92,
    };
  }

  // 5. Electrical Outlets / Switches / Receptacles (Panasonic / Royu)
  if (q.includes('outlet') || q.includes('receptacle') || q.includes('wn5265') || (q.includes('panasonic') && (q.includes('switch') || q.includes('plate')))) {
    const srp = 320;
    const contractor = 280;
    const dealer = 250;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Panasonic',
      model: 'Duplex Universal Grounding Outlet with Plate',
      description: 'Panasonic Wide Series Duplex Universal Convenience Outlet with Ground & Wall Plate',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard Philippine retail/commercial benchmark for Panasonic duplex outlet.',
      confidence: 95,
    };
  }

  // 6. EMT Pipes (3-meter standard lengths)
  if (q.includes('emt') && (q.includes('pipe') || q.includes('conduit'))) {
    const srp = 220;
    const contractor = 190;
    const dealer = 170;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Nikon / Maruichi',
      model: 'EMT Pipe 3/4" x 10ft (3.0m)',
      description: 'Electrical Metallic Tubing (EMT) 3/4-inch diameter x 3.0m length',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial rate per 3m length of 3/4" EMT pipe in Metro Manila.',
      confidence: 92,
    };
  }

  // 7. PVC Pipes / Conduits (3-meter standard lengths)
  if ((q.includes('pvc') || q.includes('atlanta') || q.includes('neltex')) && (q.includes('pipe') || q.includes('conduit'))) {
    const srp = 110;
    const contractor = 95;
    const dealer = 85;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Atlanta / Neltex',
      model: 'PVC Electrical Conduit 3/4" x 3.0m (Sched 40)',
      description: 'uPVC Electrical Conduit Pipe 3/4-inch diameter x 3.0m length',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial rate per 3m length of 3/4" PVC electrical pipe.',
      confidence: 92,
    };
  }

  // 8. Flexible Conduits (per meter)
  if (q.includes('flexible') || q.includes('pf-075') || q.includes('liquidtight') || q.includes('liquid-tight')) {
    const srp = 45;
    const contractor = 38;
    const dealer = 34;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Philflex',
      model: 'Flexible Metallic Conduit 3/4"',
      description: 'Flexible Metallic Conduit / Liquidtight Hose 3/4-inch (Per Meter)',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard Philippine rate per meter of flexible electrical conduit.',
      confidence: 90,
    };
  }

  // 9. Pull Boxes, Junction Boxes, Stainless Enclosures
  if (q.includes('pull box') || q.includes('junction box') || q.includes('utility box') || q.includes('hff4x') || q.includes('hff140') || q.includes('hx1212')) {
    const isLargeStainless = q.includes('stainless') || q.includes('12x12') || q.includes('hff4x');
    const srp = isLargeStainless ? 1450 : 450;
    const contractor = isLargeStainless ? 1250 : 380;
    const dealer = isLargeStainless ? 1100 : 330;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Standard Enclosure',
      model: isLargeStainless ? 'Stainless Steel Pull Box 12"x12"x6" NEMA 4X' : 'Galvanized / Metal Pull Box 6"x6"x4"',
      description: isLargeStainless ? 'Weatherproof Stainless Steel Pull Box with Gasket & Cover' : 'Standard Metal Pull Box / Junction Box with Cover',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial rate for metal/stainless electrical pull box.',
      confidence: 90,
    };
  }

  // 10. Hilti / Unistrut / Hangers / Clamps / Fasteners
  if (q.includes('unistrut') || q.includes('clamp') || q.includes('hanger') || q.includes('bracket') || q.includes('screws') || q.includes('fasteners')) {
    const srp = 110;
    const contractor = 95;
    const dealer = 80;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Hilti / Local Equivalent',
      model: 'Conduit Hanger & Unistrut Clamp Set',
      description: 'Electro-galvanized Conduit Hangers, Clamps, and Anchor Fastener Set',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial hardware rate for conduit mounting accessories.',
      confidence: 90,
    };
  }

  // 11. Cambium ePMP Force Radios / Wireless PTP Links
  if (q.includes('cambium') || q.includes('epmp') || q.includes('force 180') || q.includes('force 200') || q.includes('force 300')) {
    const srp = 8500;
    const contractor = 7500;
    const dealer = 6800;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Cambium Networks',
      model: 'ePMP Force 180 5GHz Integrated Radio',
      description: 'Cambium Networks ePMP Force 180 5GHz 200Mbps+ Integrated High-Gain Wireless Radio',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard Philippine distributor pricing for Cambium ePMP wireless radio unit.',
      confidence: 94,
    };
  }

  // 12. 1kVA / 1000VA UPS (APC / Kebos / CyberPower)
  if (q.includes('ups') || q.includes('1kva') || q.includes('gh11-1kva') || q.includes('back-ups')) {
    const srp = 7800;
    const contractor = 6800;
    const dealer = 6200;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('apc') ? 'APC by Schneider' : 'Kebos',
      model: '1kVA (1000VA / 600W-800W) Line-Interactive / Online UPS',
      description: '1kVA Uninterruptible Power Supply with Automatic Voltage Regulation (AVR) & Battery Backup',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Current market rate for standard 1kVA CCTV/Server rack UPS in PH.',
      confidence: 92,
    };
  }

  // 13. CCTV / Network Wall Mount Data Cabinet (6U, 9U, 12U)
  if ((q.includes('cabinet') || q.includes('rack') || q.includes('enclosure')) && (q.includes('wall') || q.includes('server') || q.includes('cctv') || q.includes('network') || q.includes('ar3100'))) {
    const srp = 6500;
    const contractor = 5600;
    const dealer = 5000;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Standard Data Cabinet',
      model: '9U 19-inch Wall-Mount Network / CCTV Data Cabinet',
      description: '9U 19-inch Wall-Mount Equipment Cabinet with Tempered Glass Door, Exhaust Fan, & PDU Strip',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Appropriate small-to-medium wall cabinet rate for CCTV/network terminations (avoids over-speccing 42U datacenter racks).',
      confidence: 92,
    };
  }

  // 14. 8-Port / 16-Port Gigabit PoE Switch
  if (q.includes('poe') || (q.includes('switch') && (q.includes('cisco') || q.includes('sg350') || q.includes('ruijie') || q.includes('gigabit')))) {
    const is16 = q.includes('16') || q.includes('16-port');
    const is24 = q.includes('24') || q.includes('28') || q.includes('24-port');
    const srp = is24 ? 18500 : is16 ? 11500 : 6500;
    const contractor = is24 ? 16000 : is16 ? 9800 : 5600;
    const dealer = is24 ? 14500 : is16 ? 8900 : 4900;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('cisco') ? 'Cisco' : q.includes('ruijie') ? 'Ruijie' : 'Hikvision',
      model: is24 ? '24-Port Gigabit Managed PoE+ Switch' : is16 ? '16-Port Gigabit PoE Switch' : '8-Port Gigabit Smart PoE Switch',
      description: `${is24 ? '24' : is16 ? '16' : '8'}-Port Gigabit PoE+ Network Switch with 802.3at/af Power over Ethernet`,
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Commercial market price for managed/smart Gigabit PoE switch in the Philippines.',
      confidence: 90,
    };
  }

  // 15. IP Cameras (5MP / 4MP / 2MP Dome or Bullet)
  if (q.includes('camera') || q.includes('ds-2cd') || q.includes('dome') || q.includes('bullet') || q.includes('ip camera')) {
    const is5MP = q.includes('5mp') || q.includes('2355') || q.includes('5-mp');
    const srp = is5MP ? 5500 : 4200;
    const contractor = is5MP ? 4800 : 3600;
    const dealer = is5MP ? 4200 : 3200;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: q.includes('dahua') ? 'Dahua' : 'Hikvision',
      model: is5MP ? 'DS-2CD2355FWD-I 5MP IR Fixed Dome Network Camera' : '2MP/4MP IR Fixed Network Camera',
      description: is5MP ? 'Hikvision 5MP Outdoor IR Fixed Dome IP Network Camera, WDR, H.265+' : 'Full HD IR Network Security Camera',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Current Philippine authorized distributor market rate for 5MP IP security cameras.',
      confidence: 95,
    };
  }

  // 16. 12V 2A / 5A Power Adapter
  if (q.includes('power adapter') || q.includes('power supply') || q.includes('12v 2a') || q.includes('12v') || q.includes('adapter')) {
    const srp = 450;
    const contractor = 380;
    const dealer = 320;
    const eff = userTier === 'contractor' ? contractor : userTier === 'dealer' ? dealer : srp;
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Hikvision / Generic OEM',
      model: '12V DC 2A Regulated Power Supply Adapter',
      description: '12VDC 2-Ampere Regulated Switching Power Supply Adapter with Surge Protection',
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: srp,
      effectivePrice: eff,
      source: 'Philippine Market Standard Benchmark',
      rationale: 'Standard commercial retail rate for 12V 2A DC regulated camera power adapter.',
      confidence: 95,
    };
  }

  return null;
}

/**
 * Core estimation pricing function that strictly satisfies the user rules:
 * 1. Pull exact equipment match from pricelist folder catalog first.
 * 2. If exact brand/model is not carried or unavailable in pricelist, verify and recommend a genuine
 *    functional equivalent from our catalog (AI suitability-checked). Do NOT recommend unrelated products.
 * 3. Check official Philippine Market Standard Benchmarks for site consumables & auxiliaries.
 * 4. If no verified benchmark exists, fallback to AI average market value estimation in PHP with strict sanity bounds.
 */
export async function getEstimatedItemPricing(
  itemQuery: string,
  userTier: 'endUser' | 'contractor' | 'dealer' | 'srp' = 'contractor'
): Promise<EstimatedItemPricing> {
  // Step 1: Check Exact/Direct Pricelist Catalog Match
  const match = findBestPricelistMatch(itemQuery);

  if (match && match.score >= 0.8) {
    const item = match.item;
    const exactMatchFit = await verifyCandidateSuitability(itemQuery, item, true);
    if (exactMatchFit) {
      let effPrice = item.price;
      if (userTier === 'contractor') effPrice = item.contractorPrice || item.price;
      else if (userTier === 'dealer') effPrice = item.dealerPrice || item.price;
      else if (userTier === 'endUser') effPrice = item.endUserPrice || item.price;

      return {
        itemQuery,
        foundInPricelist: true,
        isAlternative: false,
        brand: item.brand,
        model: item.model || 'Pricelist Item',
        description: item.description,
        price: item.price,
        contractorPrice: item.contractorPrice || item.price,
        dealerPrice: item.dealerPrice || item.price,
        endUserPrice: item.endUserPrice || item.price,
        effectivePrice: effPrice,
        source: `Pricelist (${item.sourceFile})`,
        sourceFile: item.sourceFile,
        rationale: `Verified match found in official price list: ${item.sourceFile}`,
        confidence: Math.round(match.score * 100)
      };
    }
  }

  // Step 2: Search for NEXT BEST CARRIED ALTERNATIVE — verified against description AND category
  const alternative = findNextBestAlternative(itemQuery);
  if (alternative) {
    const isSuitable = await verifyCandidateSuitability(itemQuery, alternative, false);
    if (isSuitable) {
      let effPrice = alternative.price;
      if (userTier === 'contractor') effPrice = alternative.contractorPrice || alternative.price;
      else if (userTier === 'dealer') effPrice = alternative.dealerPrice || alternative.price;
      else if (userTier === 'endUser') effPrice = alternative.endUserPrice || alternative.price;

      return {
        itemQuery,
        foundInPricelist: true,
        isAlternative: true,
        brand: alternative.brand,
        model: alternative.model,
        description: alternative.description,
        price: alternative.price,
        contractorPrice: alternative.contractorPrice || alternative.price,
        dealerPrice: alternative.dealerPrice || alternative.price,
        endUserPrice: alternative.endUserPrice || alternative.price,
        effectivePrice: effPrice,
        source: `Pricelist Alternative (${alternative.sourceFile})`,
        sourceFile: alternative.sourceFile,
        rationale: `TOR requested "${itemQuery}" is not directly carried. AA2000's verified carried equivalent: ${alternative.brand} ${alternative.model} (${alternative.sourceFile}).`,
        confidence: 85
      };
    }
  }

  // Step 3: Check Philippine Market Standard Benchmark
  const benchmark = getPhilippineMarketBenchmark(itemQuery, userTier);
  if (benchmark) {
    return benchmark;
  }

  // Step 4: NOT in Pricelist OR Benchmark -> Estimate market value in PHP with strict sanity guardrails
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Generic / Custom',
      model: itemQuery,
      description: `Equipment/Device "${itemQuery}" (Not in official pricelist)`,
      price: 2500,
      contractorPrice: 2200,
      dealerPrice: 2000,
      endUserPrice: 2800,
      effectivePrice: 2200,
      source: 'Market Value Estimate (Not in Pricelist)',
      rationale: 'Item is not listed in the AA2000 pricelist folder. Estimated average market value.',
      confidence: 65
    };
  }

  try {
    const prompt = `You are a strict, expert Electronic Security and Auxiliary Systems Estimator in the Philippines.
The user requested pricing for the following equipment/item from a Philippine TOR/Specification: "${itemQuery}".

TASK: Estimate a realistic, current average Philippine Market Price in PHP (Philippine Pesos ₱) for this specific item.

PHILIPPINE SECURITY & ELECTRICAL MARKET BENCHMARK CONTEXT (DO NOT OVERPRICE):
- Connectors / RJ45 plugs / patch cords: ₱25 - ₱350 per piece (NEVER thousands of pesos per plug)
- Wires (THHN 3.5mm² per meter): ₱30 - ₱55 per meter (₱4,500 - ₱8,000 per 150m roll)
- Conduits (EMT/PVC 3/4" 3m length): ₱90 - ₱240 per 3m length
- Outlets (Panasonic duplex): ₱250 - ₱380 per set
- Metal Pull Boxes (4x4 to 12x12): ₱350 - ₱2,200 per piece (NEVER tens of thousands)
- Small Wall Data Cabinets (6U-12U): ₱4,500 - ₱8,500 per unit
- 1kVA UPS: ₱5,500 - ₱10,000 per unit
- 8-Port Gigabit PoE Switches: ₱4,500 - ₱9,000 per unit
- Cambium / Ubiquiti PTP Radios: ₱6,000 - ₱10,000 per unit
- 5MP IP Cameras: ₱4,500 - ₱7,500 per unit

Respond strictly in JSON with this schema:
{
  "brand": "Manufacturer or standard brand name",
  "model": "Model number or clear product identifier",
  "description": "Accurate technical description",
  "srpPrice": <number in PHP>,
  "contractorPrice": <number in PHP>,
  "dealerPrice": <number in PHP>,
  "endUserPrice": <number in PHP>,
  "marketRationale": "Detailed technical and market price rationale based on Philippine market rates"
}`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`AI price estimation error: ${response.statusText}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    const resData = JSON.parse(content);

    let srp = Number(resData.srpPrice) || 2500;
    let contractor = Number(resData.contractorPrice) || Math.round(srp * 0.85);
    let dealer = Number(resData.dealerPrice) || Math.round(srp * 0.78);
    let endUser = Number(resData.endUserPrice) || srp;

    let effPrice = srp;
    if (userTier === 'contractor') effPrice = contractor;
    else if (userTier === 'dealer') effPrice = dealer;
    else if (userTier === 'endUser') effPrice = endUser;

    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: resData.brand || 'Market Standard',
      model: resData.model || itemQuery,
      description: resData.description || `TOR Requested Item: ${itemQuery}`,
      price: srp,
      contractorPrice: contractor,
      dealerPrice: dealer,
      endUserPrice: endUser,
      effectivePrice: effPrice,
      source: 'Market Value Estimate (Not in Pricelist)',
      rationale: resData.marketRationale || `Price estimated based on current PH market averages.`,
      confidence: 75
    };
  } catch (err: any) {
    console.error('Market estimation AI call failed:', err);
    return {
      itemQuery,
      foundInPricelist: false,
      isAlternative: false,
      brand: 'Generic',
      model: itemQuery,
      description: `Equipment: ${itemQuery}`,
      price: 2500,
      contractorPrice: 2125,
      dealerPrice: 1950,
      endUserPrice: 2500,
      effectivePrice: 2125,
      source: 'Market Value Estimate (Not in Pricelist)',
      rationale: 'Item not in pricelist folder. Default market fallback applied.',
      confidence: 50
    };
  }
}
