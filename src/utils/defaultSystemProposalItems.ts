import type {
  EstimationAdditionalFeeEntry,
  EstimationConsumableEntry,
  EstimationManpowerEntry,
} from '../types';

const uid = (prefix = 'row'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export interface DefaultSystemItems {
  active: EstimationConsumableEntry[];
  roughing: EstimationConsumableEntry[];
  cable: EstimationConsumableEntry[];
  manpower: EstimationManpowerEntry[];
  fees: EstimationAdditionalFeeEntry[];
}

export function getDefaultSystemItems(systemTypeOrName: string): DefaultSystemItems {
  const norm = systemTypeOrName.toUpperCase();

  if (/FDAS|FIRE|ALARM/i.test(norm)) {
    const sys = 'FDAS';
    return {
      active: [
        {
          id: uid('fdas_act'),
          name: 'Addressable Optical Smoke Detector with Base',
          productId: 'AW-ASD2188',
          brand: 'Asenware',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 4,
          unit: 'pcs',
          srp: 1850,
          unitPrice: 1850,
          totalPrice: 7400,
          notes: 'Addressable photoelectric smoke detector with LED indicator',
        },
        {
          id: uid('fdas_act'),
          name: 'Addressable Rate-of-Rise Heat Detector with Base',
          productId: 'AW-ATD2188',
          brand: 'Asenware',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 2,
          unit: 'pcs',
          srp: 1950,
          unitPrice: 1950,
          totalPrice: 3900,
          notes: 'Fixed temperature & rate-of-rise thermal detector',
        },
        {
          id: uid('fdas_act'),
          name: 'Manual Pull Station (Break Glass / Dual Action)',
          productId: 'AW-AMC2188',
          brand: 'Asenware',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 2,
          unit: 'pcs',
          srp: 2200,
          unitPrice: 2200,
          totalPrice: 4400,
          notes: 'Addressable manual call point with reset key',
        },
        {
          id: uid('fdas_act'),
          name: 'Fire Alarm Horn Strobe / Sounder Beacon 24VDC',
          productId: 'AW-CSS2166',
          brand: 'Asenware',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 2,
          unit: 'pcs',
          srp: 2400,
          unitPrice: 2400,
          totalPrice: 4800,
          notes: 'High decibel audible and visual strobe warning device',
        },
        {
          id: uid('fdas_act'),
          name: 'Fire Alarm Control Panel (FACP) 2-Loop Addressable',
          productId: 'FP300-2L',
          brand: 'Asenware',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 1,
          unit: 'unit',
          srp: 65000,
          unitPrice: 65000,
          totalPrice: 65000,
          notes: '2-Loop panel with LCD, battery backup & built-in power supply',
        },
      ],
      roughing: [
        {
          id: uid('fdas_rgh'),
          name: 'Red EMT Conduit Pipe 20mm (1/2" x 10ft)',
          productId: 'EMT-RED-20',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 25,
          unit: 'pcs',
          srp: 280,
          unitPrice: 280,
          totalPrice: 7000,
          notes: 'Fire-code compliant red electrical metallic tubing',
        },
        {
          id: uid('fdas_rgh'),
          name: 'Octagonal Junction Box 4x4 with Red Cover',
          productId: 'JB-OCT-RED',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 10,
          unit: 'pcs',
          srp: 85,
          unitPrice: 85,
          totalPrice: 850,
          notes: 'Deep stamped octagonal steel box with red finish',
        },
        {
          id: uid('fdas_rgh'),
          name: 'EMT Connectors & Couplings 20mm',
          productId: 'EMT-FIT-20',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 30,
          unit: 'pcs',
          srp: 25,
          unitPrice: 25,
          totalPrice: 750,
          notes: 'Zinc die-cast set-screw connectors and couplings',
        },
        {
          id: uid('fdas_rgh'),
          name: 'Conduit Clamps and Expansion Anchors',
          productId: 'EMT-CLP-SET',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 50,
          unit: 'pcs',
          srp: 15,
          unitPrice: 15,
          totalPrice: 750,
          notes: 'Heavy duty pipe clamps with wall anchors and screws',
        },
      ],
      cable: [
        {
          id: uid('fdas_cbl'),
          name: 'Fire-Rated Signal Wire / TF Wire 16/2 AWG FPLR Shielded',
          productId: 'FPLR-16-2',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 150,
          unit: 'm',
          srp: 45,
          unitPrice: 45,
          totalPrice: 6750,
          notes: 'Fire-resistant shielded 2-conductor copper wire',
        },
      ],
      manpower: [
        {
          id: uid('fdas_lab'),
          role: 'FDAS Lead Installation Specialist',
          headcount: 2,
          hours: 16,
          manDays: 2,
          dayRate: 1800,
          totalCost: 7200,
          responsibilities: 'FDAS device installation, pipe roughing-ins, and wire pulling.',
        },
        {
          id: uid('fdas_lab'),
          role: 'FDAS Commissioning & Testing Engineer',
          headcount: 1,
          hours: 8,
          manDays: 1,
          dayRate: 2500,
          totalCost: 2500,
          responsibilities: 'Loop addressing, panel programming, smoke/heat detector simulation testing.',
        },
      ],
      fees: [
        {
          id: uid('fdas_fee'),
          type: 'mobilization',
          amount: 2500,
          description: 'Mobilization, Safety Equipment & PPE for FDAS Installation',
          notes: 'FDAS Fire Alarm System',
        },
        {
          id: uid('fdas_fee'),
          type: 'permits',
          amount: 3500,
          description: 'BFP / Fire Code Inspection & Testing Coordination',
          notes: 'FDAS Fire Alarm System',
        },
      ],
    };
  }

  if (/ACCESS/i.test(norm)) {
    const sys = 'ACCESS CONTROL';
    return {
      active: [
        {
          id: uid('acc_act'),
          name: 'Biometric & RFID Card Access Controller',
          productId: 'F22-ID',
          brand: 'ZKTeco',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 1,
          unit: 'set',
          srp: 14500,
          unitPrice: 14500,
          totalPrice: 14500,
          notes: 'Standalone fingerprint & RFID keypad controller with TCP/IP',
        },
        {
          id: uid('acc_act'),
          name: '600 lbs Electromagnetic Lock with LZ Bracket',
          productId: 'EML-600',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 1,
          unit: 'set',
          srp: 3800,
          unitPrice: 3800,
          totalPrice: 3800,
          notes: 'Anodized aluminum single door maglock with LED indicator',
        },
        {
          id: uid('acc_act'),
          name: 'Touchless Infrared Push-to-Exit Button',
          productId: 'EB-NO-TOUCH',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 1,
          unit: 'pcs',
          srp: 1450,
          unitPrice: 1450,
          totalPrice: 1450,
          notes: 'Optical sensor wave-to-exit stainless steel button',
        },
        {
          id: uid('acc_act'),
          name: '12V 5A Centralized Access Power Supply with Backup Battery',
          productId: 'PS-1205B',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 1,
          unit: 'unit',
          srp: 3200,
          unitPrice: 3200,
          totalPrice: 3200,
          notes: 'Metal enclosure power supply with 12V 7Ah SLA battery',
        },
      ],
      roughing: [
        {
          id: uid('acc_rgh'),
          name: 'uPVC Molding & Surface Conduit 20mm',
          productId: 'MOLD-20',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 8,
          unit: 'pcs',
          srp: 145,
          unitPrice: 145,
          totalPrice: 1160,
          notes: 'Architectural surface raceway with double-sided adhesive and anchors',
        },
      ],
      cable: [
        {
          id: uid('acc_cbl'),
          name: '4-Core Shielded Signal & Power Cable',
          productId: 'SH-4C-22',
          brand: 'Generic',
          category: sys,
          systemType: sys,
          systemLabel: sys,
          quantity: 50,
          unit: 'm',
          srp: 35,
          unitPrice: 35,
          totalPrice: 1750,
          notes: 'Stranded copper shielded access control interconnect cable',
        },
      ],
      manpower: [
        {
          id: uid('acc_lab'),
          role: 'Access Control Installation Technician',
          headcount: 2,
          hours: 8,
          manDays: 1,
          dayRate: 1800,
          totalCost: 3600,
          responsibilities: 'Door lock mounting, bracket installation, controller wiring.',
        },
      ],
      fees: [
        {
          id: uid('acc_fee'),
          type: 'mobilization',
          amount: 1500,
          description: 'Mobilization & Equipment Logistics for Access Control',
          notes: 'Access Control System',
        },
      ],
    };
  }

  // Default: CCTV System
  const sys = 'CCTV';
  return {
    active: [
      {
        id: uid('cctv_act'),
        name: '4 MP IP Dome Camera with IR & PoE',
        productId: 'DS-2CD1143G0-I',
        brand: 'Hikvision',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 3,
        unit: 'pcs',
        srp: 8500,
        unitPrice: 8500,
        totalPrice: 25500,
        notes: '4MP vandal-resistant fixed dome network camera, WDR, IR up to 30m',
      },
      {
        id: uid('cctv_act'),
        name: '4 MP IP Bullet Camera Outdoor Weatherproof',
        productId: 'DS-2CD1043G0-I',
        brand: 'Hikvision',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 1,
        unit: 'pcs',
        srp: 9200,
        unitPrice: 9200,
        totalPrice: 9200,
        notes: '4MP IP67 weatherproof fixed bullet network camera for perimeter',
      },
      {
        id: uid('cctv_act'),
        name: '8-Channel Network Video Recorder (NVR) with 2TB Surveillance HDD',
        productId: 'DS-7608NI-Q1',
        brand: 'Hikvision',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 1,
        unit: 'unit',
        srp: 16500,
        unitPrice: 16500,
        totalPrice: 16500,
        notes: '8-channel 4K NVR with 2TB Skyhawk/Purple surveillance drive pre-installed',
      },
      {
        id: uid('cctv_act'),
        name: '8-Port Gigabit PoE Network Switch 120W',
        productId: 'DS-3E0109P-E',
        brand: 'Hikvision',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 1,
        unit: 'unit',
        srp: 5800,
        unitPrice: 5800,
        totalPrice: 5800,
        notes: '8-port PoE 100/1000M switch with 30W per port budget',
      },
    ],
    roughing: [
      {
        id: uid('cctv_rgh'),
        name: 'uPVC Conduit Pipe 20mm (1/2" x 3m)',
        productId: 'PVC-20',
        brand: 'Neltex',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 20,
        unit: 'pcs',
        srp: 165,
        unitPrice: 165,
        totalPrice: 3300,
        notes: 'High-impact electrical grade uPVC orange conduit pipe',
      },
      {
        id: uid('cctv_rgh'),
        name: 'Utility Box 2x4 and Weatherproof Junction Box 4x4',
        productId: 'JB-WP-44',
        brand: 'Generic',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 8,
        unit: 'pcs',
        srp: 75,
        unitPrice: 75,
        totalPrice: 600,
        notes: 'Outdoor rated weatherproof camera mounting bases & surface junction boxes',
      },
      {
        id: uid('cctv_rgh'),
        name: 'PVC Solvent Cement and Mounting Clamps',
        productId: 'PVC-CLP-SET',
        brand: 'Generic',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 1,
        unit: 'lot',
        srp: 650,
        unitPrice: 650,
        totalPrice: 650,
        notes: 'Solvent cement can, conduit clips, masonry screws & wall plugs',
      },
    ],
    cable: [
      {
        id: uid('cctv_cbl'),
        name: 'Cat6 UTP 4-Pair Pure Copper Cable',
        productId: 'CAT6-UTP-BC',
        brand: 'Belden',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 150,
        unit: 'm',
        srp: 32,
        unitPrice: 32,
        totalPrice: 4800,
        notes: '23 AWG bare copper gigabit unshielded twisted pair network cable',
      },
      {
        id: uid('cctv_cbl'),
        name: 'Cat6 RJ45 Modular Connectors with Boots',
        productId: 'RJ45-C6-20',
        brand: 'Generic',
        category: sys,
        systemType: sys,
        systemLabel: sys,
        quantity: 20,
        unit: 'pcs',
        srp: 18,
        unitPrice: 18,
        totalPrice: 360,
        notes: 'Gold-plated 8P8C modular plugs with protective strain-relief boots',
      },
    ],
    manpower: [
      {
        id: uid('cctv_lab'),
        role: 'ELV Senior Installation Technician',
        headcount: 2,
        hours: 16,
        manDays: 2,
        dayRate: 1800,
        totalCost: 7200,
        responsibilities: 'CCTV camera mounting, cable pulling, and RJ45 terminations.',
      },
      {
        id: uid('cctv_lab'),
        role: 'CCTV System Configuration Specialist',
        headcount: 1,
        hours: 8,
        manDays: 1,
        dayRate: 2200,
        totalCost: 2200,
        responsibilities: 'NVR network setup, IP addressing, motion recording, and mobile remote access.',
      },
    ],
    fees: [
      {
        id: uid('cctv_fee'),
        type: 'mobilization',
        amount: 3000,
        description: 'Mobilization, Site Logistics & Equipment Delivery',
        notes: 'CCTV Surveillance System',
      },
    ],
  };
}

const isCable = (item: EstimationConsumableEntry): boolean =>
  /cable|wire|utp|fiber|fibre/i.test(`${item.category} ${item.name}`) &&
  !/cable tray|cable tie|cable clip/i.test(item.name);

const isRough = (item: EstimationConsumableEntry): boolean =>
  /rough|conduit|pipe|pvc|trunk|junction|mount|bracket|fastener|anchor|clamp|tape|connector|label|cable tray|cable tie/i.test(
    `${item.category} ${item.name}`
  );

/**
 * Checks all active systems for missing proposal items (Active, Roughing, Cable, Labor, Fees)
 * and populates defaults so no section is empty.
 */
export function ensureSystemProposalItems(
  systems: string[],
  currentManpower: EstimationManpowerEntry[] = [],
  currentConsumables: EstimationConsumableEntry[] = [],
  currentFees: EstimationAdditionalFeeEntry[] = []
): {
  manpower: EstimationManpowerEntry[];
  consumables: EstimationConsumableEntry[];
  fees: EstimationAdditionalFeeEntry[];
} {
  const manpower = [...currentManpower];
  const consumables = [...currentConsumables];
  const fees = [...currentFees];

  const targetSystems = (systems && systems.length > 0) ? systems : ['CCTV'];

  targetSystems.forEach(sysName => {
    const defaults = getDefaultSystemItems(sysName);
    const sysUpper = sysName.toUpperCase();
    const isSysMatch = (catOrLabel = '', text = ''): boolean => {
      const combined = `${catOrLabel} ${text}`.toUpperCase();
      if (/FDAS|FIRE/i.test(sysUpper)) return /FDAS|FIRE/i.test(combined);
      if (/CCTV|SURVEILLANCE/i.test(sysUpper)) return /CCTV|CAMERA|SURVEILLANCE|NVR/i.test(combined);
      if (/ACCESS/i.test(sysUpper)) return /ACCESS|DOOR|LOCK/i.test(combined);
      return combined.includes(sysUpper) || sysUpper.includes(combined);
    };

    // 1. Check Active components
    const hasActive = consumables.some(
      item =>
        !isCable(item) &&
        !isRough(item) &&
        isSysMatch(item.systemLabel || item.systemType || item.category, item.name)
    );
    if (!hasActive) {
      defaults.active.forEach(item => consumables.push({ ...item }));
    }

    // 2. Check Roughing-ins
    const hasRough = consumables.some(
      item =>
        isRough(item) &&
        !isCable(item) &&
        isSysMatch(item.systemLabel || item.systemType || item.category, item.name)
    );
    if (!hasRough) {
      defaults.roughing.forEach(item => consumables.push({ ...item }));
    }

    // 3. Check Cable
    const hasCable = consumables.some(
      item =>
        isCable(item) &&
        isSysMatch(item.systemLabel || item.systemType || item.category, item.name)
    );
    if (!hasCable) {
      defaults.cable.forEach(item => consumables.push({ ...item }));
    }

    // 4. Check Manpower
    const hasLabor = manpower.some(row =>
      isSysMatch('', `${row.role} ${row.responsibilities || ''}`)
    );
    if (!hasLabor) {
      defaults.manpower.forEach(row => manpower.push({ ...row }));
    }

    // 5. Check Fees
    const hasFees = fees.some(row =>
      isSysMatch('', `${row.type} ${row.description || ''} ${row.notes || ''}`)
    );
    if (!hasFees) {
      defaults.fees.forEach(row => fees.push({ ...row }));
    }
  });

  return { manpower, consumables, fees };
}
