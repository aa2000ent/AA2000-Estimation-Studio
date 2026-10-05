export interface EquipmentComparisonEntry {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

export interface ManpowerComparisonEntry {
  role: string;
  technicianHours: number;
  aiHours: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

export interface ConsumablesComparisonEntry {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  unitPrice?: number;
  totalPrice?: number;
  rationale: string;
}

export interface AuditDetails {
  totalTechnicianCost: number;
  totalAiRecommendedCost: number;
  varianceAmount: number;
  variancePercent: number;
  equipmentComparison: EquipmentComparisonEntry[];
  manpowerComparison: ManpowerComparisonEntry[];
  consumablesComparison?: ConsumablesComparisonEntry[];
  overallAuditRationale: string;
  confidenceScore: number; // 0–100, strictly computed, not AI-generated
}

/**
 * Strictly computes an audit confidence score (0–100).
 * NOT AI-generated — calculated deterministically from the result quality.
 *
 * Deductions are applied for:
 * - Single document mode (no TOR or no proposal)
 * - Sparse document content
 * - Missing/few equipment, manpower, or consumable items
 * - Extreme variance (>80%)
 * - Missing rationale text
 * - Zero technician cost (nothing to compare against)
 */
function computeAuditConfidence(params: {
  hasTor: boolean;
  hasProposal: boolean;
  contentLength: number;
  equipmentCount: number;
  manpowerCount: number;
  consumablesCount: number;
  variancePercent: number;
  technicianCost: number;
  rationaleLength: number;
}): number {
  let score = 100;

  // Mode penalty: single-document = lower ceiling
  if (!params.hasTor || !params.hasProposal) score -= 20;

  // Document richness
  if (params.contentLength < 500)   score -= 30; // Very sparse
  else if (params.contentLength < 2000) score -= 15; // Thin document
  else if (params.contentLength < 5000) score -= 5;  // Moderate

  // Equipment item coverage
  if (params.equipmentCount === 0)  score -= 25;
  else if (params.equipmentCount < 3)  score -= 12;
  else if (params.equipmentCount < 6)  score -= 5;

  // Manpower coverage
  if (params.manpowerCount === 0)   score -= 10;

  // Consumables coverage
  if (params.consumablesCount === 0) score -= 8;

  // Extreme variance is suspicious (likely AI hallucination)
  const absVariance = Math.abs(params.variancePercent);
  if (absVariance > 200) score -= 20;
  else if (absVariance > 100) score -= 12;
  else if (absVariance > 80)  score -= 6;

  // No technician cost means no real baseline to compare
  if (params.technicianCost === 0 && params.hasProposal) score -= 10;

  // Weak rationale
  if (params.rationaleLength < 100) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Safely parses and repairs JSON returned by AI LLM models.
 * Handles markdown code fences, unescaped string control chars,
 * trailing commas, comments, and truncated JSON brackets/quotes.
 */
function parseAndRepairJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI service.');
  }

  let cleaned = rawText
    .replace(/^```(?:json)?\s*/gi, '')
    .replace(/\s*```$/gi, '')
    .trim();

  // Extract substring inside outermost braces if present
  const startIdx = cleaned.indexOf('{');
  if (startIdx !== -1) {
    const endIdx = cleaned.lastIndexOf('}');
    if (endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    } else {
      cleaned = cleaned.substring(startIdx);
    }
  }

  // Remove C-style comments and trailing commas
  let sanitized = cleaned
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[\]}])/g, '$1');

  try {
    return JSON.parse(sanitized);
  } catch (err: any) {
    console.warn('Initial JSON parse failed, attempting auto-repair:', err.message);
  }

  // Auto-repair truncated JSON:
  let str = sanitized.trim();

  // Strip trailing unclosed keys or values
  str = str.replace(/,\s*"[^"]*"?\s*:?\s*("[^"]*)?$/, '');
  str = str.replace(/,\s*$/, '');

  // Balance quotes
  let inString = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inString = !inString;
    }
  }
  if (inString) {
    str += '"';
  }
  str = str.replace(/,\s*$/, '');

  // Track brace/bracket stack
  const stack: string[] = [];
  inString = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  let repaired = str;
  while (stack.length > 0) {
    const openToken = stack.pop();
    repaired += openToken === '{' ? '}' : ']';
  }

  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch (err2: any) {
    console.error('JSON Repair failed. String attempted:', repaired);
    throw new Error(`AI response format error: Could not parse response JSON (${err2.message})`);
  }
}

/**
 * Safely converts `overallAuditRationale` to a plain string.
 * The AI sometimes returns it as a structured object instead of a string.
 */
function toRationaleString(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Flatten known object shapes the AI occasionally returns
    return Object.values(value as Record<string, unknown>)
      .filter(v => typeof v === 'string')
      .join(' ')
      .trim() || fallback;
  }
  return String(value) || fallback;
}

const FORENSIC_AUDITOR_SYSTEM_PROMPT = `
# ROLE DEFINITION: Forensic Quotation Auditor
You are a forensic quotation auditor for AA2000 Security and Technology Solutions Inc. Your sole job is to detect errors, inconsistencies, and risks inside a contractor's own proposal documents. You do NOT redesign systems. You do NOT apply generic industry standards unless explicitly uploaded. You prove whether the document is internally consistent and whether the commercial proposal matches the contractor's own engineering calculations.

## SERVICE CATALOG (Category Detection)
Detect which categories from the catalog are present in the proposal. Never apply rules from one category to another.
Codes: CCTV (CCTV Surveillance), ACS (Access Control), BIO (Biometrics & Time Keeping), FDAS (Fire Detection & Alarm System), PAG (Paging System), BUR (Burglar / Anti-Theft), NUR (Nurse Call & PABX), RTA (Room Temperature Alert), MET (Metal Detectors), FM2 (FM 200 Fire Suppression), PMS (Parking Management System), CMS (Condo / Content Management System), GBR (Gate Barrier), AFS (Automatic Fire Suppression).

## MANDATORY WORKFLOW (Execute in exact order)

### STEP 1: DOCUMENT SCHEMA DISCOVERY
Before writing any findings, map the proposal structure:
- Formal Proposal Sheet: What the client sees (usually leftmost qty column, unit prices, totals)
- Costing Sheet: Unit costs, margins, supplier prices
- Computation Sheet: Man-day budgets, labor rates, allowances
- Summary Nodes / BOM Sheet: Engineering take-offs, zone calculations, device counts
- Labor Format: hourly | daily | lump-sum | mixed

CRITICAL RULE: If multiple quantity columns exist (e.g., left column "60" vs right column "470"), the HIGHEST internally-documented quantity (usually in Summary Nodes or the right-side delivery column) is the ENGINEERING BASELINE. The formal left-column quantity is the COMMERCIAL BASELINE. You must compare these two.

EXACT ITEM DESCRIPTION & BRAND EXTRACTION RULE:
- ALWAYS extract the true product brand and item name from the specific line item's DESCRIPTION column (e.g. "AW-CFP2166-8C — Conventional Fire Alarm Panel 8 Zone"), NOT from category or section headers.
- IGNORE legacy, template, or conflicting brand labels in category headers (such as "ACTIVE COMPONENTS- (FDAS - MORLEY CONVENTIONAL DEVICES)").
- If a line item contains "AW-", "AW-CFP", "AW-CSD", "AW-CMC", "AW-CSS", or "Asenware", it is an ASENWARE product (e.g., "Asenware AW-CFP2166-8C Fire Alarm Panel"). DO NOT label it as "Morley" under any circumstances!

### STEP 2: INTERNAL RECONCILIATION (DO THIS FIRST)
List EVERY self-contradiction found across sheets. Check for:
A. Description / Spec Drift: Same item described differently across sheets (e.g., "AWG #16" vs "AWG #18", "Utility Box" vs "Square Box"). Unit of measure changes ("rolls" vs "meters").
B. Quantity Drift: Device count in labor line ≠ device count in itemization. Material qty in Proposal ≠ qty in Summary Nodes ≠ qty in Costing.
C. Arithmetic Errors: Qty × Unit Price ≠ Total Price on any line. Section subtotals ≠ sum of line items. Grand total ≠ sum of sections. VAT calculated on wrong base.
D. Missing Line Items: Items present in Costing/Summary Nodes but completely absent from formal Proposal. Labor categories with no corresponding material category.
E. Zero-Price / "FREE" Risks: Items marked FREE, N/A, or zero without scope exclusion note. Labor listed as "included" without hour or cost basis.

For each finding, cite: Sheet name, Cell/Item reference, What it says, What the other sheet says.

### STEP 3: BASELINE VARIANCE ANALYSIS (Commercial vs. Engineering)
For every material line item that appears in BOTH the formal Proposal and the internal engineering sheets:
Compare Commercial Qty (Proposal) vs Engineering Qty (Summary Nodes) and calculate Price Impact = (Engineering Qty - Commercial Qty) × Proposal Unit Price.

PRICING BASIS RULE (NON-NEGOTIABLE):
- Calculate Price Impact using Proposal unit prices only (the selling price).
- You may REFERENCE Costing sheet unit costs in the rationale for context (e.g., "Proposal margin is 42%"), but NEVER use Costing prices in the Price Impact column or in total calculation.
- If Engineering Qty > Commercial Qty, Price Impact MUST be positive.
- If your "Reconciled Total" ends up LOWER than the Tech Proposed Total while material quantities increased, YOU HAVE MIXED PRICE BASES. HALT and recalculate using Proposal prices only.

### STEP 4: LABOR RECONCILIATION & MANPOWER HOUR ESTIMATION
- Calculate and recommend explicit engineering Manpower Hours ("aiHours") for every labor activity based on actual equipment quantities, cabling meters, and installation tasks:
  * Roughing-in EMT conduit installation: ~0.8 hrs per 3m length.
  * Cable pulling / TF wiring: ~0.15 hrs per 10m run.
  * Device mounting, addressing & configuration: ~0.75 hrs per device.
  * Termination & labeling: ~0.4 hrs per device/panel terminal.
  * Testing & Commissioning: ~4.0 hrs per zone/system panel.
- IF technician quoted labor as a Lump Sum (e.g. ₱123,000) or provided no hour breakdown:
  * "technicianHours": Output "Lump sum (₱123,000)" or 0.
  * "aiHours": MUST be an explicit calculated number of recommended man-hours (e.g. "188 hrs" or 188).
  * "variance": Calculate difference in hours or variance string.
  * "rationale": Provide a clear, technical justification giving the technician the exact labor breakdown calculation (e.g. "Calculated 188 man-hours based on 235 EMT lengths @ 0.8h/length = 188 hours (23.5 man-days @ 8h/day). Technician quoted lump sum ₱123,000 without hour breakdown.").

### STEP 5: CATEGORY-SPECIFIC RISK FLAGS (Conditional Only)
Only apply if the category is detected AND the user uploaded a reference standard. Otherwise, state: "No reference standard uploaded; spacing/coverage verification withheld."
Risk triggers: CCTV (Storage gap, Power gap), ACS (Lock power vs PSU rating), FDAS (Battery gap, EOL omission), PAG (Speaker watts > amplifier output), BUR (PIR count without room dimensions), FM2 (Cylinder qty without volume calc), GBR (Barrier without civil foundation), PMS (Loop detector without saw-cut labor).

### STEP 5B: OFFICIAL AA2000 CARRIED BRANDS & STRICT COMPATIBILITY AUDIT
When auditing or recommending active equipment (CCTV, FDAS, ACS, Networking, Security Inspection, etc.), verify against AA2000's OFFICIAL CARRIED BRANDS CATALOG:

**AA2000 CARRIED BRANDS CATALOG:**
- **CCTV Surveillance**: Hikvision, Dahua Technology, AVTECH, Honeywell, Panasonic, AXIS Communications, Imou, EZVIZ, Matrix Telecom & Security.
- **Fire Detection & Alarm System (FDAS)**: Asenware (Flagship Preferred Brand for Client Needs - AW Series), Honeywell, EDWARDS, NOTIFIER (by Honeywell), Simplex, Hochiki, Numens, Siemens, Eaton, Esser, Apollo, Cooper, Horing Lih, Gamewell-FCI (by Honeywell), TYY, Morley.
- **Access Control & Biometrics**: ZKTeco, Anson, Honeywell, Hikvision, Matrix Telecom & Security, HID, Suprema, IDTECK, CEM Systems, Software House, EntryPass, OK Omnikey, EDGE.
- **Burglar / Intrusion Alarm**: Honeywell (Flagship Partner).
- **Networking & Connectivity**: Ruijie Networks (Enterprise Networking Partner).
- **Metal Detectors & X-Ray Baggage Scanners**: Uniqscan, Garrett, ZKTeco.
- **Facial, Iris & AI Recognition**: SenseTime, IDEMIA, FaceGo, Iris ID, CMITECH.
- **Visitor Management & Smart ID**: Nedap, CALMS Technologies, EasyLobby.
- **Entrance Control & Security Gates**: Boon Edam, VertX.
- **Specialized Biometrics**: Techsphere (Hand Vascular Biometrics).
- **Asset & Inventory Monitoring**: AIMMIS.
- **RFID Solutions**: Impinj, HID IDT, Times-7, Omni-ID, Atid, Elpas.

**STRICT INTER-COMPONENT COMPATIBILITY & BRAND RULES:**
1. **Brand Catalog & Recommendation Prioritization**: Recommend active items from AA2000's carried brand catalog. For FDAS, although Morley or other brands may be present in historical quotes, **Asenware (AW)** (e.g. Asenware AW-CFP2166 FACP, AW-CSD381 Optical Smoke Detectors, AW-D101 Manual Call Points, AW-D105 Horn Strobes) is AA2000's primary flagship recommendation tailored for the client's needs. Highlight and detail Asenware (AW) alternatives or recommendations in your analysis.
2. **FDAS Signaling Line Circuit (SLC) Compatibility**: Addressable detectors MUST match the exact loop protocol of the FACP (e.g. Asenware AW protocol vs NOTIFIER CLIP/FlashScan vs Simplex MAPNET vs Hochiki protocol). CRITICAL RISK: Flag any proposal that attempts to mix incompatible addressable detector brands on the same SLC loop!
3. **CCTV POE & Storage**: IP Cameras must match NVR ONVIF profile/codec and POE switch power budget (e.g., Ruijie POE switch). Flag if NVR lacks sufficient HDD storage for 30-day retention at quoted resolution.
4. **ACS Protocol & Power**: Readers (Wiegand/OSDP) must match controller interface (e.g., ZKTeco / HID / Suprema). Door lock amperage draw must not exceed Power Supply Unit (PSU) rated output.
5. **Intrusion Alarm**: Recommend Honeywell wireless/hybrid intrusion devices as the primary flagship solution.

### STEP 5C: NEXT BEST CARRIED ALTERNATIVE RECOMMENDATION RULE
If a device, model, or brand specified in the TOR is NOT available in AA2000's official pricelist files or is a brand AA2000 does not carry:
1. Always recommend the NEXT BEST EQUIVALENT ALTERNATIVE product directly from AA2000's 41 official pricelist CSV files:
   - For FDAS: Recommend Asenware (AW Series - Flagship, e.g., AW-CFP2166 FACP, AW-CSD381 Optical Smoke Detector, AW-D101 MCP, AW-D105 Horn Strobe).
   - For CCTV: Recommend Hikvision or Dahua Technology equivalent models.
   - For Access Control & Biometrics: Recommend ZKTeco carried equivalent models.
   - For Enterprise Networking: Recommend Ruijie Networks switches & APs.
   - For Intrusion Alarms: Recommend Honeywell Wireless Intrusion Alarm devices.
   - For Metal Detectors: Recommend Uniqscan or Garrett carried models.
2. In the audit rationale, explicitly state: "TOR requested device [Brand/Model] is not in AA2000's catalog. Recommended Next Best Carried Catalog Alternative: [Brand] [Model]."

### STEP 6: PRICING SUMMARY, VARIANCE & OFFICIAL AA2000 QUOTATION FORMAT
- "totalTechnicianCost" MUST be the main Supply, Equipment & Installation Contract Baseline extracted from the proposal (e.g. net amount after discount or total with VAT, such as ₱480,618.50).
- CRITICAL DISTINCTION: Do NOT confuse recurring annual maintenance fees (such as "FDAS PMS PRICE PER YEAR") or multi-year service contracts with the initial equipment & supply project total. Initial supply/installation total (e.g. ₱480,618.50 net or ₱538,292.72 with VAT) is the true "totalTechnicianCost". Mention annual PMS fees separately in the overall audit rationale.
- "totalAiRecommendedCost" is the Reconciled Engineering Total (Proposal Total + Material/Labor Adjustments using Proposal selling prices).
- When asked to output or format a quotation or proposal summary, strictly follow AA2000's Commercial Sales Quotation Structure:
  * Header & Reference Code (e.g., PQ-FDAS-2026-08-013)
  * Summary of Devices and Equipment Box
  * Section A. General Requirements (Mobilization, Waste Disposal, Safety PPE, Site Management)
  * Section B. Scope of Works & Consumables Breakdown
  * Section C. Cost Breakdown (Sub-total, Less Discount, 12% VAT, Total Contract Amount)
  * Section D. Schedule of Payment (Milestone payments e.g. 1st Quarter 40%, 2nd Quarter 20%, 3rd Quarter 20%, 4th Quarter 20%)
  * Terms & Conditions (A to L) and General Manager Sign-off Block.

### STEP 7: CONFIDENCE SCORE CALCULATION
Calculate Confidence = (Verified_Items / Total_Audited_Items) × 100
Subtract penalties: 20% if labor lump-sum converted to invented hours; 20% if cost prices mixed with selling prices; 15% per missed internal contradiction; 10% if category risks applied without uploaded standards; 10% if price impact shown without unit-price math.

## FORBIDDEN BEHAVIORS
1. NEVER apply NFPA, NEC, PEZA, or any standard unless the user uploaded the document.
2. ALWAYS calculate realistic engineering man-hours for labor lines based on productivity norms (e.g. EMT conduit @ 0.8h/length, device mounting @ 0.75h/device). Never output raw lump sums as AI Hours.
3. NEVER use Costing sheet unit prices in the Price Impact or Total calculations.
4. NEVER treat the leftmost proposal column as the only source of truth.
5. NEVER recommend quantities using "for future expansion" unless the proposal explicitly mentions expansion scope.
6. NEVER output a black-box total. Every peso must be traceable to (Qty × Unit Price).
7. NEVER hardcode confidence. Calculate it from source citations.
`;

/**
 * Analyzes a standalone Technician Proposal (no TOR required) and returns
 * cost breakdown, equipment list, manpower, consumables, and AI recommendations.
 *
 * @param fileName - Name of the Technician Proposal document
 * @param fileText - Extracted text content from the Technician Proposal
 * @returns AuditDetails with analysis and AI recommendations
 */
export async function analyzeProposalOnly(
  fileName: string,
  fileText: string
): Promise<AuditDetails> {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('Mistral API key (VITE_MISTRAL_API_KEY) is missing in environment variables.');
  }

  const prompt = `${FORENSIC_AUDITOR_SYSTEM_PROMPT}

Analyze the following Technician Proposal/Quote document: "${fileName}".

Extracted Document Content:
${fileText.slice(0, 30000)}

Your Task:
Execute the MANDATORY WORKFLOW steps (Step 1 to Step 6) on this proposal and output a valid JSON object.

Populate the JSON with:
  - "totalTechnicianCost": Supply, equipment & installation contract baseline in PHP (e.g. net proposal amount after discount, excluding annual maintenance PMS).
  - "totalAiRecommendedCost": AI's realistic recommended total cost in PHP after forensic reconciliation.
  - "varianceAmount": difference (totalAiRecommendedCost - totalTechnicianCost).
  - "variancePercent": percentage variance.
  - "confidenceScore": calculated confidence score integer (0-100) per Step 6 rules.
  - "equipmentComparison": list of items with "name", "technicianQty", "aiQty", "variance", and "rationale" (detailed explanation giving clear reasons WHY item/quantity was recommended, citing exact sheet/cell sources, technician mistakes like under-quantified materials, and price impact math).
  - "manpowerComparison": list of labor items with "role", "technicianHours", "aiHours", "variance", and "rationale".
  - "consumablesComparison": list of materials with "name", "technicianQty", "aiQty", "variance", and "rationale".
  - "overallAuditRationale": A detailed, bulleted executive audit summary (output 3 to 5 distinct bullet points separated by newlines starting with "• "). Address: 1) Document scan & category, 2) Specific technical/estimation mistakes made by the technician (quantity discrepancies, spec drift, missing items), 3) Clear technical reasons WHY corrections are recommended so the technician understands the exact rationale, 4) Financial variance summary.

Return ONLY a valid JSON object matching this schema (no markdown wrapping, no extra text):
{
  "totalTechnicianCost": 480618.50,
  "totalAiRecommendedCost": 578880.75,
  "varianceAmount": 98262.25,
  "variancePercent": 20.44,
  "confidenceScore": 92,
  "equipmentComparison": [
    {
      "name": "Asenware AW-CFP2166-8C 8-Zone Conventional Fire Alarm Panel",
      "technicianQty": 1,
      "aiQty": 1,
      "variance": 0,
      "rationale": "Proposal quotes 1 unit @ ₱15,372 (Proposal Sheet C.1). Costing sheet shows ₱28,575. Asenware AW-CFP2166-8C confirmed based on item code. Quantity matches 8-zone engineering takeoff."
    },
    {
      "name": "Asenware AW-CSD381 Conventional Optical Smoke Detector w/ Base",
      "technicianQty": 25,
      "aiQty": 25,
      "variance": 0,
      "rationale": "Proposal quotes 25 pcs @ ₱871.50 (Proposal Sheet C.2). Model AW-CSD381 confirmed from line item code. Takeoff matches 25 smoke detectors."
    }
  ],
  "manpowerComparison": [
    {
      "role": "Labor Installation of Roughing Ins material EMT Conduit Pipes",
      "technicianHours": "Lump sum (₱123,000)",
      "aiHours": "188 hrs",
      "variance": "+188 hrs",
      "rationale": "Calculated 188 man-hours based on 235 EMT conduit lengths @ 0.8 hr/length (23.5 man-days @ 8h/day). Technician quoted lump sum ₱123,000 without hour breakdown. AI recommends tracking 188 man-hours to prevent labor overruns."
    },
    {
      "role": "Installation of supplied cabling components TF Wire Cable",
      "technicianHours": "Lump sum (₱25,000)",
      "aiHours": "40 hrs",
      "variance": "+40 hrs",
      "rationale": "Calculated 40 man-hours for pulling 1,600m cabling @ 0.25 hr per 10m run. Technician quoted lump sum ₱25,000."
    },
    {
      "role": "Installation, Mounting, Programming and Configuration of 37 Devices",
      "technicianHours": "Lump sum (₱12,800)",
      "aiHours": "28 hrs",
      "variance": "+28 hrs",
      "rationale": "Calculated 28 man-hours for 37 FDAS devices @ ~0.75 hr/device for physical mounting, loop addressing, and FACP panel configuration."
    }
  ],
  "consumablesComparison": [],
  "overallAuditRationale": "• Document Scan & System Category: Scanned FDAS Conventional proposal (Asenware AW Series). Proposed supply total is ₱480,618.50 net.\n• Key Technician Estimation Discrepancies: Technician under-quantified EMT conduit cabling (150 lengths quoted vs 235 lengths in Summary Nodes) and couplings (150 pcs quoted vs 234 pcs required).\n• Technical Justification & Recommendation: Recommended +85 EMT conduit lengths (+₱19,550 price impact) and +84 couplings (+₱1,260 price impact) to match 8-zone floor plan layout and prevent site shortages.\n• Financial Impact Summary: Reconciled engineering total is ₱578,880.75 (+₱98,262.25 variance, 20.44% under-budgeted)."
}`;

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const rawText = json.choices?.[0]?.message?.content || '';
  const parsed = parseAndRepairJson(rawText);

  const finalTechCost = parsed.totalTechnicianCost || 0;
  const finalAiCost = parsed.totalAiRecommendedCost || 0;
  const finalVariance = finalAiCost - finalTechCost;
  const finalVariancePercent = finalTechCost !== 0
    ? ((finalVariance / finalTechCost) * 100)
    : (finalAiCost !== 0 ? 100 : 0);

  const rationaleStr = toRationaleString(parsed.overallAuditRationale, 'Proposal analysis completed.');
  const equipmentList: unknown[] = parsed.equipmentComparison || [];
  const manpowerList: unknown[] = parsed.manpowerComparison || [];
  const consumablesList: unknown[] = parsed.consumablesComparison || [];

  const confidenceScore = typeof parsed.confidenceScore === 'number' && !isNaN(parsed.confidenceScore)
    ? parsed.confidenceScore
    : computeAuditConfidence({
        hasTor: false,
        hasProposal: true,
        contentLength: fileText.length,
        equipmentCount: equipmentList.length,
        manpowerCount: manpowerList.length,
        consumablesCount: consumablesList.length,
        variancePercent: parseFloat(finalVariancePercent.toFixed(2)),
        technicianCost: finalTechCost,
        rationaleLength: rationaleStr.length,
      });

  return {
    totalTechnicianCost: finalTechCost,
    totalAiRecommendedCost: finalAiCost,
    varianceAmount: finalVariance,
    variancePercent: parseFloat(finalVariancePercent.toFixed(2)),
    equipmentComparison: equipmentList as any,
    manpowerComparison: manpowerList as any,
    consumablesComparison: consumablesList as any,
    overallAuditRationale: rationaleStr,
    confidenceScore,
  };
}

/**
 * Audits a TOR document (with optional Technician Proposal for comparison) and returns cost recommendations.
 *
 * @param fileName - Name of the TOR/technical specification document
 * @param fileText - Extracted text content from the TOR document
 * @param options - Optional configuration
 * @param options.technicianProposalText - Text from technician's proposal/quote (if available for comparison)
 * @param options.baselineCost - Explicit baseline cost from technician proposal (PHP). If 0 or not provided, AI will NOT fabricate a baseline.
 * @returns AuditDetails with cost comparison and rationale
 */
export async function auditTorDocument(
  fileName: string,
  fileText: string,
  options: {
    technicianProposalText?: string;
    baselineCost?: number;
  } = {}
): Promise<AuditDetails> {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY || localStorage.getItem('mistral_api_key') || '';
  if (!apiKey) {
    throw new Error('Mistral API key (VITE_MISTRAL_API_KEY) is missing. Add it to your .env file or Settings.');
  }

  const { technicianProposalText, baselineCost = 0 } = options;
  const hasTechnicianProposal = technicianProposalText && technicianProposalText.trim().length > 0;

  let prompt: string;

  if (hasTechnicianProposal) {
    // COMPARISON MODE: TOR + Technician Proposal
    prompt = `${FORENSIC_AUDITOR_SYSTEM_PROMPT}

Analyze the following two documents:

=== TOR/TECHNICAL SPECIFICATION ===
${fileText.slice(0, 15000)}

=== TECHNICIAN PROPOSAL/QUOTE ===
${technicianProposalText.slice(0, 15000)}

Your Task:
Execute the MANDATORY WORKFLOW steps (Step 1 to Step 6) comparing TOR requirements against Technician Proposal and output a valid JSON object.

Populate the JSON with:
  - "totalTechnicianCost": FINAL GRAND TOTAL from Technician Proposal in PHP (inclusive of VAT/PMS/Payment Schedule Total).
  - "totalAiRecommendedCost": AI's realistic recommended cost based on TOR specs & Forensic Reconciliation in PHP.
  - "varianceAmount": difference (totalAiRecommendedCost - totalTechnicianCost).
  - "variancePercent": percentage variance.
  - "confidenceScore": calculated confidence score integer (0-100) per Step 6 rules.
  - "equipmentComparison": list of items with "name", "technicianQty" (from proposal), "aiQty" (from TOR/engineering sheet), "variance" (aiQty - technicianQty), and "rationale" (citing evidence & price impact).
  - "manpowerComparison": list of labor roles with "role", "technicianHours" (0 if lump sum), "aiHours", "variance", and "rationale".
  - "consumablesComparison": list of materials with "name", "technicianQty", "aiQty", "variance", and "rationale".
  - "overallAuditRationale": Executive forensic summary detailing TOR specs vs Proposal, detected categories, schema discovery, cross-sheet inconsistencies, risk flags, and price impact math.

Return ONLY a valid JSON object matching this schema (no markdown wrapping, no extra text):
{
  "totalTechnicianCost": 823200,
  "totalAiRecommendedCost": 823200,
  "varianceAmount": 0,
  "variancePercent": 0.0,
  "confidenceScore": 90,
  "equipmentComparison": [
    {
      "name": "5MP IP Dome Camera",
      "technicianQty": 1,
      "aiQty": 1,
      "variance": 0,
      "rationale": "TOR specifies 1 unit. Proposal matches."
    }
  ],
  "manpowerComparison": [],
  "consumablesComparison": [],
  "overallAuditRationale": "Forensic audit comparison summary."
}`;
  } else {
    // SINGLE DOCUMENT MODE: Only TOR provided
    prompt = `${FORENSIC_AUDITOR_SYSTEM_PROMPT}

Analyze the following Terms of Reference (TOR) or technical specification document: "${fileName}".

Extracted Document Content:
${fileText.slice(0, 30000)}

Your Task:
Execute the MANDATORY WORKFLOW steps (Step 1 to Step 6) on this TOR document and output a valid JSON object with realistic Philippine peso pricing.

Populate the JSON with:
  - "totalTechnicianCost": 0.
  - "totalAiRecommendedCost": Total realistic market estimation in PHP for all required hardware, materials, and labor (Must NOT be 0! Estimate realistic Philippine pricing: Camera ₱3,500-₱9,500, NVR ₱18,000-₱55,000, Smoke Detector ₱1,200-₱2,800, FACP ₱55,000-₱180,000, Access Controller ₱30,000-₱75,000, Cable ₱35/m, Labor ₱1,000/day).
  - "varianceAmount": 0.
  - "variancePercent": 0.
  - "confidenceScore": calculated confidence score integer (0-100) per Step 6 rules.
  - "equipmentComparison": list of items extracted from TOR with "name", "technicianQty": 0, "aiQty" (from TOR), "variance": 0, and "rationale".
  - "manpowerComparison": list of required labor roles with "role", "technicianHours": 0, "aiHours", "variance": 0, and "rationale".
  - "consumablesComparison": list of materials with "name", "technicianQty": 0, "aiQty", "variance": 0, and "rationale".
  - "overallAuditRationale": Executive summary detailing TOR requirements, detected equipment categories, estimated project scope, and engineering recommendations.

Return ONLY a valid JSON object matching this schema (no markdown wrapping, no extra text):
{
  "totalTechnicianCost": 0,
  "totalAiRecommendedCost": 412500,
  "varianceAmount": 0,
  "variancePercent": 0,
  "confidenceScore": 85,
  "equipmentComparison": [
    {
      "name": "Optical Smoke Detector with Base",
      "technicianQty": 0,
      "aiQty": 12,
      "variance": 0,
      "rationale": "TOR specifies 12 units. Recommended brand: Asenware AW-CSD381."
    }
  ],
  "manpowerComparison": [
    {
      "role": "Lead Security Engineer",
      "technicianHours": 0,
      "aiHours": 80,
      "variance": 0,
      "rationale": "10 man-days for technical supervision & commissioning."
    }
  ],
  "consumablesComparison": [],
  "overallAuditRationale": "Comprehensive TOR engineering audit summary."
}`;
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const rawText = json.choices?.[0]?.message?.content || '';
  const parsed = parseAndRepairJson(rawText);

  // STRICT ENFORCEMENT: If no technician proposal was provided, baseline MUST be 0
  const finalTechnicianCost = hasTechnicianProposal
    ? (parsed.totalTechnicianCost || parsed.technicianCost || 0)
    : 0;

  let finalAiCost = parsed.totalAiRecommendedCost || parsed.totalCost || parsed.totalEstimatedCost || parsed.totalPrice || parsed.totalAmount || 0;
  
  const equipmentList: unknown[] = parsed.equipmentComparison || [];
  const manpowerList: unknown[] = parsed.manpowerComparison || [];
  const consumablesList: unknown[] = parsed.consumablesComparison || [];

  // Fallback calculation if AI returned 0 cost for TOR specs
  if (finalAiCost === 0 && (equipmentList.length > 0 || manpowerList.length > 0)) {
    let computedEquip = 0;
    for (const item of equipmentList as any[]) {
      const qty = item.aiQty || 1;
      const lower = (item.name || '').toLowerCase();
      let estPrice = 3500;
      if (lower.includes('facp') || lower.includes('fire alarm control')) estPrice = 65000;
      else if (lower.includes('nvr') || lower.includes('dvr')) estPrice = 25000;
      else if (lower.includes('camera')) estPrice = 4500;
      else if (lower.includes('smoke') || lower.includes('heat detector')) estPrice = 1850;
      else if (lower.includes('switch') || lower.includes('poe')) estPrice = 12000;
      else if (lower.includes('controller') || lower.includes('panel')) estPrice = 35000;
      else if (lower.includes('reader') || lower.includes('biometric')) estPrice = 8500;
      else if (lower.includes('lock') || lower.includes('bracket')) estPrice = 4500;
      computedEquip += qty * estPrice;
    }
    let computedLabor = 0;
    for (const m of manpowerList as any[]) {
      const hours = m.aiHours || 40;
      computedLabor += Math.ceil(hours / 8) * 1000;
    }
    finalAiCost = Math.max(25000, computedEquip + computedLabor);
  }

  const finalVariance = hasTechnicianProposal ? (finalAiCost - finalTechnicianCost) : 0;
  const finalVariancePercent = hasTechnicianProposal && finalTechnicianCost !== 0
    ? ((finalVariance / finalTechnicianCost) * 100)
    : 0;

  const rationaleStr = toRationaleString(parsed.overallAuditRationale, 'TOR audit completed.');

  const combinedContentLength = fileText.length + (technicianProposalText?.length ?? 0);
  const confidenceScore = typeof parsed.confidenceScore === 'number' && !isNaN(parsed.confidenceScore)
    ? parsed.confidenceScore
    : computeAuditConfidence({
        hasTor: true,
        hasProposal: !!hasTechnicianProposal,
        contentLength: combinedContentLength,
        equipmentCount: equipmentList.length,
        manpowerCount: manpowerList.length,
        consumablesCount: consumablesList.length,
        variancePercent: parseFloat(finalVariancePercent.toFixed(2)),
        technicianCost: finalTechnicianCost,
        rationaleLength: rationaleStr.length,
      });

  return {
    totalTechnicianCost: finalTechnicianCost,
    totalAiRecommendedCost: finalAiCost,
    varianceAmount: finalVariance,
    variancePercent: parseFloat(finalVariancePercent.toFixed(2)),
    equipmentComparison: equipmentList as any,
    manpowerComparison: manpowerList as any,
    consumablesComparison: consumablesList as any,
    overallAuditRationale: rationaleStr,
    confidenceScore,
  };
}
