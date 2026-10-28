import React from 'react';
import type { EstimationConsumableEntry } from '../../types';

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

interface QuotationModalProps {
  quotHeader: QuotationHeaderState;
  setQuotHeader: React.Dispatch<React.SetStateAction<QuotationHeaderState>>;
  /** Builds the same report HTML the PDF export renders, so preview and PDF cannot drift. */
  buildReportHtml: () => string;
  onDownloadPdf: () => void;
  isExportingPdf: boolean;
  onClose: () => void;
  isDark?: boolean;
}

const REPORT_WIDTH = 794;

const HEADER_FIELDS: Array<{ key: keyof QuotationHeaderState; label: string }> = [
  { key: 'attentionTo', label: 'Attention To' },
  { key: 'thru', label: 'Position' },
  { key: 'company', label: 'Company' },
  { key: 'contactNo', label: 'Tel/Mobile No.' },
  { key: 'emailAdd', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'projectTitle', label: 'Project For' },
  { key: 'projectSite', label: 'Project Site' },
  { key: 'referenceCode', label: 'Reference No.' },
  { key: 'quoteDate', label: 'Date' },
  { key: 'validityPeriod', label: 'Validity' },
];

export default function QuotationModal({
  quotHeader,
  setQuotHeader,
  buildReportHtml,
  onDownloadPdf,
  isExportingPdf,
  onClose,
  isDark = false,
}: QuotationModalProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const [frameHeight, setFrameHeight] = React.useState(1123);
  const paneRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  let reportHtml = '';
  let reportError = '';
  try {
    reportHtml = buildReportHtml();
  } catch (error) {
    reportError = error instanceof Error ? error.message : 'The report could not be built.';
  }
  // An iframe keeps the report's own CSS from leaking into the app (and vice versa).
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${reportHtml}</body></html>`;

  React.useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const update = () => setScale(Math.min(1, (pane.clientWidth - 32) / REPORT_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  const measureFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    setFrameHeight(doc.documentElement.scrollHeight);
    // Images load after the document; re-measure once they settle.
    Array.from(doc.images).forEach(img => {
      if (!img.complete) img.addEventListener('load', () => setFrameHeight(doc.documentElement.scrollHeight), { once: true });
    });
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const surface = isDark ? 'bg-[#131B2E] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800';
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/30 ${
    isDark ? 'bg-[#0D1527] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  }`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quotation preview"
        className={`w-full max-w-5xl h-full max-h-[96vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${surface}`}
        onClick={e => e.stopPropagation()}
      >
        <header className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 className="text-lg font-black">Quotation Preview</h2>
            <p className={`text-xs ${subtle}`}>Exactly what the downloaded PDF will contain</p>
          </div>
          <div className="flex items-center gap-2">
            {quotHeader.referenceCode && (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${isDark ? 'border-blue-900 text-blue-300' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                {quotHeader.referenceCode}
              </span>
            )}
            <button
              onClick={() => setShowDetails(v => !v)}
              aria-expanded={showDetails}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              {showDetails ? 'Done editing' : 'Edit client details'}
            </button>
            <button onClick={onClose} aria-label="Close preview" className={`p-1.5 rounded-lg cursor-pointer ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        {showDetails && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-5 py-4 border-b ${isDark ? 'border-slate-800 bg-[#0F172A]' : 'border-slate-200 bg-slate-50'}`}>
            {HEADER_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${subtle}`}>{label}</span>
                <input
                  className={inputCls}
                  value={quotHeader[key]}
                  onChange={e => setQuotHeader(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}

        <div ref={paneRef} className={`flex-1 overflow-auto p-4 ${isDark ? 'bg-[#0B132B]' : 'bg-slate-100'}`}>
          {reportError ? (
            <div className="m-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm font-semibold">{reportError}</div>
          ) : (
            <div className="mx-auto shadow-lg" style={{ width: REPORT_WIDTH * scale, height: frameHeight * scale }}>
              <iframe
                ref={frameRef}
                title="Quotation report preview"
                srcDoc={srcDoc}
                onLoad={measureFrame}
                scrolling="no"
                style={{ width: REPORT_WIDTH, height: frameHeight, border: 0, background: '#fff', transform: `scale(${scale})`, transformOrigin: 'top left' }}
              />
            </div>
          )}
        </div>

        <footer className={`flex justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
            Close
          </button>
          <button
            onClick={onDownloadPdf}
            disabled={isExportingPdf || Boolean(reportError)}
            aria-busy={isExportingPdf}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isExportingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </footer>
      </div>
    </div>
  );
}
