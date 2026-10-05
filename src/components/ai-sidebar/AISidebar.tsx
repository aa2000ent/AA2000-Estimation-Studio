import { useState, useRef, useCallback } from 'react';
import { parseFile, type ParsedFile } from '../../services/fileParser';
import type { Project, AIScanGroup } from '../../App';
import { DEFAULT_TECHNICIANS } from '../../constants/roles';
import { useToast } from '../utils/Toast';


interface Props {
  onCreateProject?: (project: Project, keepOnHome?: boolean) => void;
  onSelectProject?: (project: Project) => void;
  onSaveAIScan?: (scan: AIScanGroup) => void;
}

interface EquipmentComparisonEntry {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  rationale: string;
}

interface ManpowerComparisonEntry {
  role: string;
  technicianHours: number;
  aiHours: number;
  variance: number;
  rationale: string;
}

interface ConsumablesComparisonEntry {
  name: string;
  technicianQty: number;
  aiQty: number;
  variance: number;
  rationale: string;
}

interface AuditDetails {
  totalTechnicianCost: number;
  totalAiRecommendedCost: number;
  varianceAmount: number;
  variancePercent: number;
  equipmentComparison: EquipmentComparisonEntry[];
  manpowerComparison: ManpowerComparisonEntry[];
  consumablesComparison?: ConsumablesComparisonEntry[];
  overallAuditRationale: string;
}

interface AiResult {
  documentType: string;
  summary: string;
  isTor: boolean;
  isEstimateAudit?: boolean;
  auditDetails?: AuditDetails | null;
  confidenceScore?: number;
  estimation: {
    projectName: string;
    clientName: string;
    systemTypes: string[];
    buildingType: string;
    floors: number;
    surveyScope: string;
    confidenceScore?: number;
    equipments: {
      name: string;
      category: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      srp?: number;
      totalPrice?: number;
    }[];
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
      unit: string;
      unitPrice: number;
      srp?: number;
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
  } | null;
}

import type { FileRole } from '../../App';

interface FileEntry {
  parsed: ParsedFile;
  summary: string | null;
  aiResult: AiResult | null;
  loading: boolean;
  error: string | null;
  role: FileRole;
}

function extractJson(raw: string): Record<string, any> {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not extract JSON from response.');

  return JSON.parse(jsonMatch[0]);
}

function mapCategoryToOption(cat: string): string {
  const c = (cat || '').toUpperCase();
  if (c.includes('CABLE') || c.includes('WIRE') || c.includes('UTP') || c.includes('RG59') || c.includes('RG6')) {
    return 'Wires & Cables';
  }
  if (c.includes('CONSUMABLE') || c.includes('TAPE') || c.includes('CONNECTOR') || c.includes('RJ45') || c.includes('MOUNT') || c.includes('BRACKET')) {
    return 'Mounting Hardware';
  }
  if (c.includes('TOOL')) {
    return 'Tools';
  }
  if (c.includes('SAFETY') || c.includes('GLOVE') || c.includes('HELMET')) {
    return 'Safety Equipment';
  }
  if (c.includes('LABEL') || c.includes('TAG')) {
    return 'Labels & Brackets';
  }
  if (c.includes('PIPE') || c.includes('CONDUIT') || c.includes('PVC') || c.includes('FLEXIBLE') || c.includes('MOULDING')) {
    return 'Protective Coverings';
  }
  if (c.includes('HARDWARE') || c.includes('CAMERA') || c.includes('NVR') || c.includes('DVR') || c.includes('SWITCH') || c.includes('READER') || c.includes('DETECTOR') || c.includes('LOCK')) {
    return 'Hardware';
  }
  return 'Other';
}

function getBrandFromProduct(p: any): string {
  if (p.brand && p.brand !== 'N/A' && p.brand !== '-') {
    return p.brand;
  }
  const sheet = (p.sheetName || '').toUpperCase();
  if (sheet.includes('HIKVISION')) return 'Hikvision';
  if (sheet.includes('DAHUA')) return 'Dahua';
  if (sheet.includes('EZVIZ')) return 'Ezviz';
  if (sheet.includes('ZKTECO') || sheet.includes('ZK_') || sheet.startsWith('ZK')) return 'ZkTeco';
  if (sheet.includes('HONEYWELL')) return 'Honeywell';
  if (sheet.includes('PARADOX')) return 'Paradox';
  if (sheet.includes('ASENWARE')) return 'Asenware';
  if (sheet.includes('HOCHIKI')) return 'Hochiki';
  if (sheet.includes('NOTIFIER')) return 'Notifier';
  if (sheet.includes('SIMPLEX')) return 'Simplex';
  if (sheet.includes('GST')) return 'GST';
  if (sheet.includes('AIPHONE')) return 'Aiphone';
  if (sheet.includes('FARFISA')) return 'Farfisa';
  if (sheet.includes('TOA')) return 'TOA';
  if (sheet.includes('AVTECH')) return 'Avtech';
  if (sheet.includes('GARRETT')) return 'Garrett';
  if (sheet.includes('UNIQSCAN')) return 'Uniqscan';
  if (sheet.includes('DAOSAFE')) return 'Daosafe';
  if (sheet.includes('EDWARDS')) return 'Edwards';
  if (sheet.includes('GAMEWELL')) return 'Gamewell';
  if (sheet.includes('HORING-LIH')) return 'Horing-Lih';
  if (sheet.includes('TYY')) return 'TYY';
  return '';
}

function detectBrandFromName(name: string): string {
  const upper = (name || '').toUpperCase();
  if (upper.startsWith('DS-')) return 'Hikvision';
  if (upper.startsWith('DH-')) return 'Dahua';
  if (upper.startsWith('CP-')) return 'CP Plus';
  
  const brands = [
    'HIKVISION', 'DAHUA', 'EZVIZ', 'ZKTECO', 'HONEYWELL', 'PARADOX', 
    'ASENWARE', 'HOCHIKI', 'NOTIFIER', 'SIMPLEX', 'GST', 'AIPHONE', 
    'FARFISA', 'TOA', 'AVTECH', 'GARRETT', 'UNIQSCAN', 'DAOSAFE', 
    'EDWARDS', 'GAMEWELL', 'HORING-LIH', 'TYY', 'MAKITA', 'COMMSCOPE', 
    'PANDUIT', 'ALANTEK', 'SYSTIMAX', 'LINKBASIC'
  ];
  
  for (const b of brands) {
    if (upper.includes(b)) {
      if (b === 'ZKTECO') return 'ZkTeco';
      return b.charAt(0) + b.slice(1).toLowerCase();
    }
  }
  return '';
}

function getRoleDefaultDayRate(_role: string): number {
  return 0;
}

function estimateUnitPrice(name: string, category?: string): number {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Cameras & CCTV
  if (n.includes('ptz') || n.includes('speed dome')) return 18500;
  if (n.includes('nvr') || n.includes('dvr') || n.includes('recorder')) return 12500;
  if (n.includes('camera') || n.includes('dome') || n.includes('bullet')) return 4500;
  if (n.includes('hdd') || n.includes('hard disk') || n.includes('surveillance drive')) return 6500;
  if (n.includes('poe switch') || n.includes('network switch') || n.includes('switch')) return 8500;
  if (n.includes('ups') || n.includes('uninterruptible power')) return 5500;

  // Access Control & Fire Alarm
  if (n.includes('facp') || n.includes('fire alarm control panel')) return 25000;
  if (n.includes('controller') || n.includes('access control panel')) return 14500;
  if (n.includes('lock') || n.includes('mag-lock') || n.includes('electromagnetic')) return 3800;
  if (n.includes('reader') || n.includes('biometric') || n.includes('card reader')) return 4200;
  if (n.includes('smoke detector') || n.includes('heat detector') || n.includes('detector')) return 1800;
  if (n.includes('manual call point') || n.includes('pull station') || n.includes('break glass')) return 1500;
  if (n.includes('siren') || n.includes('strobe') || n.includes('sounder') || n.includes('alarm bell')) return 2200;
  if (n.includes('exit button') || n.includes('rex')) return 950;
  if (n.includes('power supply')) return 2800;
  if (n.includes('battery')) return 1800;

  // Wires, Cables & Piping
  if (n.includes('utp') || n.includes('cat6') || n.includes('cat5') || n.includes('cable') || n.includes('wire') || c.includes('cable') || c.includes('wire')) {
    if (n.includes('box') || n.includes('roll')) return 6500;
    return 45;
  }
  if (n.includes('pipe') || n.includes('conduit') || n.includes('tray')) return 350;

  // Connectors & Accessories
  if (n.includes('rj45') || n.includes('connector')) return 25;
  if (n.includes('bracket') || n.includes('mount')) return 850;

  // Category defaults
  if (c.includes('hardware') || c.includes('equipment') || c.includes('device')) return 3500;
  if (c.includes('wire') || c.includes('cable')) return 45;
  if (c.includes('accessory') || c.includes('mounting')) return 450;

  return 2500;
}

export default function AISidebar({ onCreateProject, onSaveAIScan }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scanGroupName, setScanGroupName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect file role based on filename
  const detectFileRole = useCallback((fileName: string): FileRole => {
    const lower = fileName.toLowerCase();
    if (lower.includes('tor') || lower.includes('terms of reference') || lower.includes('specification')) {
      return 'tor';
    }
    if (lower.includes('proposal') || lower.includes('quote') || lower.includes('estimation') || lower.includes('budget')) {
      return 'technician_proposal';
    }
    if (lower.includes('floor') || lower.includes('plan') || lower.includes('layout') || lower.includes('drawing')) {
      return 'floor_plan';
    }
    return 'other';
  }, []);

  const handleFiles = useCallback(async (incoming: FileList | File[]) => {
    const fileArray = Array.from(incoming);
    const newEntries: FileEntry[] = fileArray.map(f => ({
      parsed: { fileName: f.name, fileType: '', content: '', size: f.size },
      summary: null,
      aiResult: null,
      loading: true,
      error: null,
      role: detectFileRole(f.name),
    }));
    setFiles(prev => [...prev, ...newEntries]);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const idx = files.length + i;
      const parsed = await parseFile(file);
      setFiles(prev => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = { ...next[idx], parsed, loading: false };
        }
        return next;
      });
    }
  }, [files.length, detectFileRole]);

  const removeFile = useCallback((idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setSelectedIndex(prev => prev === idx ? null : prev);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setSelectedIndex(null);
    setIsSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!onSaveAIScan || !scanGroupName.trim()) return;

    const scanFiles = files
      .filter(f => f.aiResult)
      .map(f => ({
        fileName: f.parsed.fileName,
        fileType: f.parsed.fileType || f.parsed.fileName.split('.').pop() || '',
        fileSizeLabel: `${(f.parsed.content.length / 1024).toFixed(1)} KB extracted`,
        parsedContent: f.parsed.content.slice(0, 10000),
        aiResult: f.aiResult,
        role: f.role || 'other',
      }));

    if (scanFiles.length === 0) return;

    const group: AIScanGroup = {
      id: `scan-${Date.now()}`,
      name: scanGroupName.trim(),
      createdAt: new Date().toISOString(),
      files: scanFiles,
    };

    onSaveAIScan(group);
    setIsSaved(true);
    setShowSaveModal(false);
  }, [files, scanGroupName, onSaveAIScan]);

  const analyzeWithAI = useCallback(async () => {
    const validIndices = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => !f.parsed.error && f.parsed.content.length > 0);
    if (validIndices.length === 0) return;

    setAnalyzing(true);

    const isTorFile = (fileName: string) => {
      const lower = fileName.toLowerCase();
      return lower.includes('tor') || lower.includes('terms of reference') || lower.includes('specification') || lower.endsWith('.pdf');
    };

    // Find if a TOR file exists in the uploaded set
    const torEntry = validIndices.find(({ f }) => isTorFile(f.parsed.fileName));
    const torContent = torEntry ? torEntry.f.parsed.content : null;

    const buildTorPrompt = (fileContent: string) => `You are a strict, senior security and fire systems engineer in the Philippines.
Extract all requirements from the customer Terms of Reference (TOR) specification document.

Rate your confidence in this extraction as a number 0–100 based on how clear and detailed the document is. 90–100 = very detailed specifications with clear quantities, 70–89 = good detail with some assumptions, 50–69 = vague or partial document, below 50 = very limited or ambiguous content.

Return a JSON object in the following format (ensure it is valid JSON, no markdown outside of the JSON, no explanations):
{
  "documentType": "TOR Extract",
  "summary": "Plain text summary of the key requirements of the TOR document. Use plain bullet points (•) where appropriate.",
  "isTor": true,
  "isEstimateAudit": false,
  "auditDetails": null,
  "confidenceScore": 85,
  "estimation": {
    "projectName": "A suitable project name based on the document",
    "clientName": "The client/company name from the document, if found. Otherwise, make a reasonable guess or leave as 'General Client'",
    "systemTypes": ["CCTV"],
    "buildingType": "Office Building",
    "floors": 1,
    "surveyScope": "Brief description of installation scope extracted",
    "confidenceScore": 85,
    "equipments": [
      {
        "name": "Detailed brand, model, and name of equipment",
        "category": "Hardware",
        "quantity": 1,
        "unit": "pcs",
        "srp": 4500,
        "contractorPrice": 3850,
        "dealerPrice": 3300
      }
    ],
    "manpower": [
      {
        "role": "Role",
        "headcount": 1,
        "hours": 8,
        "manDays": 1
      }
    ],
    "consumables": [
      {
        "name": "Consumable name",
        "category": "Wires & Cables",
        "quantity": 100,
        "unit": "meters",
        "srp": 45,
        "contractorPrice": 38,
        "dealerPrice": 34
      }
    ],
    "fees": [
      {
        "type": "Travel Fee",
        "amount": 5000,
        "description": "Mobilization to site"
      }
    ],
    "constraints": {
      "physical": "Physical installation constraints",
      "electrical": "Electrical power constraints",
      "installation": "Installation access constraints"
    }
  }
}

Document content:
${fileContent}`;

    const buildComparisonPrompt = (fileContent: string, torTxt: string | null) => {
      const torSection = torTxt
        ? `\n[TOR DOCUMENT CONTENT (REFERENCE FOR COMPARISON)]:\n${torTxt.slice(0, 40000)}`
        : `\n[NO TOR DOCUMENT UPLOADED. USE STANDARD AUDIT RULES.]`;

      return `You are a highly critical, strict senior security and fire systems audit engineer in the Philippines.
Your job is to audit technician proposals and verify their compliance with standard engineering practices, the Philippine Electrical Code (PEC), and customer specifications/Terms of Reference (TOR).

We have uploaded a technician's proposed estimate (materials list, headcount, hours).
We have also uploaded a Terms of Reference (TOR) specification if available.

${torTxt ? `
[CRITICAL TOR COMPLIANCE COMPARE RULE]
A customer Terms of Reference (TOR) is present. You MUST compare the Technician's proposed estimate against the TOR specifications:
1. Perform a TOR vs. Proposal Comparison Audit (set isEstimateAudit to true).
2. The "AI Recommended" column (aiQty, aiHours, etc.) MUST represent the exact requirements, counts, brands, and models specified in the TOR.
3. Compare the Technician's proposed items against the TOR requirements.
4. Highlight discrepancies in the "variance" and explain the variance in the "rationale" (e.g., "TOR requires 16 cameras but technician proposed 12", "TOR requires brand X but technician proposed brand Y").
5. If the technician omitted items required by the TOR, add them to the recommended list with a technician quantity of 0.
6. The overallAuditRationale must summarize the technician's compliance score with the TOR.
` : `
[SINGLE-ESTIMATE AUDIT RULE (NO TOR PROVIDED)]
Since ONLY the Technician's proposed estimate is present (without a TOR):
1. Act as a senior audit engineer to create your own recommended estimate (set isEstimateAudit to true).
2. Identify omissions (missing cables, missing connectors, missing network switches, or missing mounts needed to support their hardware list).
3. Apply these STRICT rules to catch errors:
   - [CABLING LENGTH CHECK] A camera or network run requires an average of 45-60 meters of UTP/fiber cable per device. If the technician's total cabling length is lower than (number of devices * 45 meters), you MUST flag this as under-budgeted, correct it in the AI Recommended count, and specify the omission in the audit explanation.
   - [CONNECTOR & MOUNT CHECK] Every IP camera requires 2 RJ45 connectors (plus a 10% safety buffer) and 1 mounting bracket. Check if the technician omitted connectors, brackets, rawlplugs, or electrical tapes, and add them.
   - [POE BUDGET CHECK] For every 8 IP cameras, there must be at least one PoE switch with a sufficient port budget (e.g., a 16-port PoE switch for 12 cameras). Ensure the technician proposed enough switches.
   - [LABOR RATIO CHECK] Installing security hardware is labor-intensive. Installing a camera/device takes at least 2.5 man-hours of labor (cabling, mounting, termination, testing). A doors access installation takes 6 man-hours per door. If the technician's total labor hours are under-estimated, you MUST scale them up to a realistic headcount and hour duration.
   - [MANDATORY MOBILIZATION] Any field installation outside of Manila requires mobilization/travel logistics fees. If missing, add it to fees.
`}

Populate the "auditDetails" node with:
- "totalTechnicianCost": sum of original technician's equipment & labor costs.
- "totalAiRecommendedCost": sum of AI recommended equipment & labor costs after audit.
- "varianceAmount": totalAiRecommendedCost - totalTechnicianCost.
- "variancePercent": (varianceAmount / totalTechnicianCost) * 100.
- "equipmentComparison": matching original hardware vs recommended hardware quantities, with a strict audit rationale.
- "manpowerComparison": matching original labor vs recommended labor, with a strict audit rationale.
- "consumablesComparison": matching original cabling/consumables vs recommended consumables, with a strict audit rationale.
- "overallAuditRationale": detailed business explanation of omissions, under-budgeting, or over-budgeting for the boss/manager.

Rate your confidence in this audit as a number 0–100 based on how complete the information is and how certain you are about the comparison. 90–100 = very clear and complete data, 70–89 = good data with minor assumptions, 50–69 = partial data with several assumptions, below 50 = limited or ambiguous information.

Return a JSON object in the following format (ensure it is valid JSON, no markdown outside of the JSON, no explanations):
{
  "documentType": "Technician Estimate Audit",
  "summary": "Plain text summary containing: 1. General description, 2. Key requirements/scope. Use plain bullet points (•) where appropriate.",
  "isTor": false,
  "isEstimateAudit": true,
  "confidenceScore": 85,
  "auditDetails": {
    "totalTechnicianCost": 120000,
    "totalAiRecommendedCost": 155000,
    "varianceAmount": 35000,
    "variancePercent": 29.1,
    "equipmentComparison": [
      {
        "name": "5MP Dome Camera",
        "technicianQty": 12,
        "aiQty": 16,
        "variance": 4,
        "rationale": "Corrected layout to cover entrance lobbies which were omitted by technician."
      }
    ],
    "manpowerComparison": [
      {
        "role": "Senior System Installer",
        "technicianHours": 8,
        "aiHours": 24,
        "variance": 16,
        "rationale": "Installing 16 cameras requires at least 24 hours of labor (3 days)."
      }
    ],
    "consumablesComparison": [
      {
        "name": "Cat6 UTP Cable",
        "technicianQty": 150,
        "aiQty": 800,
        "variance": 650,
        "rationale": "Technician proposed 150m, but 16 cameras require at least 800m of total cabling."
      }
    ],
    "overallAuditRationale": "Technician's proposal is under-budgeted. Critical items like RJ45 connectors and adequate Cat6 cabling were omitted. Labor was also heavily under-estimated."
  },
  "estimation": {
    "projectName": "A suitable project name based on the document (e.g., 'Elevator CCTV Replacement GF')",
    "clientName": "The client/company name from the document, if found. Otherwise, make a reasonable guess or leave as 'General Client'",
    "systemTypes": ["CCTV"],
    "buildingType": "Office Building",
    "floors": 1,
    "surveyScope": "Brief description of installation scope extracted from the document",
    "confidenceScore": 85,
    "equipments": [
      {
        "name": "Detailed brand, model, and name of equipment",
        "category": "Hardware",
        "quantity": 1,
        "unit": "pcs",
        "unitPrice": 4500,
        "srp": 4500
      }
    ],
    "manpower": [
      {
        "role": "Role",
        "headcount": 1,
        "hours": 8,
        "manDays": 1,
        "ratePerDay": 1000,
        "totalCost": 1000
      }
    ],
    "consumables": [
      {
        "name": "Consumable name",
        "category": "Wires & Cables",
        "quantity": 100,
        "unit": "meters",
        "unitPrice": 45,
        "srp": 45
      }
    ],
    "fees": [
      {
        "type": "Travel Fee",
        "amount": 5000,
        "description": "Mobilization to site"
      }
    ],
    "constraints": {
      "physical": "Physical installation constraints",
      "electrical": "Electrical power constraints",
      "installation": "Installation access constraints"
    }
  }
}

Document content:
${fileContent}

${torSection}`;
    };

    const analyzeOne = async (fileContent: string, fileName: string): Promise<any> => {
      const isTor = isTorFile(fileName);
      const prompt = isTor ? buildTorPrompt(fileContent) : buildComparisonPrompt(fileContent, torContent);

      const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
      if (!apiKey) throw new Error('VITE_MISTRAL_API_KEY is not set. Add it to your .env file.');

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        let errMsg = `Mistral API error (${response.status})`;
        try {
          const e = await response.json();
          errMsg = e?.message || e?.error?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      const rawText: string = data?.choices?.[0]?.message?.content || '';
      try {
        const parsed = extractJson(rawText);
        if (parsed && parsed.estimation) {
          const est = parsed.estimation;
          if (est.equipments) {
            est.equipments = est.equipments.map((eq: any) => {
              const unitPrice = eq.unitPrice || eq.srp || estimateUnitPrice(eq.name, eq.category);
              const totalPrice = eq.totalPrice || unitPrice * (eq.quantity || 1);
              return { ...eq, unitPrice, srp: unitPrice, totalPrice };
            });
          }
          if (est.manpower) {
            est.manpower = est.manpower.map((mp: any) => {
              const ratePerDay = mp.ratePerDay || mp.dayRate || getRoleDefaultDayRate(mp.role);
              const days = mp.manDays || Math.ceil((mp.headcount || 1) * (mp.hours || 8) / 8);
              const totalCost = mp.totalCost || ratePerDay * days;
              return { ...mp, ratePerDay, manDays: days, totalCost };
            });
          }
          if (est.consumables) {
            est.consumables = est.consumables.map((con: any) => {
              const unitPrice = con.unitPrice || con.srp || estimateUnitPrice(con.name, con.category);
              const totalPrice = con.totalPrice || unitPrice * (con.quantity || 1);
              return { ...con, unitPrice, srp: unitPrice, totalPrice };
            });
          }
        }
        return parsed;
      } catch {
        return { documentType: 'Document', summary: rawText, isTor: isTor, estimation: null };
      }
    };

    try {
      const results = await Promise.all(
        validIndices.map(({ f }) =>
          analyzeOne(f.parsed.content.slice(0, 50000), f.parsed.fileName)
        )
      );

      setFiles(prev => {
        const next = [...prev];
        validIndices.forEach(({ i }, resultIdx) => {
          const aiParsed = results[resultIdx];
          next[i] = { ...next[i], summary: aiParsed?.summary || '', aiResult: aiParsed, error: null };
        });
        return next;
      });
    } catch (err: any) {
      setFiles(prev => prev.map(f => ({ ...f, error: err.message || 'Analysis failed' })));
    } finally {
      setAnalyzing(false);
    }
  }, [files]);



  const handleCreateProject = useCallback((entry: FileEntry) => {
    if (!onCreateProject || !entry.aiResult || !entry.aiResult.estimation) return;
    const est = entry.aiResult.estimation;
    const projectId = `project-tor-${Date.now()}`;
    
    // Construct new project
    const newProject: Project = {
      id: projectId,
      name: est.projectName || entry.parsed.fileName.replace(/\.[^/.]+$/, ""),
      clientName: est.clientName || 'General Client',
      clientContactName: 'Client Representative',
      clientEmail: 'client@company.com',
      clientPhone: '09170000000',
      location: 'Metro Manila, Philippines',
      locationName: 'Metro Manila, Philippines',
      latitude: 14.5995,
      longitude: 120.9842,
      buildingType: est.buildingType || 'Office Building',
      floors: est.floors || 1,
      systemTypes: est.systemTypes || ['CCTV'],
      surveyScope: est.surveyScope || 'Auto-created from TOR analysis.',
      status: 'In Progress',
      assignedTechnicians: DEFAULT_TECHNICIANS,
      createdAt: new Date().toISOString(),
    };

    // Map materials & accessories with AI-estimated pricing
    const matchedConsumables = [
      ...(est.equipments || []),
      ...(est.consumables || [])
    ].map((c: any) => {
      const srp = c.srp || c.unitPrice || 0;
      const contractorPrice = c.contractorPrice || Math.round(srp * 0.85);
      const dealerPrice = c.dealerPrice || Math.round(srp * 0.75);
      return {
        id: crypto.randomUUID(),
        name: c.name,
        brand: c.brand || detectBrandFromName(c.name),
        category: mapCategoryToOption(c.category),
        quantity: c.quantity || 1,
        unit: c.unit || 'pcs',
        unitPrice: srp,
        srp,
        contractorPrice,
        dealerPrice,
        totalPrice: srp * (c.quantity || 1),
      };
    });

    // Construct manpower list
    const manpowerList = (est.manpower || []).map((m: any) => {
      const dayRate = getRoleDefaultDayRate(m.role);
      const days = m.manDays || Math.ceil(m.headcount * m.hours / 8);
      return {
        id: crypto.randomUUID(),
        role: m.role,
        headcount: m.headcount,
        hours: m.hours,
        manDays: days,
        dayRate,
        totalCost: dayRate * days,
      };
    });

    // Save estimation details to localStorage
    const estimationData = {
      manpower: manpowerList,
      consumables: matchedConsumables,
      fees: (est.fees || []).map((f: any) => ({
        id: crypto.randomUUID(),
        type: f.type || 'Other',
        amount: f.amount || 0,
        description: f.description || '',
      })),
      constraints: {
        physical: est.constraints?.physical || '',
        electrical: est.constraints?.electrical || '',
        installation: est.constraints?.installation || '',
      },
      priceTier: 'srp',
    };

    localStorage.setItem(`aa2000_estimation_${projectId}`, JSON.stringify(estimationData));

    // Call the parent creation callback
    onCreateProject(newProject);
  }, [onCreateProject]);

  const handleDownloadPdf = useCallback(async (entry: FileEntry) => {
    const audit = entry.aiResult?.auditDetails;
    if (!audit) return;

    const todayStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const buildTableRows = (items: any[], fields: { name: string; technician: string; ai: string; variance: string; rationale: string }) => {
      return items.map((item: any) => `
        <tr>
          <td style="font-weight: 600;">${item[fields.name]}</td>
          <td style="text-align: right;">${item[fields.technician]}</td>
          <td style="text-align: right; font-weight: bold;">${item[fields.ai]}</td>
          <td style="text-align: center;">
            <span style="padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; ${
              item.variance > 0
                ? 'background-color: #FEF2F2; color: #DC2626;'
                : item.variance < 0
                  ? 'background-color: #FFFBEB; color: #D97706;'
                  : 'background-color: #F1F5F9; color: #64748B;'
            }">
              ${item.variance > 0 ? `+${item.variance}` : item.variance < 0 ? `${item.variance}` : 'Match'}
            </span>
          </td>
          <td>${item[fields.rationale]}</td>
        </tr>
      `).join('');
    };

    const equipmentRows = buildTableRows(audit.equipmentComparison, {
      name: 'name', technician: 'technicianQty', ai: 'aiQty', variance: 'variance', rationale: 'rationale'
    });
    const manpowerRows = buildTableRows(audit.manpowerComparison, {
      name: 'role', technician: 'technicianHours', ai: 'aiHours', variance: 'variance', rationale: 'rationale'
    });
    const consumablesRows = buildTableRows(audit.consumablesComparison || [], {
      name: 'name', technician: 'technicianQty', ai: 'aiQty', variance: 'variance', rationale: 'rationale'
    });

    const outer = document.createElement('div');
    outer.style.position = 'fixed';
    outer.style.top = '0';
    outer.style.left = '0';
    outer.style.width = '816px';
    outer.style.height = '1px';
    outer.style.overflow = 'hidden';
    outer.style.zIndex = '99999';
    outer.style.pointerEvents = 'none';

    const container = document.createElement('div');
    container.style.width = '816px';
    container.style.padding = '30px';
    container.style.boxSizing = 'border-box';
    container.style.background = '#FFFFFF';
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    container.style.color = '#1E293B';
    container.style.fontSize = '11px';
    container.style.lineHeight = '1.5';
    container.style.overflow = 'visible';

    container.innerHTML = `
      <div style="border-bottom: 2px solid #E2E8F0; padding-bottom: 15px; margin-bottom: 20px;">
        <p style="font-size: 20px; font-weight: 800; color: #1E3A8A; margin: 0;">AA2000</p>
        <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; margin-top: 2px; margin-bottom: 0;">Security and Technology Solutions Inc.</p>
        <h2 style="font-size: 15px; font-weight: 800; margin-top: 15px; margin-bottom: 5px; color: #0F172A;">AI Estimation & Cost Audit Report</h2>
        <div style="font-size: 10px; color: #64748B; margin-bottom: 20px;">
          <strong>Source File:</strong> ${entry.parsed.fileName}<br>
          <strong>Generated Date:</strong> ${todayStr}
        </div>
      </div>

      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <div style="flex: 1; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; background: #F8FAFC;">
          <div style="font-size: 8px; text-transform: uppercase; font-weight: 700; color: #64748B;">Technician Proposed</div>
          <div style="font-size: 16px; font-weight: 800; margin-top: 3px; color: #0F172A;">₱${audit.totalTechnicianCost.toLocaleString()}</div>
        </div>
        <div style="flex: 1; padding: 12px; border: 1px solid #BFDBFE; border-radius: 8px; background: #EFF6FF;">
          <div style="font-size: 8px; text-transform: uppercase; font-weight: 700; color: #2563EB;">AI Recommended</div>
          <div style="font-size: 16px; font-weight: 800; margin-top: 3px; color: #1E40AF;">₱${audit.totalAiRecommendedCost.toLocaleString()}</div>
        </div>
        <div style="flex: 1; padding: 12px; border: 1px solid ${audit.varianceAmount > 0 ? '#FED7AA' : '#A7F3D0'}; border-radius: 8px; background: ${audit.varianceAmount > 0 ? '#FFF7ED' : '#ECFDF5'}; color: ${audit.varianceAmount > 0 ? '#C2410C' : '#047857'};">
          <div style="font-size: 8px; text-transform: uppercase; font-weight: 700; color: inherit;">Variance</div>
          <div style="font-size: 16px; font-weight: 800; margin-top: 3px; color: inherit;">${audit.varianceAmount > 0 ? '+' : ''}₱${audit.varianceAmount.toLocaleString()}</div>
          <div style="font-size: 9px; font-weight: bold; margin-top: 2px;">${audit.variancePercent.toFixed(1)}% ${audit.varianceAmount > 0 ? 'Under-budgeted' : 'Over-budgeted'}</div>
        </div>
      </div>

      <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #475569; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">AI Audit Findings & Executive Summary</div>
      <div style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; background: #F8FAFC; font-size: 11px; line-height: 1.5; margin-bottom: 20px;">
        ${audit.overallAuditRationale.replace(/\n/g, '<br>')}
      </div>

      <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #475569; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">Equipment & Materials Audit</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 25px;">
        <thead>
          <tr>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 25%;">Item Name</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Technician proposed</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">AI recommended</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: center; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Variance</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 30%;">Audit Explanation</th>
          </tr>
        </thead>
        <tbody>${equipmentRows}</tbody>
      </table>

      <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #475569; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">Labor & Manpower Audit</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 25px;">
        <thead>
          <tr>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 25%;">Labor Role</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Technician Hours</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">AI recommended</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: center; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Variance</th>
            <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 30%;">Audit Explanation</th>
          </tr>
        </thead>
        <tbody>${manpowerRows}</tbody>
      </table>

      ${audit.consumablesComparison && audit.consumablesComparison.length > 0 ? `
        <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #475569; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">Cabling & Consumables Audit</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 25px;">
          <thead>
            <tr>
              <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 25%;">Material Name</th>
              <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Technician proposed</th>
              <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: right; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">AI recommended</th>
              <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: center; border-bottom: 2px solid #CBD5E1; color: #334155; width: 15%;">Variance</th>
              <th style="background: #F1F5F9; padding: 6px 8px; font-weight: 700; text-align: left; border-bottom: 2px solid #CBD5E1; color: #334155; width: 30%;">Audit Explanation</th>
            </tr>
          </thead>
          <tbody>${consumablesRows}</tbody>
        </table>
      ` : ''}
    `;

    outer.appendChild(container);
    document.body.appendChild(outer);

    try {
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PDF library'));
          document.head.appendChild(script);
        });
      }

      const opt = {
        margin: 0,
        filename: `AA2000_Audit_${entry.parsed.fileName.replace(/\.[^.]+$/, '').replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await (window as any).html2pdf().set(opt).from(container).save();
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error('An error occurred while generating the PDF. Please try again.');
    } finally {
      document.body.removeChild(outer);
    }
  }, []);

  const hasValidContent = files.some(f => !f.parsed.error && f.parsed.content.length > 0);
  const selected = selectedIndex !== null ? files[selectedIndex] : null;

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in">
      <div className="flex items-center justify-between px-6 h-16 shrink-0 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <span className="text-base font-black text-slate-900">AI Document Reader</span>
        </div>
        {files.length > 0 && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        <div className={files.some(f => f.summary) ? "max-w-6xl mx-auto px-4" : "max-w-4xl mx-auto"}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onPaste={e => { e.preventDefault(); }}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-blue-400 bg-blue-50/50'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.docx,.txt,.csv,.json,.xml,.md,.html,.htm"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-base font-bold text-slate-800">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-slate-500 mt-1">
              PDF, XLSX, DOCX, TXT, CSV, JSON & more
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Uploaded Files ({files.length})
                </span>
              </div>
              {files.map((entry, idx) => {
                const ext = entry.parsed.fileType.toUpperCase();
                const fileOk = !entry.parsed.error;
                return (
                  <div
                    key={idx}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                      selectedIndex === idx
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      fileOk ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-500'
                    }`}>
                      {ext || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {entry.parsed.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.loading ? 'Parsing...' : fileOk ? `${(entry.parsed.content.length / 1024).toFixed(1)} KB extracted` : entry.parsed.error}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(idx); }}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {hasValidContent && !analyzing && files.every(f => !f.loading) && (
                <button
                  onClick={analyzeWithAI}
                  className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white transition-all btn-press animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
                  }}
                >
                  <svg className="w-4 h-4 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  Analyze with AI
                </button>
              )}

              {analyzing && (
                <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-slate-700">AI is analyzing documents...</span>
                </div>
              )}
            </div>
          )}

          {files.some(f => f.summary || f.error) && (
            <div className="mt-8">
              {/* Save Folder Action Banner */}
              {onSaveAIScan && !isSaved && files.some(f => f.aiResult) && (
                <div
                  className="mb-6 p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-in"
                  style={{
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.04), rgba(29,78,216,0.04))',
                    borderColor: 'rgba(37,99,235,0.15)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-base">
                      💾
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Save Scan to Projects</p>
                      <p className="text-[10px] font-semibold text-slate-500">Store this scan session &amp; all file reports in a renameable folder.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const firstFile = files.find(f => f.aiResult)?.parsed.fileName || 'Document';
                      const cleanName = firstFile.replace(/\.[^/.]+$/, '').replace(/Structured Cabling.*/i, '').trim();
                      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      setScanGroupName(`${cleanName || 'Estimate'} Scan — ${dateStr}`);
                      setShowSaveModal(true);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all btn-press"
                  >
                    Save as Folder
                  </button>
                </div>
              )}

              {isSaved && (
                <div
                  className="mb-6 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-scale-in"
                  style={{ background: 'rgba(16,185,129,0.05)' }}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">✓</div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Saved to Projects</p>
                    <p className="text-[10px] font-semibold text-slate-500">You can view and rename this scan folder anytime from the dashboard.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-3.75 9.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm.75 3a.75.75 0 0 1 0-1.5h6a.75.75 0 0 1 0 1.5H9Z" />
                </svg>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  AI Analysis Results
                </span>
              </div>
              <div className="space-y-8">
                {files.map((entry, idx) => {
                  if (!entry.summary && !entry.error) return null;
                const est = entry.aiResult?.estimation;
                const isTor = !!(entry.aiResult?.isTor && est);
                const audit = entry.aiResult?.auditDetails;
                const confidenceScore = entry.aiResult?.confidenceScore ?? entry.aiResult?.estimation?.confidenceScore;
                
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 overflow-hidden animate-fade-in-up shadow-sm bg-white"
                  >
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-sm font-black text-slate-800">{entry.parsed.fileName}</span>
                        <span className="ml-3 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                          {entry.aiResult?.documentType || 'Document'}
                        </span>
                        {confidenceScore !== undefined && confidenceScore !== null && (
                          <span
                            className="ml-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border"
                            style={{
                              borderColor: confidenceScore >= 76 ? '#BBF7D0' : confidenceScore >= 51 ? '#FEF08A' : confidenceScore >= 26 ? '#FED7AA' : '#FECACA',
                              background: confidenceScore >= 76 ? '#F0FDF4' : confidenceScore >= 51 ? '#FEFCE8' : confidenceScore >= 26 ? '#FFF7ED' : '#FEF2F2',
                            }}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: confidenceScore >= 76 ? '#16A34A' : confidenceScore >= 51 ? '#A16207' : confidenceScore >= 26 ? '#EA580C' : '#DC2626' }}>
                              {confidenceScore >= 76 ? 'High' : confidenceScore >= 51 ? 'Medium' : confidenceScore >= 26 ? 'Low' : 'Poor'}
                            </span>
                            <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${confidenceScore}%`,
                                  background: confidenceScore >= 76 ? '#16A34A' : confidenceScore >= 51 ? '#CA8A04' : confidenceScore >= 26 ? '#EA580C' : '#DC2626',
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-black"
                              style={{ color: confidenceScore >= 76 ? '#16A34A' : confidenceScore >= 51 ? '#CA8A04' : confidenceScore >= 26 ? '#EA580C' : '#DC2626' }}
                            >
                              {confidenceScore}%
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.aiResult?.isEstimateAudit && audit && (
                          <button
                            onClick={() => handleDownloadPdf(entry)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-sm transition-all hover:bg-slate-50 flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download PDF
                          </button>
                        )}
                        {isTor && est && onCreateProject && (
                          <button
                            onClick={() => handleCreateProject(entry)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:opacity-95"
                            style={{
                              background: 'linear-gradient(135deg, #10B981, #059669)',
                              boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
                            }}
                          >
                            Create Project & Estimation
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-6">
                      {entry.error ? (
                        <p className="text-sm text-red-600 font-medium">{entry.error}</p>
                      ) : (entry.aiResult?.isEstimateAudit && audit) ? (
                        <div className="space-y-8 animate-fade-in">
                          {/* Cost Comparison Hero Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Technician Proposed Cost</span>
                              <p className="text-2xl font-black text-slate-800 mt-1">₱{audit.totalTechnicianCost.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 mt-1">Original estimate proposal</p>
                            </div>
                            <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50/20">
                              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">AI Recommended Cost</span>
                              <p className="text-2xl font-black text-blue-800 mt-1">₱{audit.totalAiRecommendedCost.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 mt-1">Corrected & audited estimate</p>
                            </div>
                            <div className={`p-5 rounded-2xl border ${
                              audit.varianceAmount > 0 
                                ? 'border-amber-100 bg-amber-50/20 text-amber-800' 
                                : audit.varianceAmount < 0 
                                  ? 'border-emerald-100 bg-emerald-50/20 text-emerald-800' 
                                  : 'border-slate-100 bg-slate-50 text-slate-600'
                            }`}>
                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Estimate Variance</span>
                              <p className="text-2xl font-black mt-1">
                                {audit.varianceAmount > 0 ? '+' : ''}₱{audit.varianceAmount.toLocaleString()}
                              </p>
                              <p className="text-[10px] font-bold mt-1 opacity-80">
                                {audit.varianceAmount > 0 
                                  ? `${audit.variancePercent.toFixed(1)}% Under-budgeted (Omissions found)` 
                                  : audit.varianceAmount < 0 
                                    ? `${Math.abs(audit.variancePercent).toFixed(1)}% Over-budgeted` 
                                    : 'Estimate matches requirements'}
                              </p>
                            </div>
                          </div>

                          {/* Executive Summary Report */}
                          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">AI Estimate Audit Findings</h4>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                              {audit.overallAuditRationale}
                            </p>
                          </div>

                          {/* Equipment Comparison Table */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment & Materials Audit</h4>
                            <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                    <th className="p-3">Item / Device Name</th>
                                    <th className="p-3 w-32 text-right">Technician proposed</th>
                                    <th className="p-3 w-32 text-right">AI recommended</th>
                                    <th className="p-3 w-28 text-center">Qty Variance</th>
                                    <th className="p-3">Audit Explanation / Rationale</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {audit.equipmentComparison.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-semibold text-slate-700">{item.name}</td>
                                      <td className="p-3 text-right text-slate-500 font-medium">{item.technicianQty}</td>
                                      <td className="p-3 text-right text-slate-900 font-bold">{item.aiQty}</td>
                                      <td className="p-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                          item.variance > 0 
                                            ? 'bg-red-50 text-red-600 border border-red-100' 
                                            : item.variance < 0 
                                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                              : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {item.variance > 0 ? `+${item.variance} (Omitted)` : item.variance < 0 ? `${item.variance} (Over)` : 'Match'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-slate-600 leading-normal font-medium">{item.rationale}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Manpower / Labor Audit */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Labor & Manpower Audit</h4>
                            <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                    <th className="p-3">Labor Role</th>
                                    <th className="p-3 w-32 text-right">Technician Hours</th>
                                    <th className="p-3 w-32 text-right">AI recommended</th>
                                    <th className="p-3 w-28 text-center">Hours Variance</th>
                                    <th className="p-3">Audit Explanation / Rationale</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {audit.manpowerComparison.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-semibold text-slate-700">{item.role}</td>
                                      <td className="p-3 text-right text-slate-500 font-medium">{item.technicianHours} hrs</td>
                                      <td className="p-3 text-right text-slate-900 font-bold">{item.aiHours} hrs</td>
                                      <td className="p-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                          item.variance > 0 
                                            ? 'bg-red-50 text-red-600 border border-red-100' 
                                            : item.variance < 0 
                                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                              : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {item.variance > 0 ? `+${item.variance} hrs` : item.variance < 0 ? `${item.variance} hrs` : 'Match'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-slate-600 leading-normal font-medium">{item.rationale}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Consumables Comparison Table */}
                          {audit.consumablesComparison && audit.consumablesComparison.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cabling & Consumables Audit</h4>
                              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                      <th className="p-3">Material Name</th>
                                      <th className="p-3 w-32 text-right">Technician proposed</th>
                                      <th className="p-3 w-32 text-right">AI recommended</th>
                                      <th className="p-3 w-28 text-center">Variance</th>
                                      <th className="p-3">Audit Explanation / Rationale</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {audit.consumablesComparison.map((item, i) => (
                                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-3 font-semibold text-slate-700">{item.name}</td>
                                        <td className="p-3 text-right text-slate-500 font-medium">{item.technicianQty}</td>
                                        <td className="p-3 text-right text-slate-900 font-bold">{item.aiQty}</td>
                                        <td className="p-3 text-center">
                                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                            item.variance > 0 
                                              ? 'bg-red-50 text-red-600 border border-red-100' 
                                              : item.variance < 0 
                                                ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                                : 'bg-slate-100 text-slate-500'
                                          }`}>
                                            {item.variance > 0 ? `+${item.variance}` : item.variance < 0 ? `${item.variance}` : 'Match'}
                                          </span>
                                        </td>
                                        <td className="p-3 text-slate-600 leading-normal font-medium">{item.rationale}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (isTor && est) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Left Column: Summary */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Summary</h4>
                            <div className="text-sm text-slate-900 leading-relaxed space-y-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                              {(entry.summary || '').split('\n').map((line, i) => {
                                if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
                                  return (
                                    <li key={i} className="ml-4 text-slate-900 list-disc">
                                      {line.replace(/^[\s]*[•\-*]\s*/, '')}
                                    </li>
                                  );
                                }
                                if (line.trim() === '') return <br key={i} />;
                                return <p key={i} className="text-slate-900 font-medium">{line}</p>;
                              })}
                            </div>

                            {/* Constraints Card */}
                            {est.constraints && (
                              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Site Constraints</h5>
                                {est.constraints.physical && (
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Physical:</span>
                                    <p className="text-xs text-slate-700 mt-0.5">{est.constraints.physical}</p>
                                  </div>
                                )}
                                {est.constraints.electrical && (
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Electrical:</span>
                                    <p className="text-xs text-slate-700 mt-0.5">{est.constraints.electrical}</p>
                                  </div>
                                )}
                                {est.constraints.installation && (
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Installation:</span>
                                    <p className="text-xs text-slate-700 mt-0.5">{est.constraints.installation}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right Column: AI Generated Estimates */}
                          <div className="space-y-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Generated Estimates</h4>
                            
                            {/* Project Metadata Preview */}
                            <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                              <div>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">Project Name</span>
                                <p className="text-xs font-black text-slate-800 truncate mt-0.5">{est.projectName}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">Client</span>
                                <p className="text-xs font-black text-slate-800 truncate mt-0.5">{est.clientName}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">System Types</span>
                                <p className="text-xs font-black text-slate-800 mt-0.5">{est.systemTypes?.join(', ') || 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-blue-500 uppercase">Building</span>
                                <p className="text-xs font-black text-slate-800 mt-0.5">{est.buildingType} ({est.floors || 1}F)</p>
                              </div>
                            </div>

                            {/* Equipments Table */}
                            {est.equipments && est.equipments.length > 0 && (() => {
                              const totalEquipCost = est.equipments.reduce((sum: number, eq: any) => {
                                const unitPrice = eq.unitPrice || eq.srp || estimateUnitPrice(eq.name, eq.category);
                                const totalPrice = eq.totalPrice || unitPrice * (eq.quantity || 1);
                                return sum + totalPrice;
                              }, 0);
                              return (
                                <div className="space-y-2">
                                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Estimated Equipment & Devices</h5>
                                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                          <th className="p-2">Name</th>
                                          <th className="p-2 w-20 text-right">Qty</th>
                                          <th className="p-2 w-28 text-right">Unit Price (₱)</th>
                                          <th className="p-2 w-28 text-right">Total Price (₱)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {est.equipments.map((eq: any, i: number) => {
                                          const unitPrice = eq.unitPrice || eq.srp || estimateUnitPrice(eq.name, eq.category);
                                          const totalPrice = eq.totalPrice || unitPrice * (eq.quantity || 1);
                                          return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                              <td className="p-2 font-semibold text-slate-700">{eq.name}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">{eq.quantity} {eq.unit || 'pcs'}</td>
                                              <td className="p-2 text-right text-slate-600 font-medium">&#8369;{unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">&#8369;{totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-100/70 border-t border-slate-200">
                                          <td colSpan={3} className="p-2 font-bold text-slate-700 text-right">Total Equipment Cost:</td>
                                          <td className="p-2 text-right font-black text-emerald-700">&#8369;{totalEquipCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Manpower / Hours Card */}
                            {est.manpower && est.manpower.length > 0 && (() => {
                              const totalMpCost = est.manpower.reduce((sum: number, mp: any) => {
                                const roleLower = (mp.role || '').toLowerCase();
                                const rate = mp.ratePerDay || mp.dayRate || (roleLower.includes('engineer') ? 1500 : roleLower.includes('safety') ? 1200 : 1000);
                                const days = mp.manDays || Math.ceil((mp.headcount || 1) * (mp.hours || 8) / 8);
                                const cost = mp.totalCost || rate * days;
                                return sum + cost;
                              }, 0);
                              return (
                                <div className="space-y-2">
                                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Manpower & Hours</h5>
                                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                          <th className="p-2">Role</th>
                                          <th className="p-2 w-14 text-center">People</th>
                                          <th className="p-2 w-14 text-right">Hours</th>
                                          <th className="p-2 w-14 text-right">Days</th>
                                          <th className="p-2 w-24 text-right">Day Rate (₱)</th>
                                          <th className="p-2 w-28 text-right">Total Cost (₱)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {est.manpower.map((mp: any, i: number) => {
                                          const rate = mp.ratePerDay || mp.dayRate || 0;
                                          const days = mp.manDays || Math.ceil((mp.headcount || 1) * (mp.hours || 8) / 8);
                                          const cost = mp.totalCost || rate * days;
                                          return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                              <td className="p-2 font-semibold text-slate-700">{mp.role}</td>
                                              <td className="p-2 text-center text-slate-900 font-bold">{mp.headcount}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">{mp.hours} hrs</td>
                                              <td className="p-2 text-right text-blue-700 font-bold">{days}</td>
                                              <td className="p-2 text-right text-slate-600 font-medium">&#8369;{rate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">&#8369;{cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-100/70 border-t border-slate-200">
                                          <td colSpan={5} className="p-2 font-bold text-slate-700 text-right">Total Manpower Cost:</td>
                                          <td className="p-2 text-right font-black text-blue-700">&#8369;{totalMpCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Consumables List */}
                            {est.consumables && est.consumables.length > 0 && (() => {
                              const totalConCost = est.consumables.reduce((sum: number, con: any) => {
                                const unitPrice = con.unitPrice || con.srp || estimateUnitPrice(con.name, con.category);
                                const totalPrice = con.totalPrice || unitPrice * (con.quantity || 1);
                                return sum + totalPrice;
                              }, 0);
                              return (
                                <div className="space-y-2">
                                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Estimated Consumables & Wires</h5>
                                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                                          <th className="p-2">Material</th>
                                          <th className="p-2 w-20 text-right">Quantity</th>
                                          <th className="p-2 w-28 text-right">Unit Price (₱)</th>
                                          <th className="p-2 w-28 text-right">Total Price (₱)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {est.consumables.map((con: any, i: number) => {
                                          const unitPrice = con.unitPrice || con.srp || estimateUnitPrice(con.name, con.category);
                                          const totalPrice = con.totalPrice || unitPrice * (con.quantity || 1);
                                          return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                              <td className="p-2 font-semibold text-slate-700">{con.name}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">{con.quantity} {con.unit || 'pcs'}</td>
                                              <td className="p-2 text-right text-slate-600 font-medium">&#8369;{unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-2 text-right text-slate-900 font-bold">&#8369;{totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-100/70 border-t border-slate-200">
                                          <td colSpan={3} className="p-2 font-bold text-slate-700 text-right">Total Consumables Cost:</td>
                                          <td className="p-2 text-right font-black text-emerald-700">&#8369;{totalConCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Overall Document Estimation Total Card */}
                            {(() => {
                              const eqTotal = (est.equipments || []).reduce((sum: number, eq: any) => sum + (eq.totalPrice || (eq.unitPrice || eq.srp || estimateUnitPrice(eq.name, eq.category)) * (eq.quantity || 1)), 0);
                              const mpTotal = (est.manpower || []).reduce((sum: number, mp: any) => {
                                const roleLower = (mp.role || '').toLowerCase();
                                const rate = mp.ratePerDay || mp.dayRate || (roleLower.includes('engineer') ? 1500 : roleLower.includes('safety') ? 1200 : 1000);
                                const days = mp.manDays || Math.ceil((mp.headcount || 1) * (mp.hours || 8) / 8);
                                return sum + (mp.totalCost || rate * days);
                              }, 0);
                              const conTotal = (est.consumables || []).reduce((sum: number, con: any) => sum + (con.totalPrice || (con.unitPrice || con.srp || estimateUnitPrice(con.name, con.category)) * (con.quantity || 1)), 0);
                              const feeTotal = (est.fees || []).reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
                              const docGrandTotal = eqTotal + mpTotal + conTotal + feeTotal;

                              return (
                                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-4 space-y-2.5 shadow-2xs">
                                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                                    <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">Document Estimation Summary</span>
                                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">Total Calculated</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    {eqTotal > 0 && (
                                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Equipment</span>
                                        <span className="text-xs font-black text-emerald-800">&#8369;{eqTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                    {mpTotal > 0 && (
                                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Manpower</span>
                                        <span className="text-xs font-black text-blue-800">&#8369;{mpTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                    {conTotal > 0 && (
                                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Consumables</span>
                                        <span className="text-xs font-black text-emerald-800">&#8369;{conTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                    {feeTotal > 0 && (
                                      <div className="p-2 rounded-xl bg-white border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Fees</span>
                                        <span className="text-xs font-black text-slate-800">&#8369;{feeTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                                    <span className="text-xs font-extrabold text-slate-800">Total Document Estimation:</span>
                                    <span className="text-base font-black text-emerald-700">&#8369;{docGrandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-900 leading-relaxed space-y-1 whitespace-pre-wrap">
                          {(entry.summary || '').split('\n').map((line, i) => {
                            if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
                              return (
                                <li key={i} className="ml-4 text-slate-900 list-disc">
                                  {line.replace(/^[\s]*[•\-*]\s*/, '')}
                                </li>
                              );
                            }
                            if (line.trim() === '') return <br key={i} />;
                            return <p key={i} className="text-slate-900">{line}</p>;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {selected && !selected.loading && !selected.summary && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Extracted Content Preview
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {selected.parsed.content.slice(0, 5000)}
                  {selected.parsed.content.length > 5000 ? '\n\n... (content truncated)' : ''}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800" style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>
                Save Scan Folder
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={scanGroupName}
                  onChange={e => setScanGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all font-semibold"
                  placeholder="e.g. DLSU Taft Scan"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 btn-press transition-colors hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white btn-press hover:brightness-110 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  }}
                >
                  Save Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

