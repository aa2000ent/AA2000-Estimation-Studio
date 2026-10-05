// Floor plan estimation service
// Phase 1 Vision: Mistral Pixtral (vision) — reads floor plan images
// Phase 2 BOQ:    Mistral Large — generates accurate quantities
// All calls go directly to the Mistral API using VITE_MISTRAL_API_KEY.

import { parseFile } from './fileParser';
import { getEstimatedItemPricing } from './pricelistService';

// Vision model — Pixtral supports multi-image input
const MISTRAL_VISION_MODEL = 'pixtral-12b-2409';
// BOQ reasoning model
const MISTRAL_REASONING_MODEL = 'mistral-large-latest';

export interface FloorPlanEstimation {
  observations: string;
  confidenceScore: number;
  quotationReferenceCode?: string;
  quotationHeader?: {
    attentionTo: string;
    thru: string;
    emailAdd: string;
    contactNo: string;
    company: string;
    address: string;
    projectSite: string;
    projectTitle: string;
    quoteDate: string;
    validityPeriod: string;
  };
  deviceSummary?: {
    facpBrand: string;
    systemType: string;
    totalUnitsText: string;
    buildingProfile: string;
    workingSchedule: string;
    remarks: string;
  };
  generalRequirements?: {
    itemNumber: number;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  scopeOfWorks?: {
    itemNumber: number;
    description: string;
    unit: string;
    qty?: number;
    unitPrice?: number;
    totalPrice: number;
  }[];
  costBreakdown?: {
    itemATotal: number;
    itemBTotal: number;
    subTotal: number;
    discount: number;
    subTotalWithDiscount: number;
    vat12Percent: number;
    grandTotalAmount: number;
  };
  scheduleOfPayment?: {
    itemCode: string;
    milestone: string;
    qty: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  termsAndConditions?: string[];
  manpower: {
    role: string;
    headcount: number;
    hours: number;
    manDays: number;
    ratePerDay?: number;
    totalCost?: number;
  }[];
  consumables: {
    name: string;
    category: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    srp?: number;
    contractorPrice?: number;
    dealerPrice?: number;
    totalPrice?: number;
  }[];
  fees: {
    type: string;
    amount: number;
    description: string;
  }[];
  constraints: {
    physical: string;
    electrical: string;
    installation: string;
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };
  });
}

function getMimeType(file: File): string {
  if (file.type && file.type !== '') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function isImageFile(file: File): boolean {
  const mime = getMimeType(file);
  return mime.startsWith('image/');
}

// Per-system equipment rules injected into the AI prompt
const SYSTEM_RULES: Record<string, { label: string; rules: string; exampleItems: string }> = {
  CCTV: {
    label: 'CCTV System',
    rules: `- IP Dome Camera: 1 per 80–100 sqm or per room/corridor entry point
- IP Bullet Camera: use for outdoor perimeter, parking lots, building exterior
- PTZ Camera: 1 per large open area (lobby, atrium, warehouse floor >500sqm)
- PoE Network Switch (8/16/24-port): 1 per 8–16 cameras
- NVR (Network Video Recorder): size based on camera count (8ch, 16ch, 32ch)
- Hard Disk Drive (HDD): calculate for 30-day retention at 1080p (≈1TB per 4 cameras)
- Cat6 UTP Cable: estimate total cable meters (avg 40–60m per camera + 10% slack); output unit as "meters"
- RJ45 Connectors: 2 per camera run
- Cable Tray / J-Hook: estimate in meters along ceiling runs
- Wall Mount Bracket / Dome Mount: 1 per camera
- UPS (Uninterruptible Power Supply): 1 per NVR rack`,
    exampleItems: `{ "name": "IP Dome Camera 2MP Full HD", "category": "Hardware", "quantity": 12, "unit": "pcs", "unitPrice": 0 },
    { "name": "NVR 16-Channel", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "PoE Switch 16-Port", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "HDD 4TB Surveillance Grade", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Cat6 UTP Cable", "category": "Wires & Cables", "quantity": 480, "unit": "meters", "unitPrice": 0 },
    { "name": "RJ45 Connector", "category": "Mounting Hardware", "quantity": 50, "unit": "pcs", "unitPrice": 0 }`,
  },
  FDAS: {
    label: 'FDAS / Fire Alarm System',
    rules: `- Smoke Detector (Photo-electric): 1 per 60 sqm ceiling area or per room
- Heat Detector: use in kitchens, parking, mechanical rooms (not smoke-sensitive zones)
- Manual Call Point (Break Glass / Pull Station): 1 per floor exit, max 30m spacing
- Fire Alarm Control Panel (FACP): size based on zone count (4-zone, 8-zone, 16-zone)
- Sounder / Alarm Bell: 1 per zone, spaced for 65dB coverage
- Strobe Light: 1 per zone for hearing-impaired compliance
- End-of-Line Resistor: 1 per zone circuit
- Fire Alarm Cable (2-core sheathed): estimate in meters — avg 25–40m per detector + 10% slack; unit "meters"
- Battery Backup (12V, 7Ah/17Ah): per FACP spec (typically 2 per panel)`,
    exampleItems: `{ "name": "Photoelectric Smoke Detector", "category": "Hardware", "quantity": 24, "unit": "pcs", "unitPrice": 0 },
    { "name": "Heat Detector", "category": "Hardware", "quantity": 6, "unit": "pcs", "unitPrice": 0 },
    { "name": "Manual Call Point", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "FACP 8-Zone Fire Alarm Control Panel", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Battery Backup 12V 7Ah", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Alarm Bell / Sounder", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Fire Alarm Cable 2-Core", "category": "Wires & Cables", "quantity": 350, "unit": "meters", "unitPrice": 0 }`,
  },
  ACCESS_CONTROL: {
    label: 'Access Control System',
    rules: `- Card Reader (Proximity / RFID): 1 per secured door (in + out = 2 if bidirectional)
- Electromagnetic Lock (Mag-lock): 1 per door controlled
- Access Control Controller / Panel: 1 per 2–4 doors (check capacity)
- Door Exit Button (REX): 1 per door inner side
- Door Sensor (Magnetic): 1 per controlled door
- Power Supply (12VDC / 24VDC): 1 per 2–4 locks
- Network Cable Cat6: estimate in meters for controller runs
- Electric Strike: alternative to mag-lock for outswing doors
- Biometric Reader: upgrade option for high-security zones
- UPS / Battery Backup: 1 per controller`,
    exampleItems: `{ "name": "Proximity Card Reader", "category": "Hardware", "quantity": 8, "unit": "pcs", "unitPrice": 0 },
    { "name": "Electromagnetic Lock 600lbs", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Access Controller 4-Door", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "UPS / Battery Backup 12VDC", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Exit Button / REX", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Cat6 UTP Cable", "category": "Wires & Cables", "quantity": 200, "unit": "meters", "unitPrice": 0 }`,
  },
  BURGLAR_ALARM: {
    label: 'Burglar Alarm System',
    rules: `- PIR Motion Detector: 1 per room / zone (covers 90° x 12m)
- Door/Window Contact Sensor: 1 per opening (door or window)
- Glass Break Detector: 1 per room with large glass panels
- Alarm Control Panel (DSC / Paradox / Hikvision): size based on zone count (8-zone, 16-zone, 32-zone)
- Outdoor Siren / Strobe: 1 per building face (front and rear minimum)
- Indoor Siren: 1 per floor
- Keypad: 1 per entry/exit zone
- Alarm Cable (4-core): estimate in meters — avg 20–30m per detector; unit "meters"
- SIM Card Communicator / GSM Module: 1 per panel for remote alerts`,
    exampleItems: `{ "name": "PIR Motion Detector", "category": "Hardware", "quantity": 12, "unit": "pcs", "unitPrice": 0 },
    { "name": "Door Contact Sensor", "category": "Hardware", "quantity": 8, "unit": "pcs", "unitPrice": 0 },
    { "name": "Alarm Control Panel 16-Zone", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Outdoor Siren with Strobe", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Alarm Cable 4-Core", "category": "Wires & Cables", "quantity": 220, "unit": "meters", "unitPrice": 0 }`,
  },
  DOOR_LOCK: {
    label: 'Door Lock System',
    rules: `- Hotel Door Lock / Smart Lock: 1 per guest room / private office door
- Lock Accessory (Magnetic cards, keyfobs): estimate based on expected users
- Smart Hotel Solution Software / Controller: 1 per reception/desk setup`,
    exampleItems: `{ "name": "Smart Hotel RFID Lock", "category": "Hardware", "quantity": 50, "unit": "pcs", "unitPrice": 0 },
    { "name": "Proximity RFID Guest Card", "category": "Hardware", "quantity": 200, "unit": "pcs", "unitPrice": 0 },
    { "name": "Smart Lock Controller Center", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 }`,
  },
  EAS_SYSTEM: {
    label: 'EAS System',
    rules: `- EAS Gate Antenna (Anti-theft): 1 pair per main retail exit point
- EAS Hard Tags / Soft Labels: estimate based on retail inventory count (packs of 1000)
- EAS Tag Detacher / Deactivator: 1 per cash register / POS station`,
    exampleItems: `{ "name": "EAS Anti-Theft Gate Antenna", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "EAS Hard Tag 58Khz (1000pcs/box)", "category": "Hardware", "quantity": 5, "unit": "pcs", "unitPrice": 0 },
    { "name": "EAS Magnetic Tag Detacher", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 }`,
  },
  FIRE_PROTECTION: {
    label: 'Fire Protection / Suppression System',
    rules: `- Sprinkler Head (Pendant / Upright): 1 per 9–12 sqm ceiling area
- Sprinkler Pipe (Schedule 40 Black Steel): estimate in meters along ceiling grid; unit "meters"
- Fire Suppression Cylinder (FM200 / CO2 / Novec): for server rooms — 1 per protected zone
- Fire Hose Cabinet (Reel or Box): 1 per 25–30m radius coverage
- Siamese Connection: 1 per building exterior (BFP requirement)
- Pressure Gauge / Flow Switch: 1 per riser/zone`,
    exampleItems: `{ "name": "Sprinkler Head Pendant Type", "category": "Hardware", "quantity": 40, "unit": "pcs", "unitPrice": 0 },
    { "name": "Schedule 40 Black Steel Pipe 1-inch", "category": "Protective Coverings", "quantity": 120, "unit": "meters", "unitPrice": 0 },
    { "name": "FM200 Suppression Cylinder 30kg", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Fire Hose Cabinet with Reel", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 }`,
  },
  FIXED_ARM_ELEVATOR: {
    label: 'Fixed Arm & Elevator Related System',
    rules: `- Elevator Access Controller: 1 per lift cabin/shaft (supports multi-floor control)
- Fixed Arm Bracket/Support: 1 per turnstile/barrier gate installation
- Elevator RFID Reader / Biometric Scanner: 1 per lift cabin`,
    exampleItems: `{ "name": "Elevator Control Panel 20-Floor", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Fixed Arm Mounting Pole", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Elevator Card Reader", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 }`,
  },
  INTERCOM_NURSE_CALL: {
    label: 'Intercom & Nurse Call System',
    rules: `- Video Intercom Door Station: 1 per building entry or lobby door
- Video Intercom Room Master Station: 1 per counter / security desk
- Nurse Call Master Panel: 1 per nurse station (sized for bed count)
- Patient Bed Station (with pull cord/button): 1 per hospital/clinic bed
- Hallway Dome Light: 1 per patient room entrance`,
    exampleItems: `{ "name": "Nurse Call Master Station 24-ch", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Patient Bed Call Button Station", "category": "Hardware", "quantity": 16, "unit": "pcs", "unitPrice": 0 },
    { "name": "Intercom Door Station", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Intercom Indoor Monitor 7-inch", "category": "Hardware", "quantity": 6, "unit": "pcs", "unitPrice": 0 }`,
  },
  PABX_PAGING: {
    label: 'PABX & Paging System',
    rules: `- PABX Central Control Box / IP-PBX: 1 per main wiring hub
- Paging Power Amplifier (120W/240W/350W): 1 per paging setup or zone
- Ceiling Speakers: 1 per 35-40 sqm ceiling space
- Wall / Column Speakers: 1 per corridor or warehouse zone
- Paging Microphone Console: 1 per reception/announcement area`,
    exampleItems: `{ "name": "PABX 8-Line 32-Extension Control Box", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Paging Amplifier 240W", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "PA Ceiling Speaker 6W", "category": "Hardware", "quantity": 30, "unit": "pcs", "unitPrice": 0 },
    { "name": "Paging Desktop Microphone Console", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 }`,
  },
  PARKING_BARRIER: {
    label: 'Parking Barrier System',
    rules: `- Barrier Gate Boom: 1 per parking entry or exit lane
- Parking Barrier Controller: 1 per lane checkpoint
- Vehicle Loop Detector: 2 per barrier gate (safety loop + trigger loop)
- UHF Long-Range RFID Reader: 1 per entry/exit lane for hands-free vehicle access
- Loop Detector Wire: estimate in meters (typically 15-20 meters per loop)`,
    exampleItems: `{ "name": "Automatic Parking Barrier Gate with 4m Boom", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "UHF RFID Long Range Reader", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Vehicle Loop Detector Module", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Loop Detector Wire", "category": "Wires & Cables", "quantity": 80, "unit": "meters", "unitPrice": 0 }`,
  },
  POS_SYSTEM: {
    label: 'POS System',
    rules: `- POS Terminal / POS Computer: 1 per cashier counter
- POS Thermal Receipt Printer: 1 per POS terminal
- Cash Drawer (Heavy duty): 1 per POS terminal
- Barcode Scanner (Handheld or Omni-directional): 1 per POS terminal`,
    exampleItems: `{ "name": "All-in-One Touchscreen POS Terminal", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 },
    { "name": "Thermal Receipt Printer 80mm", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 },
    { "name": "Heavy Duty Cash Drawer", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 },
    { "name": "USB Laser Barcode Scanner", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 }`,
  },
  ROOM_ALERT: {
    label: 'Room Alert System',
    rules: `- Room Alert Environment Monitor Unit: 1 per server room, data center, or telecom closet
- External Temperature/Humidity Sensor: 1–2 per server rack
- Water Flood Sensor: 1 per sub-floor or air-con unit location
- Dry Contact Smoke Sensor (Room Alert compliant): 1 per critical enclosure`,
    exampleItems: `{ "name": "Room Alert Environment Monitor Main Unit", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 },
    { "name": "Digital Temperature and Humidity Sensor", "category": "Hardware", "quantity": 4, "unit": "pcs", "unitPrice": 0 },
    { "name": "Flood Sensor Cable 10ft", "category": "Hardware", "quantity": 2, "unit": "pcs", "unitPrice": 0 }`,
  },
  XRAY_SECURITY: {
    label: 'X-Ray, Turnstile & Security Inspection System',
    rules: `- X-Ray Baggage Scanner: 1 per main building lobby entrance checkpoint
- Walk-Through Metal Detector (WTMD): 1 per entrance checkpoint lane
- Hand-Held Metal Detector: 1–2 per security guard station
- Tripod Turnstile or Flap Barrier: 1 per entrance lane (e.g. 3 lanes = 3 barriers)
- Turnstile Access Control Integration Board: 1 per turnstile setup`,
    exampleItems: `{ "name": "X-Ray Baggage Scanner Machine", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Walk-Through Metal Detector 33-Zone", "category": "Hardware", "quantity": 1, "unit": "pcs", "unitPrice": 0 },
    { "name": "Hand-Held Security Metal Detector Wand", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 },
    { "name": "Tripod Turnstile Gate", "category": "Hardware", "quantity": 3, "unit": "pcs", "unitPrice": 0 }`,
  },
};

// ─── STEP 1 PROMPT: Floor Plan & Document Visual Analysis ────────────────────
function buildAnalysisPrompt(
  surveyType: string,
  info: { buildingType?: string; floors?: number; location?: string; projectName?: string; surveyScope?: string; torContent?: string },
): string {
  const systemKeys = surveyType.split(',').map(s => s.trim().toUpperCase());
  const systems = systemKeys.filter(k => SYSTEM_RULES[k]);
  const systemLabel = systems.length > 0
    ? systems.map(k => SYSTEM_RULES[k].label).join(', ')
    : 'General Security System';

  let torBlock = '';
  if (info.torContent && info.torContent.trim().length > 0) {
    torBlock = `\n- TERMS OF REFERENCE (TOR) SPECIFICATIONS:\n${info.torContent}\n\n[MANDATORY INSTRUCTION] Carefully read the specifications above and extract the exact hardware models, brands, and device counts.`;
  }

  return `You are an expert Electronic Security, Safety, and Auxiliary Systems Estimator in the Philippines reviewing architectural floor plans, plotted equipment drawings, and technical specification / Terms of Reference (TOR) documents for a ${systemLabel} project.

PROJECT CONTEXT:
- Target System: ${systemLabel}
- Building Type: ${info.buildingType || 'Office'} (${info.floors || 1} floor(s))
- Location: ${info.location || 'Metro Manila, Philippines'}${info.projectName ? `\n- Project Name: ${info.projectName}` : ''}${info.surveyScope ? `\n- Stated Scope: ${info.surveyScope}` : ''}${torBlock}

CORE DIRECTIVES:
1. === THOROUGH DOCUMENT & TOR TABLE EXTRACTION ===
   - If the uploaded document is a Terms of Reference (TOR), Bill of Quantities, or Scope of Work:
     * Scan and read EVERY TABLE, ROW, AND COLUMN carefully (e.g. Item No., Equipment, Description, Quantity, Brand/Model).
     * Extract EVERY single equipment/material row into the "extractedTorItems" array with its exact name, specified brand/model, and quantity.
     * Include all itemized materials: cameras, power adapters, wireless PTP radios, network switches, server/data cabinets, UPS units, Cat6 cables, patch panels, patch cords, modular jacks, RJ45 plugs, THHN wires, duplex outlets, conduits, and pull boxes.
     * If a table notes "Please itemize the count" (e.g. for pipes, pull boxes, hangers, consumables): calculate realistic, scale-proportional quantities based on the physical device count (e.g., 1-4 cameras/radios = 10-15 pipe lengths, 2-4 standard utility boxes; NOT 100 pipes or 20 massive industrial enclosures!).
     * STRICT ANTI-HALLUCINATION: NEVER introduce or inject equipment from unrelated systems (e.g. NEVER add PBX phone systems, Fire Alarm panels, X-Ray machines, or turnstiles to a CCTV scope).

2. === LEGEND & SYMBOL KEY DIRECTIVE (FOR FLOOR PLANS) ===
   - If a floor plan with a "LEGEND" or "DEVICE SCHEDULE" is uploaded:
     * Count each symbol plotted on the floor plan using the exact Legend definitions.
     * Do NOT add unrequested extra hardware.

3. === PLOTTED SECURITY EQUIPMENT PLAN DIRECTIVE ===
   - Count only the icons plotted on the architectural layout corresponding to ${systemLabel}.

Respond in this EXACT JSON format (no markdown, no extra explanation):
{
  "floorCount": <number of floors visible or specified in the plans/TOR>,
  "estimatedTotalAreaSqm": <total built-up area in square meters — estimate from scale or use specified value>,
  "rooms": {
    "offices": <count of offices/workstations or 0>,
    "conferenceRooms": <count of conference rooms or 0>,
    "serverRooms": <count of server/telecom rooms or 0>,
    "toilets": <count of toilet rooms or 0>,
    "lobbies": <count of lobbies or 0>,
    "corridors": <count of corridors or 0>,
    "stairwells": <count of stairwells or 0>,
    "elevatorShafts": <count of elevators or 0>,
    "parkingSlots": <count of parking slots or 0>,
    "warehouse": <count of warehouses or 0>,
    "kitchen": <count of kitchens or 0>,
    "other": <count of other rooms or 0>
  },
  "doors": {
    "mainEntrances": <count of entrance doors or 0>,
    "fireExitDoors": <count of fire exits or 0>,
    "securedDoors": <count of doors needing access control or 0>,
    "regularDoors": <count of other doors or 0>
  },
  "ceilingHeightMeters": <estimated ceiling height or 3.0>,
  "buildingPerimeterMeters": <perimeter in meters or 100>,
  "observations": "Provide a clear summary of the exact specifications, equipment items, quantities, wireless links, and electrical/roughing-in requirements extracted from the TOR or floor plan.",
  "extractedTorItems": [
    {
      "name": "Exact hardware/service name with brand/model if specified",
      "quantity": <exact number specified>,
      "category": "Hardware"
    }
  ]
}`;
}

// ─── STEP 2 PROMPT: BOQ Generation from analysis data ────────────────────────
function buildBoqPrompt(
  surveyType: string,
  info: {
    buildingType?: string;
    floors?: number;
    location?: string;
    projectName?: string;
    surveyScope?: string;
    torContent?: string;
    selectedBrand?: string;
    clientName?: string;
    clientContactName?: string;
    clientEmail?: string;
    clientPhone?: string;
    systemTypes?: string[];
  },
  analysis: Record<string, unknown>,
): string {
  const systemKeys = surveyType.split(',').map(s => s.trim().toUpperCase());
  const systems = systemKeys.filter(k => SYSTEM_RULES[k]);
  const isTorUploaded = !!(info.torContent && info.torContent.trim().length > 0);

  let systemRulesBlock = '';
  if (isTorUploaded) {
    systemRulesBlock = `\n[CRITICAL] A Terms of Reference (TOR) or technical specification document is uploaded. Ignore standard generic calculation rules. You MUST generate ONLY the exact hardware, accessories, and quantities listed in the TOR.`;
  } else if (systems.length > 0) {
    systemRulesBlock = systems.map(key => {
      const s = SYSTEM_RULES[key];
      return `\n## ${s.label}\n${s.rules}`;
    }).join('\n');
  } else {
    systemRulesBlock = `\n## General Security Systems\n- Estimate equipment appropriate for the building type and floor plan\n- Include cabling in meters where applicable`;
  }

  const systemLabel = systems.length > 0
    ? systems.map(k => SYSTEM_RULES[k].label).join(' + ')
    : 'Security System';

  const rooms = analysis.rooms as Record<string, number> || {};
  const doors = analysis.doors as Record<string, number> || {};
  const totalRooms = Object.values(rooms).reduce((a, b) => a + (b || 0), 0);
  const totalAreaSqm = (analysis.estimatedTotalAreaSqm as number) || (totalRooms * 25);
  const perimeter = (analysis.buildingPerimeterMeters as number) || 100;
  const ceilingH = (analysis.ceilingHeightMeters as number) || 3.0;

  let torBlock = '';
  if (isTorUploaded) {
    torBlock = `\n\n=== TERMS OF REFERENCE (TOR) SPECIFICATIONS ===\n${info.torContent}\n\n[MANDATORY ESTIMATION COMPLIANCE] Your generated BOQ, manpower estimation, consumables, and cable lengths MUST strictly comply with the brands, model names, quantities, and roles specified in the TOR above.`;
  }

  let extractedTorItemsBlock = '';
  if (analysis.extractedTorItems && Array.isArray(analysis.extractedTorItems) && analysis.extractedTorItems.length > 0) {
    extractedTorItemsBlock = `\n\n=== EXACT HARDWARE & QUANTITIES EXTRACTED FROM TOR DOCUMENT ===\n${JSON.stringify(analysis.extractedTorItems, null, 2)}\n\n[CRITICAL DIRECTIVE] The items above were extracted directly from the uploaded Terms of Reference (TOR) or technical specifications document. You MUST include these exact items in the "consumables" array. DO NOT invent or append unrelated equipment (e.g. NO PBX, NO Fire Alarm panels on a CCTV scope).`;
  }

  let brandDirectiveBlock = '';
  if (info.selectedBrand && info.selectedBrand !== 'Generalized / Any Brand') {
    brandDirectiveBlock = `\n\n=== SELECTED BRAND DIRECTIVE ===\nThe user selected brand "${info.selectedBrand}". Include "${info.selectedBrand}" in item names where appropriate.`;
  }

  return `You are an expert Electronic Security, Safety, and Auxiliary Systems Estimator in the Philippines.

PROJECT PARAMETERS:
- Target System: ${systemLabel}
- Building: ${info.buildingType || 'Commercial/Campus'}, ${info.floors || 1} floor(s), ${info.location || 'Metro Manila'}
- Extracted Area: ~${totalAreaSqm} sqm, Perimeter: ~${perimeter}m, Ceiling: ~${ceilingH}m
- Observations: ${(analysis.observations as string) || 'N/A'}${extractedTorItemsBlock}${torBlock}${brandDirectiveBlock}

=== STRICT ANTI-HALLUCINATION & SCOPE DISCIPLINE ===
1. NEVER recommend, invent, or add equipment from unrelated systems (e.g. NEVER add PBX phone systems, Fire Alarm panels, Turnstiles, or Elevator boards to a CCTV scope).
2. If a TOR is provided, the "consumables" array must contain ONLY the specified items and their necessary mounting/cabling roughing-ins.

=== SCALE-PROPORTIONAL SIZING & PHILIPPINE PRICING RULES ===
1. ENCLOSURE / RACK SIZING:
   - For small setups (1-8 cameras/devices, 1 switch, 1 UPS): Use a **6U or 9U Wall-Mount Data Cabinet with Glass Door (₱4,500 - ₱6,800)**. NEVER specify a 42U Server Rack (₱125,000)!
   - For large enterprise setups (20+ cameras, multiple server racks): Use floor-standing racks.
2. PULL BOXES & CONDUITS:
   - Small job (1-4 devices / replacement / wireless link): 10-15 lengths EMT/PVC 3/4" (₱180-₱240/len), 2-4 standard utility/pull boxes (₱350-₱1,450/pc). NEVER add 50 pipes or 15 explosion-proof boxes!
3. MANPOWER CALCULATION (Scaled Proportportionally to Scope):
   - Small Scope (1-4 cameras / replacement / PTP link): 2 Technicians for 2-3 days (16-24 hours total) = ~₱12,000 - ₱25,000 total labor.
   - Medium Scope (5-16 cameras/devices): 3-4 Technicians for 5-7 days = ~₱35,000 - ₱65,000 labor.
   - Large Scope (17+ cameras / campus): Scaled with Lead Engineer and Safety Officer.
4. PHILIPPINE MARKET REALISTIC UNIT PRICES (PHP ₱):
   - RJ45 Plugs: ₱25 - ₱45 / pc
   - Cat6 Keystone Jack / Information Outlet: ₱250 - ₱350 / pc
   - Cat6 Patch Cord (1m-2m): ₱180 - ₱280 / pc
   - Cat6 UTP Cable (305m box): ₱8,500 - ₱11,500 / box
   - THHN 3.5mm² Wire: ₱35 - ₱45 / meter
   - Panasonic Duplex Outlet: ₱250 - ₱350 / set
   - 3/4" EMT Pipe (3m): ₱180 - ₱240 / length
   - 3/4" PVC Pipe (3m): ₱90 - ₱130 / length
   - Flexible Conduit: ₱35 - ₱55 / meter
   - Metal/Stainless Pull Box: ₱350 - ₱1,500 / pc
   - 1kVA UPS: ₱5,500 - ₱8,500 / unit
   - 8-Port Gigabit PoE Switch: ₱4,500 - ₱7,500 / unit
   - Cambium ePMP Force 180 (5GHz Radio): ₱6,800 - ₱8,500 / unit
   - 5MP IP Dome Camera: ₱4,500 - ₱6,800 / unit
   - 12V 2A Power Supply: ₱380 - ₱550 / unit

=== REQUIRED JSON OUTPUT STRUCTURE ===
Generate a valid JSON object matching this schema (all strings with newlines must use escaped \\n):

{
  "quotationReferenceCode": "PQ-${(info.systemTypes?.[0] || 'ENG').toUpperCase()}-2026-08-${Math.floor(100 + Math.random()*900)}",
  "quotationHeader": {
    "attentionTo": "${info.clientContactName || info.clientName || 'Facilities & Operations Head'}",
    "thru": "Property / Building Management",
    "emailAdd": "${info.clientEmail || 'client@domain.com'}",
    "contactNo": "${info.clientPhone || '0917-000-0000'}",
    "company": "${info.clientName || 'CLIENT INSTITUTION'}",
    "address": "${info.location || 'Metro Manila, Philippines'}",
    "projectSite": "${info.location || 'Site Location'}",
    "projectTitle": "${info.projectName || `${systemLabel.toUpperCase()} SUPPLY, INSTALLATION & COMMISSIONING`}",
    "quoteDate": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}",
    "validityPeriod": "30 days from date of this quotation"
  },
  "deviceSummary": {
    "facpBrand": "${info.selectedBrand && info.selectedBrand !== 'Generalized / Any Brand' ? info.selectedBrand.toUpperCase() : 'EQUIPMENT OEM SPECIFIED'}",
    "systemType": "${systemLabel.toUpperCase()} SYSTEM",
    "totalUnitsText": "Itemized Hardware & Active Devices Breakdown",
    "buildingProfile": "${info.floors || 1} Floor(s) ${info.buildingType ? `(${info.buildingType})` : ''}",
    "workingSchedule": "Standard Working Hours | Monday to Saturday",
    "remarks": "Scope strictly aligned with TOR / Site Specifications"
  },
  "generalRequirements": [
    { "itemNumber": 1, "description": "Mobilization/Demobilization & Delivery of Equipment", "qty": 1, "unit": "LOT", "unitPrice": 5000, "totalPrice": 5000 },
    { "itemNumber": 2, "description": "Safety compliance (PPE, signs, and basic safety gear)", "qty": 1, "unit": "LOT", "unitPrice": 2000, "totalPrice": 2000 },
    { "itemNumber": 3, "description": "Site supervision, administration & coordination works", "qty": 1, "unit": "LOT", "unitPrice": 3000, "totalPrice": 3000 }
  ],
  "scopeOfWorks": [
    { "itemNumber": 1, "description": "Roughing-ins, conduit routing, and cable pulling", "unit": "1 LOT", "totalPrice": 0 },
    { "itemNumber": 2, "description": "Hardware mounting, device termination, and wireless link alignment", "unit": "1 LOT", "totalPrice": 0 },
    { "itemNumber": 3, "description": "Testing, commissioning, integration with existing VMS/network, and turnover", "unit": "1 LOT", "totalPrice": 0 }
  ],
  "costBreakdown": {
    "itemATotal": 10000,
    "itemBTotal": 0,
    "subTotal": 0,
    "discount": 0,
    "subTotalWithDiscount": 0,
    "vat12Percent": 0,
    "grandTotalAmount": 0
  },
  "scheduleOfPayment": [
    { "itemCode": "A", "milestone": "Downpayment / Mobilization (40%)", "qty": 1, "unit": "LOT", "unitPrice": 0, "totalPrice": 0 },
    { "itemCode": "B", "milestone": "Progress Billing upon Delivery & Roughing-ins (30%)", "qty": 1, "unit": "LOT", "unitPrice": 0, "totalPrice": 0 },
    { "itemCode": "C", "milestone": "Final Testing, Commissioning & Turnover (30%)", "qty": 1, "unit": "LOT", "unitPrice": 0, "totalPrice": 0 }
  ],
  "termsAndConditions": [
    "Prices are in Philippine Pesos (PHP) and subject to standard VAT terms.",
    "Warranty: 1 Year on Equipment and Workmanship against manufacturing defects.",
    "Power source tapping and permit fees to be coordinated with facility administration."
  ],
  "observations": "Summary of extracted TOR equipment, wireless radio link requirements, and site conditions.",
  "confidenceScore": 95,
  "manpower": [
    { "role": "Lead Systems Technician", "headcount": 1, "hours": 24, "manDays": 3, "dayRate": 1200, "totalCost": 3600 },
    { "role": "Assistant Installer", "headcount": 1, "hours": 24, "manDays": 3, "dayRate": 900, "totalCost": 2700 }
  ],
  "consumables": [
    { "name": "Item Description", "brand": "Brand", "category": "Hardware", "quantity": 1, "unit": "pcs", "srp": 5500, "contractorPrice": 4800, "dealerPrice": 4200, "totalPrice": 5500 }
  ],
  "fees": [
    { "type": "Travel Fee", "amount": 3000, "description": "Mobilization to site (Metro Manila)" },
    { "type": "Permit Fee", "amount": 5000, "description": "Local permits and administrative coordination" }
  ],
  "constraints": {
    "physical": "Proper mounting brackets and clear line-of-sight required for wireless radio links.",
    "electrical": "Requires 220VAC clean power source with UPS protection.",
    "installation": "Coordination with building facilities for ceiling access and cable pathways."
  }
}`;
}

async function callMistral(
  messages: object[],
  model: string,
): Promise<string> {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('mistral_api_key') : '') || '';
  if (!apiKey) {
    throw new Error('Mistral API key (VITE_MISTRAL_API_KEY) is not set. Add it to your .env file or Settings.');
  }

  const isVision = model === MISTRAL_VISION_MODEL;
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: 16384,
  };

  if (!isVision) {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errMsg = `Mistral API error (${response.status})`;
    try {
      const errData = await response.json();
      errMsg = errData?.message || errData?.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawText: string | undefined = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Mistral returned an empty response. Try again.');
  return rawText;
}

// Text-only call helper
async function callMistralText(
  userContent: string,
  model: string,
  systemPrompt?: string,
): Promise<string> {
  const messages: object[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userContent });
  return callMistral(messages, model);
}

// Vision call — passes images as base64 data URIs alongside the text prompt
async function callMistralVision(
  imageParts: { inlineData: { mimeType: string; data: string } }[],
  text: string,
  model: string,
): Promise<string> {
  const contentParts: object[] = [
    ...imageParts.map(p => ({
      type: 'image_url',
      image_url: {
        url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
      },
    })),
    { type: 'text', text },
  ];
  const messages = [{ role: 'user', content: contentParts }];
  return callMistral(messages, model);
}

function sanitizeJsonString(str: string): string {
  const lines = str.split('\n').map(line => {
    const idx = line.indexOf('//');
    if (idx !== -1 && line.indexOf('http://') === -1 && line.indexOf('https://') === -1) {
      return line.substring(0, idx);
    }
    return line;
  });
  return lines.join('\n');
}

function parseAndRepairJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI service.');
  }

  let cleaned = rawText
    .replace(/^```(?:json)?\s*/gi, '')
    .replace(/\s*```$/gi, '')
    .trim();

  const startIdx = cleaned.indexOf('{');
  if (startIdx !== -1) {
    const endIdx = cleaned.lastIndexOf('}');
    if (endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    } else {
      cleaned = cleaned.substring(startIdx);
    }
  }

  let sanitized = cleaned
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[\]}])/g, '$1');

  sanitized = sanitizeJsonString(sanitized);

  sanitized = sanitized.replace(/\}\s*\{/g, '},{');
  sanitized = sanitized.replace(/"\s*\n\s*"/g, '",\n"');

  try {
    return JSON.parse(sanitized);
  } catch (err: any) {
    console.warn('Initial JSON parse failed, attempting auto-repair:', err.message);
  }

  let str = sanitized.trim();
  str = str.replace(/,\s*"[^"]*"?\s*:?\s*("[^"]*)?$/, '');
  str = str.replace(/,\s*$/, '');

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

function extractJson(raw: string): Record<string, any> {
  return parseAndRepairJson(raw);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyzeFloorPlan(
  imageFiles: File[],
  surveyType: string,
  buildingInfo: {
    buildingType?: string;
    floors?: number;
    location?: string;
    projectName?: string;
    surveyScope?: string;
    torContent?: string;
    selectedBrand?: string;
    clientName?: string;
    clientContactName?: string;
    clientEmail?: string;
    clientPhone?: string;
    systemTypes?: string[];
  }
): Promise<FloorPlanEstimation> {
  // Convert images to base64; extract text from documents
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
  let extractedDocsContent = '';

  if (imageFiles && imageFiles.length > 0) {
    for (const file of imageFiles) {
      const mime = getMimeType(file);
      if (mime.startsWith('image/')) {
        try {
          const base64 = await compressImage(file);
          imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
        } catch (err) {
          console.warn('Image compression failed, falling back to raw base64:', err);
          const base64 = await fileToBase64(file);
          imageParts.push({ inlineData: { mimeType: mime, data: base64 } });
        }
      } else {
        try {
          const parsed = await parseFile(file);
          if (parsed && parsed.content) {
            extractedDocsContent += `\n\n=== DOCUMENT CONTENT: ${file.name} ===\n${parsed.content}\n`;
          }
        } catch (err) {
          console.error(`Failed to parse document text for ${file.name}:`, err);
        }
      }
    }
  }

  const combinedInfo = {
    ...buildingInfo,
    torContent: `${buildingInfo.torContent || ''}${extractedDocsContent}`.trim(),
  };

  let analysis: Record<string, unknown> = {};

  if (imageParts.length > 0 || extractedDocsContent) {
    const phase1Prompt = buildAnalysisPrompt(surveyType, combinedInfo);
    let phase1Raw = '';

    if (imageParts.length > 0) {
      // Phase 1: Pixtral vision model for floor plan images
      console.log('Floor plan images detected. Using Mistral Pixtral vision for Phase 1 analysis...');
      try {
        phase1Raw = await callMistralVision(imageParts, phase1Prompt, MISTRAL_VISION_MODEL);
      } catch (err: any) {
        console.warn(`Pixtral vision failed: ${err.message || err}. Falling back to text-only analysis...`);
        phase1Raw = await callMistralText(phase1Prompt, MISTRAL_REASONING_MODEL, 'You are a precise floor plan analyzer. Return JSON only.');
      }
    } else {
      // Text-based documents only
      console.log('No floor plan images uploaded. Using Mistral text model for document structure analysis...');
      phase1Raw = await callMistralText(phase1Prompt, MISTRAL_REASONING_MODEL, 'You are a precise document analyzer. Return JSON only.');
    }

    try {
      analysis = extractJson(phase1Raw);
    } catch {
      console.warn('Phase 1 analysis parse failed, falling back to building info only');
      analysis = {
        floorCount: combinedInfo.floors || 1,
        estimatedTotalAreaSqm: (combinedInfo.floors || 1) * 300,
        observations: 'Floor plan / technical specifications analyzed from building information.',
      };
    }
  } else {
    // No files at all — simulate from building info
    analysis = {
      floorCount: combinedInfo.floors || 1,
      estimatedTotalAreaSqm: (combinedInfo.floors || 1) * 300,
      observations: `Estimation generated dynamically using building type: ${combinedInfo.buildingType || 'Office'} and floor count: ${combinedInfo.floors || 1}.`,
    };
  }

function sanitizeBoqResult(raw: any): FloorPlanEstimation {
  const safe: FloorPlanEstimation = {
    quotationReferenceCode: typeof raw?.quotationReferenceCode === 'string' ? raw.quotationReferenceCode : `PQ-BOQ-${Date.now().toString().slice(-6)}`,
    quotationHeader: {
      attentionTo: raw?.quotationHeader?.attentionTo || 'Client Representative',
      thru: raw?.quotationHeader?.thru || 'Project Manager',
      emailAdd: raw?.quotationHeader?.emailAdd || 'client@company.com',
      contactNo: raw?.quotationHeader?.contactNo || 'N/A',
      company: raw?.quotationHeader?.company || 'Project Client',
      address: raw?.quotationHeader?.address || 'Metro Manila',
      projectSite: raw?.quotationHeader?.projectSite || 'Metro Manila',
      projectTitle: raw?.quotationHeader?.projectTitle || 'Security & Safety Systems Installation',
      quoteDate: raw?.quotationHeader?.quoteDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      validityPeriod: raw?.quotationHeader?.validityPeriod || '30 days from date of quotation',
    },
    deviceSummary: {
      facpBrand: raw?.deviceSummary?.facpBrand || 'Standard Carried Brand',
      systemType: raw?.deviceSummary?.systemType || 'Security Systems',
      totalUnitsText: raw?.deviceSummary?.totalUnitsText || 'Total Units: As Estimated',
      buildingProfile: raw?.deviceSummary?.buildingProfile || 'Commercial / Office Facility',
      workingSchedule: raw?.deviceSummary?.workingSchedule || 'Regular Shift (8AM-5PM)',
      remarks: raw?.deviceSummary?.remarks || 'Subject to site verification',
    },
    generalRequirements: Array.isArray(raw?.generalRequirements)
      ? raw.generalRequirements.map((g: any, i: number) => ({
          itemNumber: Number(g?.itemNumber) || i + 1,
          description: String(g?.description || 'General Requirement Item'),
          qty: Number(g?.qty) || 1,
          unit: String(g?.unit || 'LOT'),
          unitPrice: Number(g?.unitPrice) || 0,
          totalPrice: Number(g?.totalPrice) || Number(g?.unitPrice) || 0,
        }))
      : [],
    scopeOfWorks: Array.isArray(raw?.scopeOfWorks)
      ? raw.scopeOfWorks.map((s: any, i: number) => ({
          itemNumber: Number(s?.itemNumber) || i + 1,
          description: String(s?.description || 'Scope Item'),
          unit: String(s?.unit || '1 LOT'),
          totalPrice: Number(s?.totalPrice) || 0,
        }))
      : [],
    costBreakdown: {
      itemATotal: Number(raw?.costBreakdown?.itemATotal) || 0,
      itemBTotal: Number(raw?.costBreakdown?.itemBTotal) || 0,
      subTotal: Number(raw?.costBreakdown?.subTotal) || 0,
      discount: Number(raw?.costBreakdown?.discount) || 0,
      subTotalWithDiscount: Number(raw?.costBreakdown?.subTotalWithDiscount) || 0,
      vat12Percent: Number(raw?.costBreakdown?.vat12Percent) || 0,
      grandTotalAmount: Number(raw?.costBreakdown?.grandTotalAmount) || 0,
    },
    scheduleOfPayment: Array.isArray(raw?.scheduleOfPayment)
      ? raw.scheduleOfPayment.map((p: any) => ({
          itemCode: String(p?.itemCode || 'A'),
          milestone: String(p?.milestone || 'Project Milestone'),
          qty: Number(p?.qty) || 1,
          unit: String(p?.unit || 'LOT'),
          unitPrice: Number(p?.unitPrice) || 0,
          totalPrice: Number(p?.totalPrice) || Number(p?.unitPrice) || 0,
        }))
      : [],
    termsAndConditions: Array.isArray(raw?.termsAndConditions)
      ? raw.termsAndConditions.map((t: any) => String(t || ''))
      : [],
    manpower: Array.isArray(raw?.manpower)
      ? raw.manpower.map((m: any) => {
          const headcount = Number(m?.headcount) || 1;
          const hours = Number(m?.hours) || 8;
          const manDays = Number(m?.manDays) || Math.ceil((headcount * hours) / 8);
          const ratePerDay = Number(m?.ratePerDay) || 1000;
          const totalCost = Number(m?.totalCost) || ratePerDay * manDays;
          return {
            role: String(m?.role || 'Installer'),
            headcount,
            hours,
            manDays,
            ratePerDay,
            totalCost,
          };
        })
      : [],
    consumables: Array.isArray(raw?.consumables)
      ? raw.consumables.map((c: any) => {
          const quantity = Number(c?.quantity) || 1;
          const unitPrice = Number(c?.unitPrice) || Number(c?.srp) || 0;
          const totalPrice = Number(c?.totalPrice) || unitPrice * quantity;
          return {
            name: String(c?.name || 'Equipment Item'),
            category: String(c?.category || 'Hardware'),
            quantity,
            unit: String(c?.unit || 'pcs'),
            unitPrice,
            srp: Number(c?.srp) || unitPrice,
            contractorPrice: Number(c?.contractorPrice) || unitPrice,
            dealerPrice: Number(c?.dealerPrice) || unitPrice,
            totalPrice,
          };
        })
      : [],
    fees: Array.isArray(raw?.fees)
      ? raw.fees.map((f: any) => ({
          type: String(f?.type || 'Fee'),
          amount: Number(f?.amount) || 0,
          description: String(f?.description || ''),
        }))
      : [],
    constraints: {
      physical: String(raw?.constraints?.physical || 'Standard site physical conditions.'),
      electrical: String(raw?.constraints?.electrical || '220V power supply available at main DB.'),
      installation: String(raw?.constraints?.installation || 'Standard working hours installation access.'),
    },
    confidenceScore: typeof raw?.confidenceScore === 'number' ? raw.confidenceScore : 85,
    observations: String(raw?.observations || 'Analysis completed successfully.'),
  };
  return safe;
}

/**
 * Attempts to extract the roll/reel length in meters from a pricelist item description.
 * e.g. "CAT6 23AWG UTP cable (305m roll)" → 305
 * Returns null if no roll length can be found.
 */
function extractRollLengthFromDescription(description: string): number | null {
  const match = description.match(/(\d+)\s*m\b/i);
  if (match) {
    const len = parseInt(match[1], 10);
    // Sanity-check: typical roll lengths are 50–1000m
    if (len >= 50 && len <= 2000) return len;
  }
  return null;
}

/** Returns true if the unit string indicates meters (linear measurement) */
function isMetricUnit(unit: string): boolean {
  const u = (unit || '').trim().toLowerCase();
  return u === 'm' || u === 'meters' || u === 'meter' || u === 'mtrs' || u === 'mtr';
}

  const phase2Prompt = buildBoqPrompt(surveyType, combinedInfo, analysis);
  const phase2Raw = await callMistralText(phase2Prompt, MISTRAL_REASONING_MODEL);
  let boq = extractJson(phase2Raw);
  boq = sanitizeBoqResult(boq);

  if (boq.consumables && Array.isArray(boq.consumables)) {
    const resolvedConsumables = await Promise.all(
      boq.consumables.map(async (c: any) => {
        try {
          const est = await getEstimatedItemPricing(c.name, 'contractor');
          const srpPerUnit = est.price;       // price per roll/unit as listed in pricelist
          const contractorPrice = est.contractorPrice;
          const dealerPrice = est.dealerPrice;
          const name = est.isAlternative
            ? `${est.brand} ${est.model} (Rec. Alt for ${c.name})`
            : (est.model && est.model !== c.name ? `${est.brand} ${est.model}` : c.name);

          // --- Unit Conversion: meters → rolls ---
          // If the BOQ says "300 meters" but the pricelist item is priced per roll (e.g. 305m roll),
          // we must divide to get how many rolls are needed, then price by the roll.
          let displayQty = c.quantity;
          let displayUnit = c.unit;
          let computedSrp = srpPerUnit;
          let totalPrice: number;

          if (isMetricUnit(c.unit) && est.foundInPricelist) {
            const rollLength = extractRollLengthFromDescription(est.description || '');
            if (rollLength) {
              const rollsNeeded = Math.ceil(c.quantity / rollLength);
              totalPrice = srpPerUnit * rollsNeeded;
              // Show qty as rolls, annotate with total meters for transparency
              displayQty = rollsNeeded;
              displayUnit = `roll(s) (${c.quantity}m @ ${rollLength}m/roll)`;
              computedSrp = srpPerUnit; // unit price stays per-roll
            } else {
              // No roll length found — price is likely already per-meter
              totalPrice = srpPerUnit * c.quantity;
            }
          } else {
            totalPrice = srpPerUnit * c.quantity;
          }

          return {
            ...c,
            name,
            brand: est.brand || (c as any).brand || '',
            srp: computedSrp,
            contractorPrice,
            dealerPrice,
            unitPrice: computedSrp,
            quantity: displayQty,
            unit: displayUnit,
            totalPrice
          };
        } catch {
          const srp = c.srp || c.unitPrice || 0;
          const contractorPrice = c.contractorPrice || Math.round(srp * 0.85);
          const dealerPrice = c.dealerPrice || Math.round(srp * 0.75);
          const totalPrice = c.totalPrice || (srp * c.quantity);
          return { ...c, srp, contractorPrice, dealerPrice, unitPrice: srp, totalPrice };
        }
      })
    );
    boq.consumables = resolvedConsumables;
  }

  // --- Dynamic Mathematical Quotation Recalculation ---
  // Ensure that all subtotals, VAT, grand totals, and payment milestones reflect the exact prices resolved from pricelistData.json
  const consumablesTotal = (boq.consumables || []).reduce((sum: number, c: any) => sum + (Number(c.totalPrice) || 0), 0);
  const manpowerTotal = (boq.manpower || []).reduce((sum: number, m: any) => sum + (Number(m.totalCost) || 0), 0);
  const generalReqsTotal = (boq.generalRequirements || []).reduce((sum: number, g: any) => sum + (Number(g.totalPrice) || 0), 0);
  const scopeOfWorksTotal = (boq.scopeOfWorks || []).reduce((sum: number, s: any) => sum + (Number(s.totalPrice) || 0), 0);
  const feesTotal = (boq.fees || []).reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);

  const calculatedItemATotal = generalReqsTotal > 0 ? generalReqsTotal : 10000;
  const calculatedItemBTotal = consumablesTotal + manpowerTotal + scopeOfWorksTotal + feesTotal;
  const calculatedSubTotal = calculatedItemATotal + calculatedItemBTotal;
  const discount = Math.min(Number(boq.costBreakdown?.discount) || 0, Math.round(calculatedSubTotal * 0.15));
  const subTotalWithDiscount = Math.max(0, calculatedSubTotal - discount);
  const vat12 = Math.round(subTotalWithDiscount * 0.12);
  const grandTotal = subTotalWithDiscount + vat12;

  boq.costBreakdown = {
    itemATotal: calculatedItemATotal,
    itemBTotal: calculatedItemBTotal,
    subTotal: calculatedSubTotal,
    discount,
    subTotalWithDiscount,
    vat12Percent: vat12,
    grandTotalAmount: grandTotal,
  };

  const downpayment = Math.round(grandTotal * 0.40);
  const progressBilling = Math.round(grandTotal * 0.30);
  const finalTurnover = grandTotal - downpayment - progressBilling;

  boq.scheduleOfPayment = [
    {
      itemCode: 'A',
      milestone: '1st Payment / Mobilization Downpayment (40%)',
      qty: 1,
      unit: 'LOT',
      unitPrice: downpayment,
      totalPrice: downpayment,
    },
    {
      itemCode: 'B',
      milestone: '2nd Payment / Progress Billing upon Delivery & Installation (30%)',
      qty: 1,
      unit: 'LOT',
      unitPrice: progressBilling,
      totalPrice: progressBilling,
    },
    {
      itemCode: 'C',
      milestone: '3rd Payment / Final Testing, Commissioning & Turnover (30%)',
      qty: 1,
      unit: 'LOT',
      unitPrice: finalTurnover,
      totalPrice: finalTurnover,
    },
  ];

  if (analysis.observations && typeof analysis.observations === 'string') {
    const obsStr = analysis.observations as string;
    if (obsStr.length > (boq.observations?.length || 0)) {
      boq.observations = obsStr;
    }
  }

  return sanitizeBoqResult(boq);
}

export async function testMistralConnection(): Promise<string> {
  return callMistralText('Reply with just: OK', MISTRAL_REASONING_MODEL);
}
