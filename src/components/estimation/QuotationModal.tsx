import React from 'react';
import type { Project } from '../../App';
import type { EstimationManpowerEntry, EstimationConsumableEntry, EstimationAdditionalFeeEntry } from '../../types';
import type { FloorPlanEstimation } from '../../services/geminiFloorPlanService';

export interface ScopeOfWorkEntry {
  id: string;
  itemNumber: number;
  description: string;
  unit: string;
  totalPrice: number;
}

export interface QuotationHeaderState {
  referenceCode: string;
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
}

import { canViewPrices } from '../../constants/roles';

interface QuotationModalProps {
  userRole?: string;
  project: Project;
  aiQuotation: FloorPlanEstimation | null;
  consumables: EstimationConsumableEntry[];
  manpower: EstimationManpowerEntry[];
  fees: EstimationAdditionalFeeEntry[];
  scopeOfWorks?: ScopeOfWorkEntry[];
  quotHeader: QuotationHeaderState;
  setQuotHeader: React.Dispatch<React.SetStateAction<QuotationHeaderState>>;
  quotDiscount: number;
  setQuotDiscount: (d: number) => void;
  showEditQuotation: boolean;
  setShowEditQuotation: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
}

export function generateSystemScopeOfWorks(
  systemTypes: string[],
  consumables: EstimationConsumableEntry[],
  projectName: string,
  computedTotal: number
): ScopeOfWorkEntry[] {
  const primarySys = (systemTypes?.[0] || 'CCTV').toUpperCase();
  
  if (primarySys.includes('FIRE') || primarySys.includes('FDAS')) {
    return [
      {
        id: '1',
        itemNumber: 1,
        description: 'FIRE ALARM CONTROL PANEL\nGeneral Cleaning & Diagnostic\n1. Air dust using portable air blower with non-conductive bristle inside and out.\n2. Use glass cleaners on glass cabinet covers.\n3. Use multi-purpose cleaner on Fire Alarm Control Panel Cabinet.\n4. Check all loop cards, battery charging circuit, and fault relays.\n5. Verify signal transmission to auxiliary interfaces and mimic panels.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '2',
        itemNumber: 2,
        description: 'MANUAL STATIONS / HORN STROBES / BELLS\nGeneral Cleaning & Physical Inspection\n1. Air dusting portable air blower with non-conductive bristle brush inside and out.\n2. Polish with "Armour All or its equivalent" inside and out.\n3. Replace damaged break glass or pull rods.\n4. Spray contact cleaners on alarm switch contacts.\n5. Tightening of terminal screw plugs and backbox check.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '3',
        itemNumber: 3,
        description: 'DETECTORS / SENSORS (SMOKE & HEAT)\nGeneral Cleaning & Chamber Servicing\n1. Air dusting of the chamber using portable air blower with non-conductive bristle brush.\n2. Check mounting and alignment with ceiling structure.\n3. Polish with "Armour All / or its equivalent" the smoke chamber vents.\n4. Air dusting and polishing of detector base.\n5. Spray contact cleaners on twist-lock terminals.\n6. Re-tightening of wire termination to ensure zero loose connections.\n7. Air dusting of smoke chamber screen mesh.\n8. Use specialized cleanser for parts that cannot be cleaned by soap and water.\n9. Provision of wire tagging and terminal lugs.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '4',
        itemNumber: 4,
        description: 'PROVIDING CERTIFICATE OF TESTING AND CERTIFICATE OF COMPLETION\n1. For the purpose of FSIC Renewal, provide the Fire Safety Maintenance Report (FSMR) signed by the building Admin and the FDAS service provider.\n2. Should in case the sign of the Fire Safety Practitioner (FSP) is required, this shall be billed separately.\n3. Reprogramming of address/location shall be billed separately after the PM for FDAS addressable devices only (if any).',
        unit: '1 LOT',
        totalPrice: Math.round(computedTotal * 0.95),
      },
      {
        id: '5',
        itemNumber: 5,
        description: 'REPLACEMENT OF DAMAGED DEVICES - This shall be billed SEPARATELY OR SUPPLIED BY THE OWNER.\n1. Relocation, rewiring, and major roughing-in works are not included in this proposal.\n2. Issuance of WARRANTY CERTIFICATE FOR 1 YEAR for the newly installed devices/equipments (if any).',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '6',
        itemNumber: 6,
        description: 'FREQUENCY: QUARTERLY ACTIVITY OF FDAS PMS\n• Submission of Testing/Technical report after the PM.\n• Cleaning of all the equipment listed above.\n• Inspection of all the equipment listed above.\n• Functional testing of detectors and devices including FACP.\n• Submission of completion report.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '7',
        itemNumber: 7,
        description: 'SMOKE DETECTOR TESTER - using smoke canister\n• Testing of smoke detector for functionality\n• Allocation: 2 cans of smoke canister',
        unit: '2 CANS',
        totalPrice: 3800,
      },
      {
        id: '8',
        itemNumber: 8,
        description: 'RENTAL OF TOOLS AND EQUIPMENTS\n• A-Type Ladder or 4-fold ladder\n• Basic technical tools including Multi-tester, Tone Tracer, Clamp meter\n• Cleaning materials and liquid solutions as cleanser for the devices',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '9',
        itemNumber: 9,
        description: 'FREEBIES:\n• Emergency Service response: 1x per quarter total of 4x per year\n• BFP Simulation Testing/BFP Fire Drill: 1x per year',
        unit: '1 LOT',
        totalPrice: 0,
      },
    ];
  } else if (primarySys.includes('ACCESS') || primarySys.includes('BIOMETRIC')) {
    return [
      {
        id: '1',
        itemNumber: 1,
        description: 'BIOMETRIC & RFID CARD READERS\nGeneral Cleaning & Optical Sensor Calibration\n1. Wipe and polish optical fingerprint prisms and facial recognition lenses using anti-static lens wipes.\n2. Test Wiegand/OSDP transmission speeds and controller response latency.\n3. Check weatherproof silicone gaskets and surface mount backplates.\n4. Clean and inspect keypads and tamper switches.\n5. Verify RFID 13.56MHz/125KHz badge read range and audible buzzer indicator.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '2',
        itemNumber: 2,
        description: 'ELECTROMAGNETIC LOCKS & DROPBOLTS\nMechanical & Electrical Holding Force Inspection\n1. Measure electromagnetic magnetic lock current draw and holding force (600lbs/1200lbs).\n2. Realign armature plates and replace worn rubber compression washers.\n3. Polish magnetic surfaces to eliminate residual dirt or metal shavings.\n4. Tighten heavy-duty ZL mounting brackets and security screws.\n5. Test fail-safe / fail-secure power-cut release action.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '3',
        itemNumber: 3,
        description: 'CENTRALIZED ACCESS CONTROLLERS & POWER SUPPLY UNITS\nControl Panel Diagnostic & Power Health Check\n1. Air dust controller enclosure and terminal headers using anti-static brushes.\n2. Conduct load test on 12VDC/24VDC 5A/7A backup batteries under simulated AC power loss.\n3. Inspect relay switch contacts and replace blown ceramic fuses.\n4. Re-terminate and label all reader, lock, exit button, and door contact wiring.\n5. Test TCP/IP communication and master controller sync.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '4',
        itemNumber: 4,
        description: 'REQUEST-TO-EXIT BUTTONS, BREAK GLASS & EMERGENCY RELEASE\nEmergency Egress Testing & Certification\n1. Physical activation testing of all no-touch infrared sensors and mechanical push buttons.\n2. Inspect emergency break glass switches and test fire alarm interlock release.\n3. Verify door status magnetic sensors and open-too-long door alarms.\n4. Comprehensive system validation and issuance of Certificate of Completion.',
        unit: '1 LOT',
        totalPrice: Math.round(computedTotal * 0.95),
      },
      {
        id: '5',
        itemNumber: 5,
        description: 'SOFTWARE DATABASE & FIRMWARE MAINTENANCE\nAccess Privileges & Event Audit\n1. Database backup of all enrolled user cards, biometric templates, and access level timezones.\n2. Purge and archive historical event logs.\n3. Update controller firmware to latest vendor release.\n4. Issuance of 1-Year Warranty Certificate for all active hardware components.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '6',
        itemNumber: 6,
        description: 'FREQUENCY: QUARTERLY ACTIVITY OF ACCESS CONTROL PMS\n• Submission of Technical & Preventive Maintenance audit report.\n• Functional testing of all card readers, biometric scanners, and locks.\n• Battery load testing and power integrity verification.\n• Emergency door release & fire alarm trip test.\n• Submission of completion report with client sign-off.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '7',
        itemNumber: 7,
        description: 'DIAGNOSTIC EQUIPMENT & CONSUMABLES\n• Provision of contact cleaner sprays, battery conductance tester, RFID test badges\n• Allocation of wire consumables and terminal shrink tubing',
        unit: '1 LOT',
        totalPrice: 3800,
      },
      {
        id: '8',
        itemNumber: 8,
        description: 'RENTAL OF SPECIALIZED TOOLS & METERS\n• Multi-tester, Digital Clamp Meter, Step Ladders, Precision screwdrivers\n• Network cable tester and tone generator',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '9',
        itemNumber: 9,
        description: 'FREEBIES:\n• Emergency Technical Support: 1x per quarter (total 4x per year)\n• User Privilege Audit & Remote Database Backup: 1x per year',
        unit: '1 LOT',
        totalPrice: 0,
      },
    ];
  } else if (primarySys.includes('INTRUSION') || primarySys.includes('BURGLAR') || primarySys.includes('ALARM')) {
    return [
      {
        id: '1',
        itemNumber: 1,
        description: 'MOTION DETECTORS (PIR) & GLASS BREAK SENSORS\nGeneral Cleaning & Detection Zone Calibration\n1. Dust and clean Fresnel lenses and microwave detector housings.\n2. Conduct detection walk test to eliminate blind spots and verify perimeter coverage.\n3. Calibrate pet-immunity thresholds and anti-masking sensitivity.\n4. Check tamper switch contacts and wall mounting stability.\n5. Inspect internal battery levels and signal strength (dBm).',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '2',
        itemNumber: 2,
        description: 'MAGNETIC DOOR / WINDOW CONTACTS & ROLLER SHUTTER SENSORS\nAlignment & Contact Integrity Test\n1. Clean magnetic reed contacts and remove metallic debris.\n2. Measure physical operating gap distance to prevent false alarms.\n3. Tighten mounting screws and verify armored cable sleeve protection.\n4. Test zone open/close triggering at control keypad.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '3',
        itemNumber: 3,
        description: 'MAIN SECURITY CONTROL PANEL & COMMUNICATOR\nCentral Processing & Telemetry Diagnostic\n1. Air dust main motherboard, power supply transformer, and terminal blocks.\n2. Battery discharge and recharge load test under simulated power outage.\n3. Test dual-path telemetry reporting (Ethernet IP, 4G/LTE SIM, and Cloud).\n4. Test strobe lights and external siren sound pressure output (minimum 105dB).\n5. Firmware upgrade and zone configuration backup.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '4',
        itemNumber: 4,
        description: 'SYSTEM TESTING, COMMISSIONING & CERTIFICATE OF COMPLETION\n1. Complete zone simulation testing and remote monitoring app push notification audit.\n2. Turn-over of updated zone map layout and operating documentation.\n3. Issuance of Certificate of Reliability and Testing.',
        unit: '1 LOT',
        totalPrice: Math.round(computedTotal * 0.95),
      },
      {
        id: '5',
        itemNumber: 5,
        description: 'REPLACEMENT OF DAMAGED DEVICES - BILLED SEPARATELY\n1. Relocation, rewiring, and civil conduits not included in this PMS agreement.\n2. 1-Year Warranty Certificate for all active replacement components.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '6',
        itemNumber: 6,
        description: 'FREQUENCY: QUARTERLY ACTIVITY OF INTRUSION PMS\n• Submission of Comprehensive Testing and Zone Audit Report.\n• Complete physical cleaning of all PIRs, contacts, and sirens.\n• Battery load testing and wireless signal verification.\n• Emergency siren and auto-dialer simulation.\n• Submission of accomplishment report.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '7',
        itemNumber: 7,
        description: 'TESTING TOOLS & BATTERY ALLOCATIONS\n• Allocation of replacement lithium batteries and sensor testing equipment',
        unit: '1 LOT',
        totalPrice: 3800,
      },
      {
        id: '8',
        itemNumber: 8,
        description: 'RENTAL OF TOOLS AND TESTING INSTRUMENTS\n• Step Ladders, Digital Multimeter, RF Signal Analyzer — FREE',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '9',
        itemNumber: 9,
        description: 'FREEBIES:\n• Emergency Technical Response: 1x per quarter (total 4x per year)\n• Remote Cloud System Health Check: 1x per year',
        unit: '1 LOT',
        totalPrice: 0,
      },
    ];
  } else {
    // Default CCTV / IP SURVEILLANCE & GENERAL SECURITY
    const systemName = (systemTypes?.[0] || 'CCTV').replace(/_/g, ' ');
    return [
      {
        id: '1',
        itemNumber: 1,
        description: 'IP & ANALOG SURVEILLANCE CAMERAS (DOME, BULLET, PTZ)\nGeneral Cleaning & Optical Alignment\n1. Clean and polish camera glass domes and optical lenses using specialized lint-free microfiber and optical cleaning solution.\n2. Adjust viewing angles, focus, and field-of-view to eliminate blind spots.\n3. Inspect weatherproof IP66/IP67 seals, cable glands, and junction boxes for moisture intrusion.\n4. Clean and test infrared (IR) LED arrays and ColorVu/Full-color warm light illuminators.\n5. Re-tighten camera mounting brackets, pan/tilt base screws, and safety tethers.\n6. Spray electronic contact cleaner on RJ45 and BNC/DC power terminals.\n7. Test PTZ motorized pan/tilt/zoom movement, presets, and cruise patterns.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '2',
        itemNumber: 2,
        description: 'NETWORK VIDEO RECORDERS (NVR) & SURVEILLANCE SERVERS\nInternal Dusting & Storage Health Diagnostics\n1. Air dust chassis interior, cooling fans, and motherboard using portable air blower with non-conductive bristle brush.\n2. Perform S.M.A.R.T. health diagnostics on all surveillance hard disk drives (HDD).\n3. Check RAID volume integrity, bad sectors, and storage overwrite settings.\n4. Clean chassis air intake filters and inspect internal power supply voltages.\n5. Verify camera bitrates, framerates, compression codec (H.265+), and video retention days.\n6. Update NVR and IP camera firmware to the latest stable vendor release.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '3',
        itemNumber: 3,
        description: 'NETWORK SWITCHES, CABLING & INFRASTRUCTURE\nPort Diagnostic & Transmission Integrity Verification\n1. Air dust PoE network switches, patch panels, and server rack cabinet.\n2. Test per-port PoE wattage consumption against camera load ratings.\n3. Check and re-terminate damaged RJ45 modular connectors and patch cords.\n4. Conduct cable continuity and signal integrity testing across all camera drops.\n5. Inspect cable conduits, EMT pipes, utility boxes, and cable tray paths.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '4',
        itemNumber: 4,
        description: 'VIDEO MANAGEMENT SOFTWARE, MONITORING & TESTING CERTIFICATION\n1. Optimize live-view matrix layout, video wall display, and workstation streaming latency.\n2. Calibrate motion detection zones, line crossing analytics, and intrusion detection alerts.\n3. Verify time server (NTP) synchronization across all cameras and recording servers.\n4. Turn-over of comprehensive Preventive Maintenance Accomplishment Report and Certificate of Testing.',
        unit: '1 LOT',
        totalPrice: Math.round(computedTotal * 0.95),
      },
      {
        id: '5',
        itemNumber: 5,
        description: 'REPLACEMENT OF DAMAGED DEVICES - BILLED SEPARATELY\n1. Major cable replacement, coring, and civil roughing-in works are billed separately if needed.\n2. Issuance of 1-Year Warranty Certificate for newly supplied cameras or hardware.',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '6',
        itemNumber: 6,
        description: `FREQUENCY: QUARTERLY ACTIVITY OF ${systemName} PMS\n• Submission of Camera Inspection & Video Health Audit Report.\n• Complete lens cleaning, focus adjustment, and housing inspection.\n• Storage S.M.A.R.T. diagnostic and video retention verification.\n• Central server and PoE switch load testing.\n• Submission of completion report with client sign-off.`,
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '7',
        itemNumber: 7,
        description: 'TESTING INSTRUMENTS & CLEANING CONSUMABLES\n• Lens optical cleaners, compressed air canisters, contact cleaner sprays\n• Allocation of RJ45 modular connectors and cable tagging materials',
        unit: '1 LOT',
        totalPrice: 3800,
      },
      {
        id: '8',
        itemNumber: 8,
        description: 'RENTAL OF TOOLS AND EQUIPMENTS\n• A-Type / 4-Fold Extension Ladders\n• CCTV Field Test Monitor, Digital Multi-tester, Tone Tracer & Cable Tester\n• Cleaning materials and specialized optical cloths',
        unit: '1 LOT',
        totalPrice: 0,
      },
      {
        id: '9',
        itemNumber: 9,
        description: 'FREEBIES:\n• Emergency Call-Out Support: 1x per quarter (total 4x per year)\n• Remote VMS Health Diagnostic & Software Optimization: 1x per year',
        unit: '1 LOT',
        totalPrice: 0,
      },
    ];
  }
}

export default function QuotationModal({
  userRole,
  project,
  aiQuotation,
  consumables,
  manpower,
  fees,
  scopeOfWorks,
  quotHeader,
  setQuotHeader,
  quotDiscount,
  setQuotDiscount,
  showEditQuotation,
  setShowEditQuotation,
  onClose,
}: QuotationModalProps) {
  if (!canViewPrices(userRole)) return null;
  // ── Compute dynamic values for the quotation document ─────────────────────
  const primarySys = (project.systemTypes?.[0] || 'CCTV').toUpperCase();
  const sysLabel = (project.systemTypes && project.systemTypes.length > 0)
    ? project.systemTypes.map(s => s.replace(/_/g, ' ')).join(' / ')
    : 'SECURITY AND TECHNOLOGY';

  const defaultSectionA = [
    { itemNumber: 1, description: 'Mobilization/Demobilization/Delivery of Equipment & Materials', qty: 1, unit: 'LOT', unitPrice: 12500, totalPrice: 12500 },
    { itemNumber: 2, description: 'CGL Insurance and Performance Bonds and other insurance\n(not included)', qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
    { itemNumber: 3, description: 'Daily Housekeeping and Proper Disposal of Waste', qty: 1, unit: 'LOT', unitPrice: 2000, totalPrice: 2000 },
    { itemNumber: 4, description: 'Safety, signs & barriers ( PPE,fire ext,etc.)& Safety Officer\n(not required, not included)', qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
    { itemNumber: 5, description: 'Administrative and Regular Coordination Works', qty: 1, unit: 'LOT', unitPrice: 3000, totalPrice: 3000 },
    { itemNumber: 6, description: 'Annual Professional Electronics Engineer (PECE) Certification\n(not required, not included)', qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
    { itemNumber: 7, description: 'Manpower Accomodation N/A', qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
    { itemNumber: 8, description: 'Site management and Supervision.', qty: 1, unit: 'LOT', unitPrice: 10000, totalPrice: 10000 },
    { itemNumber: 9, description: 'Temfacil / Staging Area PROVIDED BY THE CLIENT', qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
    { itemNumber: 10, description: `Certificate of Safety and Reliability\nCertificate of ${sysLabel} Testing and Completion\nwith sign and seal of PECE (not included)`, qty: 1, unit: 'LOT', unitPrice: 0, totalPrice: 0 },
  ];
  const sectionAItems = (aiQuotation?.generalRequirements && aiQuotation.generalRequirements.length > 0)
    ? aiQuotation.generalRequirements
    : defaultSectionA;
  const sectionATotal = sectionAItems.reduce((s, r) => s + (r.totalPrice || 0), 0);

  const consumablesCost = consumables.reduce((s, c) => s + (c.totalPrice || 0), 0);
  const manpowerCost = manpower.reduce((s, m) => s + (m.totalCost || 0), 0);
  const feesCost = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const dynamicBaseCost = (consumablesCost + manpowerCost + feesCost) > 0
    ? (consumablesCost + manpowerCost + feesCost)
    : 168390;

  const defaultSectionB = generateSystemScopeOfWorks(
    project.systemTypes || ['CCTV'],
    consumables,
    project.name,
    dynamicBaseCost
  );

  const sectionBItems = (scopeOfWorks && scopeOfWorks.length > 0)
    ? scopeOfWorks
    : (aiQuotation?.scopeOfWorks && aiQuotation.scopeOfWorks.length > 0)
    ? aiQuotation.scopeOfWorks
    : defaultSectionB;

  const sectionBComputed = sectionBItems.reduce((s, r) => s + (r.totalPrice || 0), 0)
    || (consumablesCost + manpowerCost + feesCost);

  const sectionBTotal = (aiQuotation?.costBreakdown?.itemBTotal != null && aiQuotation.costBreakdown.itemBTotal > 0)
    ? aiQuotation.costBreakdown.itemBTotal
    : (sectionBComputed > 0 ? sectionBComputed : 168390);

  const grandSubtotal = sectionATotal + sectionBTotal;
  const discountAmt = quotDiscount > 0
    ? quotDiscount
    : (aiQuotation?.costBreakdown?.discount != null ? aiQuotation.costBreakdown.discount : Math.min(8390, Math.round(grandSubtotal * 0.04)));
  const subWithDiscount = Math.max(0, grandSubtotal - discountAmt);
  const vatAmount = Math.round(subWithDiscount * 0.12);
  const grandTotal = subWithDiscount + vatAmount;

  const defaultPaySchedule = [
    { itemCode: 'A', milestone: '1st QUARTER / Mobilization Downpayment (40%)', qty: 1, unit: 'LOT', unitPrice: Math.round(grandTotal * 0.4), totalPrice: Math.round(grandTotal * 0.4) },
    { itemCode: 'B', milestone: '2nd QUARTER / Progress Payment (20%)', qty: 1, unit: 'LOT', unitPrice: Math.round(grandTotal * 0.2), totalPrice: Math.round(grandTotal * 0.2) },
    { itemCode: 'C', milestone: '3rd QUARTER / Progress Payment (20%)', qty: 1, unit: 'LOT', unitPrice: Math.round(grandTotal * 0.2), totalPrice: Math.round(grandTotal * 0.2) },
    { itemCode: 'D', milestone: '4th QUARTER / Final Testing & Turnover (20%)', qty: 1, unit: 'LOT', unitPrice: Math.round(grandTotal * 0.2), totalPrice: Math.round(grandTotal * 0.2) },
  ];
  const paySchedule = (aiQuotation?.scheduleOfPayment && aiQuotation.scheduleOfPayment.length > 0)
    ? aiQuotation.scheduleOfPayment
    : defaultPaySchedule;

  const defaultTerms = [
    'Unless specified, above given prices are still subject for EVAT computation.',
    'Prices are based on cost and conditions existing on date of quotation and are subject to change by the Seller upon final acceptance.',
    'Internal or External Local or wide area Network cabling for the purpose of remote monitoring is not included in this quotation, and shall be paid separately.',
    'If the Client opted to use their existing CPU/ Server which is bundled with Operating systems and/or Software Programs related to their daily operations, it must be compliant to the remote monitoring system purchased, otherwise, it would disable the intended normal function, and a separately price quotation for System Evaluation and Re-programming compatibility is needed to correct it.',
    'Government permits and approvals which might be needed to complete the above work are not included in the scope of works unless specified in this quotation.',
    'Circuit Breakers, temporarily or permanent electrical source shall be provided by client.',
    'The company guarantees the original user that the equipment and devices will be free of defects in material and workmanship for a period as stated below from the date of delivery provided the products has not been abused, misused or improperly maintained and /or repaired by unauthorized service personnel; or such defect on the product is the result of voltage surges / brownouts, lightning, water damage, flooding, fire, earthquakes, acts of aggression/ war or other similar phenomenon w/c the company has no control of, will such void the warranty.',
    'Others: Any other materials/equipment/permits/installation works not stated herein shall be considered as ADDITIONAL COST.',
    'Bonds: Unless otherwise stipulated in the investment summary, all premium costs for surety bonds, performance bonds, Contractors all-risk insurance, Warranty Bond for the account of the client.',
    'Warehouse Charges/Penalties: There will be a 500 pesos penalty per day, if devices are not picked up upon notice of availability',
    'A penalty charge of 40% of the total contract price will be imposed for cancellation of Purchase Order.',
    'Late Payment Penalty Charge: Any payments not made within the specified period of time for payment will incur an interest charge at the rate of 1% of the total contract price.',
  ];
  const termsItems = (aiQuotation?.termsAndConditions && aiQuotation.termsAndConditions.length > 0)
    ? aiQuotation.termsAndConditions
    : defaultTerms;

  const ds = aiQuotation?.deviceSummary;
  const totalDeviceCount = consumables.reduce((a, b) => a + b.quantity, 0);

  const fmt = (n: number) => n > 0 ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-';

  const renderDesc = (description: string) => {
    const lines = description.split('\n');
    const nonHeaderPrefixes = [
      'Should', 'Reprogramm', 'Relocation', 'Issuance', 'Submission',
      'Cleaning', 'Inspection', 'Functional', 'Allocation', 'Testing',
      'Replacement', 'Provision', 'Polish', 'Spray', 'Air', 'Re-',
      'Use', 'Check', 'Tighten', 'For the', '2.', '3.'
    ];

    return lines.map((line, li) => {
      const t = line.trim();
      if (!t) return null;
      const isHeader = li === 0;
      const startsWithNumber = /^\d+\./.test(t);
      const startsWithBullet = t.startsWith('•') || t.startsWith('-');
      const startsWithKnownAction = nonHeaderPrefixes.some(pfx => t.toLowerCase().startsWith(pfx.toLowerCase()));
      const isSubHeader = !isHeader && !startsWithNumber && !startsWithBullet && t.length < 60 && !startsWithKnownAction;

      if (isHeader) {
        return <strong key={li} className="block font-black text-indigo-950 uppercase text-[11px] mb-0.5">{t}</strong>;
      }
      if (isSubHeader) {
        return <span key={li} className="block font-bold text-slate-800 text-[11px]">{t}</span>;
      }
      return <span key={li} className="block text-slate-600 text-[11px] leading-relaxed">{t}</span>;
    });
  };

  const editFields: { key: keyof QuotationHeaderState; label: string }[] = [
    { key: 'referenceCode', label: 'Reference Code' },
    { key: 'quoteDate', label: 'Quote Date' },
    { key: 'validityPeriod', label: 'Validity Period' },
    { key: 'attentionTo', label: 'Attention To' },
    { key: 'company', label: 'Company Name' },
    { key: 'thru', label: 'Thru (Dept / Title)' },
    { key: 'address', label: 'Full Address' },
    { key: 'emailAdd', label: 'Email Address' },
    { key: 'contactNo', label: 'Contact No.' },
    { key: 'projectSite', label: 'Project Site' },
    { key: 'projectTitle', label: 'Project Title' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden my-6 text-slate-900 font-sans text-xs">

        {/* ── Modal Control Bar ── */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10 no-print">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500 rounded">{quotHeader.referenceCode || 'PQ-FDAS-2026-08-013'}</span>
            <span className="font-bold">AA2000 Commercial Sales Quotation</span>
            {aiQuotation && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-100">AI-Generated</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditQuotation(v => !v)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              {showEditQuotation ? 'Done Editing' : 'Edit Details'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print / PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ── Editable Details Panel ── */}
        {showEditQuotation && (
          <div className="bg-indigo-50 border-b-2 border-indigo-200 p-4 no-print">
            <p className="text-[9px] font-black uppercase text-indigo-600 mb-3 tracking-wider">Edit Quotation Details — changes apply to the printed document immediately</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {editFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[9px] font-black uppercase text-indigo-500 block mb-1">{label}</label>
                  <input
                    className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-indigo-400"
                    value={quotHeader[key]}
                    onChange={e => setQuotHeader(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-[9px] font-black uppercase text-indigo-500 block mb-1">Discount Amount (₱)</label>
                <input
                  type="number" min={0}
                  className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-indigo-400"
                  value={quotDiscount}
                  onChange={e => setQuotDiscount(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Printable Quotation Document ── */}
        <div className="p-6 space-y-4 bg-white printable-quotation">

          {/* 1 ▸ Header Banner */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-900 text-white p-4 items-start">
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-black text-xl text-white border-2 border-white shadow flex-shrink-0">AA</div>
                <div>
                  <h1 className="font-black text-xl tracking-wider text-white">AA2000</h1>
                  <p className="text-[9px] text-slate-300 font-semibold uppercase tracking-widest leading-tight">Security and Technology Solutions Inc.</p>
                </div>
              </div>
              <div className="col-span-7 text-right text-[10px] leading-snug">
                <p className="font-bold">Unit 2-C Norkis Building, 11 Calbayog Cor., Domingo M. Guevara St.,</p>
                <p>Mandaluyong City Philippines 1550</p>
                <p className="text-slate-300">T: (02) +8 571-5693 &nbsp;|&nbsp; M: 0917-884-8844 &nbsp;|&nbsp; E: aa2000ent@gmail.com &nbsp;|&nbsp; Web: www.aa2000ph.com</p>
              </div>
            </div>

            {/* Reference, Validity & Date */}
            <div className="grid grid-cols-12 text-xs">
              <div className="col-span-4 p-2.5 bg-slate-100 border-r border-b border-slate-300">
                <div className="font-black text-slate-800">QUOTATION</div>
                <div className="text-slate-600 text-[10px]">Validity of Quote:</div>
                <div className="font-bold text-[10px]">{quotHeader.validityPeriod}</div>
              </div>
              <div className="col-span-4 p-2.5 bg-slate-800 text-white text-center border-r border-b border-slate-900">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">REFERENCE CODE:</div>
                <div className="font-black text-base mt-0.5">{quotHeader.referenceCode || 'PQ-FDAS-2026-08-013'}</div>
              </div>
              <div className="col-span-4 p-2.5 bg-slate-100 border-b border-slate-300 text-right">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">DATE:</div>
                <div className="font-black">{quotHeader.quoteDate}</div>
              </div>
            </div>

            {/* Client Info Grid */}
            <div className="grid grid-cols-12 text-xs">
              <div className="col-span-6 p-2 border-r border-b border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">ATTENTION TO:</strong> {quotHeader.attentionTo || 'Mr. Jon Carlo A. Castronuevo'}</div>
              <div className="col-span-6 p-2 border-b border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">COMPANY:</strong> {quotHeader.company || 'JOLLIBEE CENTER CONDOMINIUM CORPORATION'}</div>
              <div className="col-span-6 p-2 border-r border-b border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">THRU:</strong> {quotHeader.thru || 'Building Manager'}</div>
              <div className="col-span-6 p-2 border-b border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">ADDRESS:</strong> {quotHeader.address || 'San Miguel Ave., Ortigas Center, Brgy. San Antonio'}</div>
              <div className="col-span-6 p-2 border-r border-b border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">EMAIL ADD:</strong> {quotHeader.emailAdd || 'jollibee_center@yahoo.com'}</div>
              <div className="col-span-6 p-2 border-b border-slate-200 bg-amber-50"><strong className="text-slate-500 text-[9px] uppercase">PROJECT SITE:</strong> {quotHeader.projectSite || 'Pasig City'}</div>
              <div className="col-span-6 p-2 border-r border-slate-200"><strong className="text-slate-500 text-[9px] uppercase">CONTACT NO.:</strong> {quotHeader.contactNo || '0917 709 1015'}</div>
              <div className="col-span-6 p-2 bg-amber-200/60"><strong className="text-slate-600 text-[9px] uppercase">PROJECT FOR:</strong> <span className="font-black">{quotHeader.projectTitle || 'FDAS PREVENTIVE MAINTENANCE FY: 2026 (QUARTERLY)'}</span></div>
            </div>

            {/* Intro text */}
            <div className="p-2.5 text-center text-[10px] border-t border-slate-200 text-slate-600 bg-white">
              We respectfully submit our proposal for your <strong>{sysLabel}</strong> System requirements. We look forward to the approval of our product sales quotation, as follows:
            </div>
          </div>

          {/* 2 ▸ Summary of Devices & Equipment */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-amber-400 font-black text-center py-1.5 uppercase tracking-wider text-slate-900 text-xs border-b border-slate-900">
              SUMMARY OF DEVICES AND OTHER {(project.systemTypes?.[0] || 'FDAS').replace(/_/g,' ').toUpperCase()} EQUIPMENT
            </div>
            <div className="grid grid-cols-12 text-xs">
              <div className="col-span-7 p-2 border-r border-b border-slate-300 font-bold">
                FACP BRAND : {ds?.facpBrand || (consumables[0]?.brand?.toUpperCase() || 'ASENWARE')}
              </div>
              <div className="col-span-5 p-2 border-b border-slate-300 font-bold text-red-700 text-[10px]">
                OTHER REMARKS: HIGH CEILING: NONE, ORDINARY HEIGHT | INTEGRATION: NOT DECLARED
              </div>
              <div className="col-span-7 p-2 border-r border-b border-slate-300 font-bold">
                {(project.systemTypes?.[0] || 'FDAS').replace(/_/g, ' ')} SYSTEM : {ds?.systemType || 'ADDRESSABLE FDAS'}
              </div>
              <div className="col-span-5 p-2 border-b border-slate-300 font-bold text-red-700 text-[10px]">
                WORKING SCHEDULES: DAY SHIFT 8AM-5PM ONLY | MONDAY TO SATURDAY SCHEDULE
              </div>
              <div className="col-span-7 p-2 border-r border-b border-slate-300 font-semibold text-[10px]">
                ESTIMATED NO. DEVICES: {ds?.totalUnitsText || (consumables.length > 0 ? `1-FACP, ${consumables.map(c => `${c.quantity}-${c.name.slice(0, 8)}`).join(', ')} (TOTAL: ${totalDeviceCount} UNITS)` : '1- FACP, 457-SD, 18-HD, 36-H/S, 36-MPS, 19 sets of modules for WF/TS (TOTAL: 567 UNITS)')}
              </div>
              <div className="col-span-5 p-2 border-b border-slate-300 font-semibold text-[10px]">
                STOREY BUILDING : {ds?.buildingProfile || `${project.floors || 16} FLOORS WITH ${project.floors ? Math.min(3, Math.floor(project.floors/5)) : 3} BASEMENT`}
              </div>
            </div>
            <div className="bg-red-100 text-red-800 p-2 text-[11px] font-bold">
              NOTE: MAKE SURE THAT THE ROOMS/AREAS ARE ACCESSIBLE PRIOR BEFORE MOBILIZATION
            </div>
          </div>

          {/* 3 ▸ Section A: General Requirements */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-xs">A.&nbsp;&nbsp;&nbsp;GENERAL REQUIREMENTS</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 font-bold text-slate-800">
                  <th className="p-2 border border-slate-300 w-10 text-center">ITEM</th>
                  <th className="p-2 border border-slate-300 text-left">DESCRIPTION</th>
                  <th className="p-2 border border-slate-300 w-12 text-center">QTY.</th>
                  <th className="p-2 border border-slate-300 w-14 text-center">UNIT</th>
                  <th className="p-2 border border-slate-300 w-24 text-right">UNIT PRICE</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                {sectionAItems.map((r, i) => {
                  const isFree = r.unitPrice === 0 && (r.description.toLowerCase().includes('safety officer') || r.description.toLowerCase().includes('free'));
                  return (
                    <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-200 text-center font-semibold align-top">{r.itemNumber}</td>
                      <td className="p-2 border-r border-slate-200 align-top">
                        {r.description.split('\n').map((line, li) => (
                          <span key={li} className={`block ${li === 0 ? 'font-semibold text-slate-800' : 'text-[10px] italic text-red-700'}`}>{line}</span>
                        ))}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center align-top">{r.qty || 1}</td>
                      <td className="p-2 border-r border-slate-200 text-center align-top">{r.unit}</td>
                      <td className="p-2 border-r border-slate-200 text-right align-top">
                        {isFree ? <span className="text-slate-800 font-bold">FREE</span> : (r.unitPrice ? fmt(r.unitPrice) : '-')}
                      </td>
                      <td className="p-2 text-right font-bold align-top">{r.totalPrice ? fmt(r.totalPrice) : '-'}</td>
                    </tr>
                  );
                })}
                {/* Note row matching reference image 1 */}
                <tr className="border-b border-slate-200 bg-amber-50/40">
                  <td className="p-2 border-r border-slate-200 text-center font-bold text-red-600 align-top">NOTE:</td>
                  <td className="p-2 border-r border-slate-200 align-top text-[10.5px]">
                    <p className="text-slate-800">1. Electric Power Supply for testing purposes shall be bare by the client.</p>
                    <p className="text-slate-800">2. Assistance from other service provider of integrated system of FDAS (Elevator and PA system) if needed</p>
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center align-top">1</td>
                  <td className="p-2 border-r border-slate-200 text-center align-top">LOT</td>
                  <td className="p-2 border-r border-slate-200 text-right align-top">-</td>
                  <td className="p-2 text-right font-bold align-top">-</td>
                </tr>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                  <td colSpan={5} className="p-2 text-right border-r border-slate-300 uppercase text-[11px] pr-4">SUB. TOTAL: ITEM A (1 TO {sectionAItems.length}):</td>
                  <td className="p-2 text-right font-black">{fmt(sectionATotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4 ▸ Section B: Scope of Works */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-xs">B.&nbsp;&nbsp;&nbsp;SCOPE OF WORKS</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 font-bold text-slate-800">
                  <th className="p-2 border border-slate-300 w-10 text-center">ITEM</th>
                  <th className="p-2 border border-slate-300 text-left">DESCRIPTION</th>
                  <th className="p-2 border border-slate-300 w-20 text-center">UNIT</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                {sectionBItems.map((item, i) => {
                  const desc = item.description || '';
                  const isFreqRow = desc.toLowerCase().includes('frequency') || desc.toLowerCase().includes('pms activity');
                  const isFreeRow = item.totalPrice === 0 && (desc.toLowerCase().includes('free') || desc.toLowerCase().includes('rental of tools') || desc.toLowerCase().includes('freebies'));
                  return (
                    <tr key={i} className={`border-b border-slate-200 ${isFreqRow ? 'bg-amber-300/80 font-bold' : 'hover:bg-slate-50'}`}>
                      <td className="p-2 border-r border-slate-200 text-center font-semibold align-top">{item.itemNumber}</td>
                      <td className={`p-2 border-r border-slate-200 leading-relaxed align-top ${isFreqRow ? 'text-slate-950 font-bold' : ''}`}>
                        {renderDesc(desc)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-semibold align-top">{item.unit || '1 LOT'}</td>
                      <td className="p-2 text-right font-bold align-top">
                        {isFreeRow
                          ? <span className="text-red-600 font-black">FREE</span>
                          : item.totalPrice ? fmt(item.totalPrice)
                          : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                  <td colSpan={3} className="p-2 text-right border-r border-slate-300 uppercase text-[11px] pr-4">SUB. TOTAL:</td>
                  <td className="p-2 text-right font-black">{fmt(sectionBTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5 ▸ Section C: Breakdown of Cost */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-xs">C.&nbsp;&nbsp;&nbsp;BREAKDOWN OF COST:</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 font-bold text-slate-800">
                  <th className="p-2 border border-slate-300 w-10 text-center">ITEM</th>
                  <th className="p-2 border border-slate-300 text-left">DESCRIPTION</th>
                  <th className="p-2 border border-slate-300 w-12 text-center">QTY.</th>
                  <th className="p-2 border border-slate-300 w-14 text-center">UNIT</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">UNIT PRICE</th>
                  <th className="p-2 border border-slate-300 w-32 text-right">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 border-r border-slate-200 text-center font-bold">A.</td>
                  <td className="p-2 border-r border-slate-200 font-bold">GENERAL REQUIREMENTS</td>
                  <td className="p-2 border-r border-slate-200 text-center">1</td>
                  <td className="p-2 border-r border-slate-200 text-center">LOT</td>
                  <td className="p-2 border-r border-slate-200 text-right">{fmt(sectionATotal)}</td>
                  <td className="p-2 text-right font-bold">{fmt(sectionATotal)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 border-r border-slate-200 text-center font-bold">B.</td>
                  <td className="p-2 border-r border-slate-200 font-bold">SCOPE OF WORKS</td>
                  <td className="p-2 border-r border-slate-200 text-center">1</td>
                  <td className="p-2 border-r border-slate-200 text-center">LOT</td>
                  <td className="p-2 border-r border-slate-200 text-right">{fmt(sectionBTotal)}</td>
                  <td className="p-2 text-right font-bold">{fmt(sectionBTotal)}</td>
                </tr>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <td colSpan={5} className="p-2 text-right border-r border-slate-200 font-bold uppercase text-[11px] pr-4">SUB. TOTAL:</td>
                  <td className="p-2 text-right font-black">{fmt(grandSubtotal)}</td>
                </tr>
                {discountAmt > 0 && (
                  <tr className="bg-red-50 border-b border-slate-200">
                    <td colSpan={5} className="p-2 text-right border-r border-slate-200 font-bold text-red-700 uppercase text-[11px] pr-4">LESS DISCOUNT:</td>
                    <td className="p-2 text-right font-black text-red-700">{fmt(discountAmt)}</td>
                  </tr>
                )}
                {discountAmt > 0 && (
                  <tr className="bg-slate-200 border-b border-slate-200">
                    <td colSpan={5} className="p-2 text-right border-r border-slate-200 font-bold uppercase text-[11px] pr-4">SUB. TOTAL W/ DISCOUNT:</td>
                    <td className="p-2 text-right font-black">{fmt(subWithDiscount)}</td>
                  </tr>
                )}
                <tr className="bg-amber-100 border-b border-amber-200">
                  <td colSpan={5} className="p-2 text-right border-r border-amber-200 font-bold text-red-600 uppercase text-[11px] pr-4">12% VAT</td>
                  <td className="p-2 text-right font-black text-red-600">{fmt(vatAmount)}</td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={4} className="p-3 text-right border-r border-slate-700 font-black uppercase tracking-wide text-[11px]">
                    {(project.systemTypes?.[0] || 'FDAS').replace(/_/g, ' ')} PMS PRICE PER YEAR
                  </td>
                  <td className="p-3 border-r border-slate-700 text-right font-black uppercase text-[11px]">TOTAL AMOUNT:</td>
                  <td className="p-3 text-right font-black text-emerald-400 text-base">{fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 6 ▸ Section D: Schedule of Payment */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-xs">D.&nbsp;&nbsp;&nbsp;SCHEDULE OF PAYMENT</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 font-bold text-slate-800">
                  <th className="p-2 border border-slate-300 w-10 text-center">ITEM</th>
                  <th className="p-2 border border-slate-300 text-left">DESCRIPTION</th>
                  <th className="p-2 border border-slate-300 w-12 text-center">QTY.</th>
                  <th className="p-2 border border-slate-300 w-14 text-center">UNIT</th>
                  <th className="p-2 border border-slate-300 w-28 text-right">UNIT PRICE</th>
                  <th className="p-2 border border-slate-300 w-32 text-right">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                {paySchedule.map((pay, i) => (
                  <tr key={i} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-200 text-center font-bold">{pay.itemCode}</td>
                    <td className="p-2 border-r border-slate-200 font-semibold">{pay.milestone}</td>
                    <td className="p-2 border-r border-slate-200 text-center">{pay.qty}</td>
                    <td className="p-2 border-r border-slate-200 text-center">{pay.unit}</td>
                    <td className="p-2 border-r border-slate-200 text-right">{fmt(pay.unitPrice)}</td>
                    <td className="p-2 text-right font-bold">{fmt(pay.totalPrice)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 border-t-2 border-slate-900">
                  <td colSpan={5} className="p-2 text-right border-r border-slate-300 uppercase font-bold text-[11px] pr-4">SUB. TOTAL:</td>
                  <td className="p-2 text-right font-black">{fmt(paySchedule.reduce((a, b) => a + (b.totalPrice || 0), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 7 ▸ Notes & Remarks */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-amber-400 font-black text-center py-1.5 uppercase text-slate-900 text-[11px] tracking-wide border-b border-slate-900">
              NOTE AND REMARKS:&nbsp;&nbsp;ALL INDICATED BELOW SHALL BE BILLED SEPARATELY
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {[
                  'Any additional services and materials that are not included in this quotation',
                  'Replacement of FACP, Annunciator, backup batteries, other supply of devices and equipment, and spare parts',
                  'Any additional civil and engineering works.',
                ].map((note, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 text-center font-bold w-10">{i + 1}</td>
                    <td className="p-2 text-slate-700 font-medium">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 8 ▸ Terms & Conditions */}
          <div className="border-2 border-slate-900 rounded-lg p-4 bg-slate-50">
            <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1.5 mb-3 text-center">TERMS AND CONDITIONS</h4>
            <div className="space-y-2">
              {termsItems.map((term, i) => (
                <div key={i} className="flex gap-2 text-[10.5px]">
                  <span className="font-black text-slate-700 shrink-0 w-6">{String.fromCharCode(65 + i)}</span>
                  <span className="text-slate-700 font-medium leading-relaxed">{term}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 9 ▸ Payment Terms & Sign-off Block */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
            <div className="bg-amber-400 font-black text-center py-1.5 uppercase text-slate-900 text-[11px] tracking-wide border-b border-slate-900">
              PAYMENT TERMS: QUARTERLY FEE: FULL PAYMENT AFTER SUBMISSION OF ACCOMPLISHMENT REPORT.
            </div>

            <div className="p-4 bg-white space-y-4">
              <div className="flex items-center gap-2 text-xs border-b border-slate-200 pb-2">
                <span className="font-black text-slate-900 uppercase">PAYEE</span>
                <span className="text-slate-600">PO and payment issued in favor of:</span>
                <span className="font-black text-indigo-900">AA2000 Security and Technology Solution Inc.</span>
              </div>

              <div className="grid grid-cols-2 gap-12 pt-2">
                <div>
                  <p className="font-bold text-[11px] text-slate-700 mb-1">SUBMITTED BY:</p>
                  <div className="h-12 flex items-end">
                    <svg className="w-32 h-10 text-slate-800" viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10,25 Q30,5 50,20 T90,15 T110,25" />
                      <path d="M20,30 Q45,15 70,25" />
                    </svg>
                  </div>
                  <div className="border-t-2 border-slate-900 pt-1">
                    <p className="font-black text-slate-900 text-xs">PRINCESS ALGABRE</p>
                    <p className="font-bold text-[10px] text-slate-600">GENERAL MANAGER</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-[11px] text-slate-700 mb-1">Client&apos;s / Customer Conforme:</p>
                  <div className="h-12"></div>
                  <div className="border-t-2 border-slate-900 pt-1">
                    <p className="font-bold text-[10px] text-slate-600">Authorized Representative (Printed Name/Signature/Date)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dark Notice Bar */}
            <div className="bg-slate-800 text-white p-3 text-center text-[10px] font-semibold border-t-2 border-slate-900">
              <span className="font-bold uppercase tracking-wider block mb-0.5 text-slate-300">NOTICE</span>
              This proposal will be regarded as an order confirmation upon acceptance. Kindly acknowledge with your signature accompanied by a Purchase Order and/or company stamp. Thank you for your trust and confidence.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
