# AA2000 Estimation AI API Documentation

## Overview

Three AI-powered APIs for AA2000 Estimation Studio. All endpoints require authentication via `Authorization: Bearer <session_token>` and `X-Session-Id: <session_token>`.

**Base URL**: `https://aa2000backend-server.onrender.com`  
**Content-Type**: `application/json` (or `multipart/form-data` for file uploads)  
**Timeout**: 120 seconds for AI endpoints

### Response envelope

Every endpoint uses the standard envelope. Successful responses carry the payload described in each section as the value of `data`:

```json
{ "success": true, "data": { "requestId": "…", "…": "…" } }
```

Errors always carry an empty `data` and a human-readable `error`:

```json
{ "success": false, "data": "", "error": "Attach at least one floor plan file in `file` (or `files`)." }
```

### Supplemental Documents (TOR / Proposal)

All three endpoints accept an optional `supplementalDocuments` array — the
parsed text of the project's TOR / specification or proposal documents — which
is injected into the AI prompt as an authoritative reference block
(`=== SUPPLEMENTAL DOCUMENTS (TOR / PROPOSAL) ===`):

```json
"supplementalDocuments": [
	{ "name": "TOR - HQ CCTV Upgrade.pdf", "content": "…" },
	{ "name": "Proposal v2.docx", "content": "…" }
]
```

API #1 carries it as a multipart **JSON field** (same shape); APIs #2 and #3
carry it as a normal JSON body field. Server-side caps (entries beyond a limit
are dropped silently):

| Limit                      | Value      |
| -------------------------- | ---------- |
| Documents per request      | 4          |
| `name` length              | 120 chars  |
| `content` length           | 6,000 chars each |
| Total `content` per request | 24,000 chars |

Missing, `null`, or malformed entries are ignored — the field is purely
additive context and never changes the response schema.

---

## Authentication

```http
Authorization: Bearer <session_token>
X-Session-Id: <session_token>
```

Obtain `session_token` via `POST /security/pin-authenticate`.

---

## 1. Floor Plan Analysis API

Extracts structured sections from floor plan images/PDFs for downstream AI consumption.

### Endpoint

```
POST /api/floorplan/analyze
```

### Request (multipart/form-data)

| Field             | Type          | Required | Description                                                            |
| ----------------- | ------------- | -------- | ---------------------------------------------------------------------- |
| `file`            | file          | ✅*      | Floor plan file (PDF, PNG, JPG, GIF, WEBP)                             |
| `files[]`         | file[]        |          | Alternate: up to 6 floor plan files in one request (multi-sheet sets, 12 MB each) |
| `fileType`        | string        |          | `pdf`, `png`, `jpg`, `jpeg`, `gif`, `webp` — advisory; bytes are sniffed server-side |
| `projectContext`  | string (JSON) |          | Project context for better detection                                   |
| `analysisOptions` | string (JSON) |          | Analysis configuration                                                 |
| `supplementalDocuments` | string (JSON) |      | TOR / proposal context array — see *Supplemental Documents*            |

\* Either `file` or at least one `files[]` entry is required.

`dwg`/`dxf` are named in older revisions of this spec but cannot be read: sending them returns **422** with guidance to export the drawing to PDF or PNG first.

**projectContext** (optional):

```json
{
	"buildingType": "Office Building",
	"floors": 10,
	"systemTypes": ["CCTV", "FDAS", "ACCESS_CONTROL"],
	"projectId": "proj-2026-001"
}
```

**analysisOptions** (optional):

```json
{
	"extractDimensions": true,
	"extractAnnotations": true,
	"detectSystems": true,
	"classifyRooms": true,
	"outputFormat": "structured",
	"coordinateSystem": "meters",
	"confidenceThreshold": 0.6
}
```

### Response (200 OK)

Envelope: `{ "success": true, "data": <object below> }`

```json
{
  "requestId": "fp-2026-001234",
  "analyzedAt": "2026-01-15T14:22:00Z",
  "processingTimeMs": 8432,
  "fileInfo": {
    "fileName": "floor-3-plan.pdf",
    "pages": 1,
    "pageSize": { "width": 594, "height": 842, "unit": "mm" },
    "scale": { "value": 100, "unit": "mm", "detected": true },
    "orientation": "portrait"
  },
  "confidenceScore": 87,
  "pages": [
    {
      "pageNumber": 1,
      "floorNumber": 3,
      "scale": { "value": 100, "unit": "mm" },
      "dimensions": { "width": 50.0, "height": 30.0, "unit": "meters" },
      "sections": [
        {
          "sectionId": "sec-001",
          "type": "room",
          "subType": "office",
          "label": "Open Office Area",
          "confidence": 0.94,
          "polygon": [{ "x": 2.5, "y": 2.0 }, ...],
          "bbox": { "x": 2.5, "y": 2.0, "width": 19.5, "height": 12.0 },
          "area": 234.0,
          "unit": "sqm",
          "dimensions": { "width": 19.5, "height": 12.0, "unit": "meters" },
          "annotations": ["OPEN OFFICE", "24 WS"],
          "features": { "doors": [...], "windows": [...], "electricalOutlets": 12 },
          "systemsDetected": { "cctv": {...}, "fdas": {...}, "accessControl": {...} }
        }
      ],
      "corridors": [...],
      "verticalCirculation": [...],
      "utilityAreas": [...]
    }
  ],
  "summary": {
    "totalRooms": 6,
    "totalCorridors": 1,
    "totalArea": 505.0,
    "unit": "sqm",
    "roomTypes": { "office": 1, "meeting_room": 1, ... },
    "systemsCoverage": { "cctv": { "roomsCovered": 5, "cameraCount": 13 }, ... }
  },
  "recommendations": [...]
}
```

**Multi-sheet requests**: with `files[]`, the model returns one `pages` entry per legible floor plan (`pageNumber` = attachment position); non-plan sheets (covers, plain documents) are skipped. `fileInfo.fileName` lists all uploaded names.

**analysisOptions.confidenceThreshold** (0–1): sections whose own `confidence` is below the threshold are dropped from the buckets (and therefore from `summary`); unscored sections are kept.

**Reliability**: when the AI returns no usable structure the endpoint answers **503** ("did not return usable output. Please retry."); a PDF whose text extraction is rate-limited/unavailable also answers **503**, while a genuinely unreadable PDF answers **422**.

### Section Object Types

| Type                  | SubTypes                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room`                | `office`, `meeting_room`, `server_room`, `restroom`, `pantry`, `storage`, `electrical_room`, `mechanical_room`, `lobby`, `reception`, `corridor`, `stairwell`, `elevator_lobby` |
| `corridor`            | `main_corridor`, `secondary_corridor`, `fire_exit_corridor`                                                                                                                     |
| `verticalCirculation` | `stair`, `elevator`, `escalator`, `ramp`                                                                                                                                        |
| `utilityAreas`        | `electrical_room`, `mdp`, `idf`, `pump_room`, `ahu_room`, `generator_room`                                                                                                      |

---

## 2. Section Requirements Extraction API

Extracts detailed system requirements for a specific floor plan section.

### Endpoint

```
POST /service/estimation/ai/section/requirements
```

### Request

```json
{
  "section": {
    "sectionId": "sec-003",
    "type": "room",
    "subType": "server_room",
    "label": "Server Room / IDF",
    "confidence": 0.96,
    "polygon": [{ "x": 34.0, "y": 2.0 }, ...],
    "bbox": { "x": 34.0, "y": 2.0, "width": 8.0, "height": 5.0 },
    "area": 40.0,
    "unit": "sqm",
    "annotations": ["SERVER RM", "IDF-3", "AC REQUIRED"],
    "features": { "doors": [...], "raisedFloor": true, "powerOutlets": 24, ... },
    "systemsDetected": { "cctv": {...}, "fdas": {...}, "accessControl": {...} }
  },
  "projectContext": {
    "buildingType": "Office Building",
    "floors": 10,
    "systemTypes": ["CCTV", "FDAS", "ACCESS_CONTROL", "ENVIRONMENTAL"],
    "projectId": "proj-2026-001",
    "applicableStandards": ["PEC 2017", "NFPA 72", "NFPA 75", "TIA-942", "ISO 27001"]
  },
  "analysisOptions": {
    "includeCatalogMatches": true,
    "includeLaborEstimates": true,
    "includeMaterialAlternates": true,
    "includeCodeReferences": true,
    "market": "philippines",
    "currency": "PHP"
  },
  "supplementalDocuments": [
    { "name": "TOR - HQ CCTV Upgrade.pdf", "content": "Scope: 85 cameras (55 indoor dome, 30 outdoor bullet), 8MP…" }
  ]
}
```

The optional `supplementalDocuments` field (see *Supplemental Documents*) is
injected into the prompt alongside the section data.

### System Scope

`projectContext.systemTypes` is **strict**: the AI answers only for the system
types provided by the user — e.g. `["POS_SYSTEM"]` yields POS-related entries
only, never CCTV/FDAS/Access-Control requirements. The server enforces this
independently of the model: `requirements`, the per-system keys of
`laborEstimates`, `recommendations`, and `compliance.gaps` are hard-filtered to
the provided types before the response is returned (`totalHours`/`crewMix`
rollups survive the filter, as do `general` entries not tied to a system).
Matching is case- and format-insensitive (`POS_SYSTEM` ~ `posSystem` ~
`pos_system`). When `systemTypes` is absent or empty, scope is inferred from the
section type and nothing is filtered.

### Product Catalog

Materials are priced against the business's **product database** (the same
catalog the Quotation AI uses). The server fetches a catalog slice before the
analysis, scoped to `projectContext.systemTypes` when provided (the System
Scope above applies to the catalog too), otherwise to the systems the drawing
detected in the section. The slice is injected into the prompt as an
authoritative `=== INTERNAL PRODUCT CATALOG ===` block, and the model output is
then matched row-by-row server-side:

- **Matched rows** (`model`, or a hyphenated model code embedded in the name,
  resolves to a product) carry the catalog's exact Code/Model/Brand/Price and
  gain `"source": "catalog"` plus a `"catalog"` object
  `{ "prod_Code", "prod_Name", "brand", "prod_price" }`. The catalog price
  becomes `srp`/`unitPrice`, `totalPrice` is recomputed from it, and any
  guessed price tiers are dropped so normalization re-derives
  `contractorPrice`/`dealerPrice` from the catalog SRP.
- **Unmatched rows** keep the model's market estimates and default to
  `"source": "market"` (no `catalog` object).
- `materialSummary` is recomputed from the returned rows (category rollup +
  total), so it can never disagree with the itemized materials.
- `analysisOptions.includeCatalogMatches: false` skips the catalog entirely
  (no block in the prompt, no `source`/`catalog` rewriting).

### Response (200 OK)

Envelope: `{ "success": true, "data": <object below> }`

```json
{
  "requestId": "sreq-2026-001234",
  "analyzedAt": "2026-01-15T15:45:00Z",
  "sectionId": "sec-003",
  "sectionLabel": "Server Room / IDF",
  "sectionType": "server_room",
  "area": 40.0,
  "unit": "sqm",
  "confidenceScore": 92,
  "requirements": {
    "cctv": {
      "required": true,
      "coverage": "Full interior + door approaches",
      "cameraCount": 2,
      "cameraSpecs": [
        { "type": "dome", "model": "IPC-D4MP", "quantity": 1, "mount": "ceiling_center", "rationale": "Full room coverage" }
      ],
      "cabling": { "cat6Runs": 2, "poePorts": 2, "patchPanelPorts": 2 },
      "standards": ["NFPA 72", "TIA-942", "ISO 27001"],
      "codeReferences": ["PEC 2017 Art. 7.6", "RA 10173"]
    },
    "fdas": { ... },
    "accessControl": { ... },
    "environmental": { ... },
    "power": { ... },
    "cooling": { ... },
    "cabling": { ... },
    "civilWorks": { ... }
  },
  "laborEstimates": {
    "cctv": { "hours": 8, "crew": ["Lead Tech", "Tech"], "details": "..." },
    "fdas": { "hours": 12, "crew": ["Lead Engineer", "Tech"], "details": "..." },
    "totalHours": 84,
    "crewMix": { "Lead Engineer": 1, "Lead Tech": 2, "Technician": 3, ... }
  },
  "manpower": [
    { "role": "Lead Tech", "headcount": 1, "hours": 40, "manDays": 5, "dayRate": 1800, "totalCost": 9000 },
    { "role": "Technician", "headcount": 3, "hours": 40, "manDays": 15, "dayRate": 1200, "totalCost": 18000 }
  ],
  "materials": [
    { "name": "8MP Dome Camera", "model": "DS-2CD2146G2-IU", "brand": "Hikvision", "category": "CCTV", "quantity": 2, "unit": "pc", "srp": 5000, "contractorPrice": 4250, "dealerPrice": 3750, "unitPrice": 5000, "totalPrice": 10000, "source": "catalog", "catalog": { "prod_Code": "HK-D8MP", "prod_Name": "8MP Dome Camera", "brand": "Hikvision", "prod_price": 5000 } },
    { "name": "Cat6 Cable", "brand": "Commscope", "category": "Cabling", "quantity": 120, "unit": "m", "srp": 45, "contractorPrice": 38, "dealerPrice": 34, "unitPrice": 45, "totalPrice": 5400, "source": "market" }
  ],
  "scopeOfWorks": [
    { "itemNumber": 1, "description": "Supply & install 2 pcs IP dome cameras", "unit": "1 LOT", "totalPrice": 10000 },
    { "itemNumber": 2, "description": "Lay Cat6 cable from IDF to cameras", "unit": "m", "totalPrice": 5400 }
  ],
  "constraints": {
    "physical": "Server room has a raised floor; ceiling access via fixed ladder.",
    "electrical": "Dedicated 220V circuits required; PoE switch provided by client.",
    "installation": "Work must be performed after 6 PM to avoid business disruption."
  },
  "materialSummary": {
    "categories": [
      { "category": "CCTV", "itemCount": 5, "estimatedCost": 18500.00 },
      { "category": "FDAS", "itemCount": 6, "estimatedCost": 25400.00 }
    ],
    "totalEstimatedCost": 272900.00,
    "currency": "PHP"
  },
  "compliance": {
    "gaps": [
      { "system": "fdas", "requirement": "NFPA 75 Sec 5.3", "status": "missing", "recommendation": "Add FM-200 suppression" }
    ],
    "overallCompliance": 85
  },
  "recommendations": [
    { "priority": "critical", "system": "fdas", "action": "Add FM-200 suppression", "estimatedCost": 180000.00 }
  ]
}
```

**sectionType** echoes the section's `subType` when present (e.g. `server_room` for a `room` section) — the specific kind is more useful than the coarse `type`; it falls back to `type` when there is no `subType`.

**Form-ready rows** — `manpower`, `materials`, `scopeOfWorks` and `constraints` are shaped exactly like the tables on the Cost Estimation page, so the wizard drops them straight in:

| Field | Shape | Notes |
| --- | --- | --- |
| `manpower[]` | `{ role, headcount, hours, manDays, dayRate, totalCost }` | `hours` = hours per person for the job; `manDays` = total person-days (headcount × working days); `totalCost` = dayRate × manDays. Empty when `includeLaborEstimates: false`. |
| `materials[]` | `{ name, brand, category, quantity, unit, srp, contractorPrice, dealerPrice, unitPrice, totalPrice }` | Itemized BOQ rows (not category rollups). All three tiers are always present: contractor ≈ 85% of SRP, dealer ≈ 75%, `unitPrice` = SRP. |
| `scopeOfWorks[]` | `{ itemNumber, description, unit, totalPrice }` | Numbered installation work items for the section. |
| `constraints` | `{ physical, electrical, installation }` | Three free-text sentences; empty strings when unknown. |

`laborEstimates.crewMix` / `totalHours` are derived from `manpower` when the model omits the rollup, and `materialSummary.totalEstimatedCost` falls back to the sum of the `materials` rows. Non-numeric input degrades to the empty shapes shown in the defaults (`[]`, `{ physical: "", electrical: "", installation: "" }`).

**Validation (400)**: a body without a `section` object, a `section` without `sectionId`, an array body, or unparseable JSON all return 400 with `{ "success": false, "data": "", "error": "<reason>" }` before any AI call is made.

**analysisOptions flags** are honored structurally, not just in the prompt: `includeLaborEstimates: false` empties `laborEstimates` to `{ "totalHours": 0, "crewMix": {} }`, and `includeCodeReferences: false` strips every `codeReferences` array from `requirements`. `market`/`currency` feed the prompt (default `philippines`/`PHP`).

---

## 3. Estimation Analysis API

Analyzes detailed site information and service-specific configurations to recommend manpower, labor, materials, and costs.

### Endpoint

```
POST /service/estimation/ai/analyze
```

### Request

```json
{
	"siteInfo": {
		"buildingType": "Office Building",
		"floors": 10,
		"buildingLength": 50.0,
		"buildingWidth": 30.0,
		"floorHeight": 3.0,
		"totalFloorArea": 15000.0,
		"roomsCount": 45,
		"locationName": "Makati City, Manila",
		"latitude": 14.5995,
		"longitude": 120.9842,
		"surveyScope": "Full CCTV coverage for lobby, corridors, parking. FDAS per PEC 2017. Access control for server rooms.",
		"scheduleDate": "2026-10-15",
		"isNewBuilding": true
	},
	"systems": {
		"CCTV": {
			"enabled": true,
			"cameraCount": 85,
			"resolution": "8MP",
			"cameraTypes": ["Dome", "Bullet", "PTZ"],
			"environment": "Both",
			"preferredBrand": "Hikvision",
			"indoorCameras": 55,
			"outdoorCameras": 30,
			"infrastructure": {
				"cableType": "Cat6a",
				"preferredCableBrand": "Commscope",
				"cablePath": "Cable Tray",
				"wallType": "Concrete",
				"coreDrilling": true,
				"cableLength": 2500,
				"preferredCableBrand": "Commscope"
			}
		},
		"FDAS": {
			"enabled": true,
			"systemType": "Addressable",
			"preferredBrand": "Edwards",
			"smokeDetectors": 120,
			"heatDetectors": 20,
			"mcpCount": 12,
			"sounders": 8,
			"panel": {
				"location": "Security Room",
				"rackAvailable": true,
				"powerAvailable": true,
				"networkRequired": true
			}
		},
		"ACCESS_CONTROL": {
			"enabled": true,
			"doorCount": 12,
			"doorType": "Fire Rated",
			"readerType": "Biometric",
			"lockType": "Maglock",
			"controller": {
				"location": "Server Room",
				"poeAvailable": true,
				"upsRequired": true,
				"networkRequired": true
			},
			"readerType": "Biometric",
			"lockType": "Maglock"
		},
		"BURGLAR_ALARM": {
			"enabled": false
		},
		"FIRE_PROTECTION": {
			"enabled": false
		},
		"OTHER": {
			"enabled": false
		}
	},
	"clientContext": {
		"companyName": "ABC Corporation Philippines",
		"projectName": "HQ CCTV & FDAS Upgrade",
		"clientName": "Juan Dela Cruz",
		"clientEmail": "client@email.com",
		"clientContactNumber": "09171234567",
		"budgetTier": "standard",
		"prioritySystems": ["FDAS", "CCTV"],
		"existingInfrastructure": true,
		"existingDetails": "Existing Cat6 backbone, 24-port switches on each floor"
	},
	"analysisOptions": {
		"includeLaborBreakdown": true,
		"includeMaterialAlternates": true,
		"includePhaseSchedule": true,
		"confidenceThreshold": 50,
		"currency": "PHP",
		"market": "philippines"
	},
	"supplementalDocuments": [
		{ "name": "TOR - HQ CCTV Upgrade.pdf", "content": "Scope: 85 cameras (55 indoor dome, 30 outdoor bullet), 8MP…" }
	]
}
```

The optional `supplementalDocuments` field (see *Supplemental Documents*) is
injected into the estimation prompt alongside `siteInfo`/`systems`.

---

## Complete Field Reference by Service

### CCTV Service Fields

| Field                                | Type     | Required | Options/Format                                                                         |
| ------------------------------------ | -------- | -------- | -------------------------------------------------------------------------------------- |
| `enabled`                            | boolean  | ✅       | true/false                                                                             |
| `cameraCount`                        | number   | ✅       | ≥1                                                                                     |
| `resolution`                         | string   |          | "2MP" \| "5MP" \| "8MP" \| "12MP"                                                      |
| `cameraTypes[]`                      | string[] |          | "Dome" \| "Bullet" \| "PTZ" \| "Fisheye" \| "Thermal" \| "Box"                         |
| `environment`                        | string   |          | "Indoor" \| "Outdoor" \| "Both"                                                        |
| `preferredBrand`                     | string   |          | "Hikvision" \| "Dahua" \| "Avtech" \| "Bosch" \| "Ezviz" \| "Honeywell" \| "Panasonic" |
| `indoorCameras`                      | number   |          | ≥0 (auto-filled from AI)                                                               |
| `outdoorCameras`                     | number   |          | ≥0 (auto-filled from AI)                                                               |
| `infrastructure.cableType`           | string   |          | "Cat5e" \| "Cat6" \| "Cat6a" \| "Fiber" \| "Coax"                                      |
| `infrastructure.preferredCableBrand` | string   |          | "Commscope" \| "Panduit" \| "Alantek" \| "Systimax" \| "Linkbasic"                     |
| `infrastructure.cablePath`           | string   |          | "Cable Tray" \| "Conduit" \| "Ceiling" \| "Underground" \| "Wall"                      |
| `infrastructure.wallType`            | string   |          | "Drywall" \| "Concrete" \| "Brick" \| "Metal"                                          |
| `infrastructure.coreDrilling`        | boolean  |          | true/false                                                                             |
| `infrastructure.cableLength`         | number   |          | meters                                                                                 |
| `infrastructure.preferredCableBrand` | string   |          | "Commscope" \| "Panduit" \| "Alantek" \| "Systimax" \| "Linkbasic"                     |

### FDAS Service Fields

| Field                   | Type    | Required | Options/Format                                                                                                                              |
| ----------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`               | boolean | ✅       | true/false                                                                                                                                  |
| `systemType`            | string  |          | "Conventional" \| "Addressable" \| "Wireless"                                                                                               |
| `preferredBrand`        | string  |          | "ASENWARE" \| "EDWARDS" \| "GAMEWELL BY HONEYWELL" \| "GST" \| "HOCHIKI" \| "HONEYWELL" \| "HORING-LIH" \| "NOTIFIER" \| "SIMPLEX" \| "TYY" |
| `smokeDetectors`        | number  |          | ≥0                                                                                                                                          |
| `heatDetectors`         | number  |          | ≥0                                                                                                                                          |
| `mcpCount`              | number  |          | ≥0 (Manual Call Points)                                                                                                                     |
| `sounders`              | number  |          | ≥0                                                                                                                                          |
| `panel.location`        | string  |          | string                                                                                                                                      |
| `panel.rackAvailable`   | boolean |          | true/false                                                                                                                                  |
| `panel.powerAvailable`  | boolean |          | true/false                                                                                                                                  |
| `panel.networkRequired` | boolean |          | true/false                                                                                                                                  |

### Access Control Service Fields

| Field                        | Type    | Required | Options/Format                                     |
| ---------------------------- | ------- | -------- | -------------------------------------------------- |
| `enabled`                    | boolean | ✅       | true/false                                         |
| `doorCount`                  | number  |          | ≥1                                                 |
| `doorType`                   | string  |          | "Wood" \| "Metal" \| "Glass" \| "Fire Rated"       |
| `readerType`                 | string  |          | "Proximity" \| "Biometric" \| "Keypad" \| "Mobile" |
| `lockType`                   | string  |          | "Maglock" \| "Strike" \| "Cable"                   |
| `controller.location`        | string  |          | string                                             |
| `controller.poeAvailable`    | boolean |          | true/false                                         |
| `controller.upsRequired`     | boolean |          | true/false                                         |
| `controller.networkRequired` | boolean |          | true/false                                         |
| `readerType`                 | string  |          | "Proximity" \| "Biometric" \| "Keypad" \| "Mobile" |
| `lockType`                   | string  |          | "Maglock" \| "Strike" \| "Cable"                   |

### Burglar Alarm Service Fields

| Field            | Type   | Options |
| ---------------- | ------ | ------- |
| `pirSensors`     | number | ≥0      |
| `doorContacts`   | number | ≥0      |
| `glassBreak`     | number | ≥0      |
| `outdoorSensors` | number | ≥0      |

### Fire Protection (Suppression) Fields

| Field             | Type   | Options                                                   |
| ----------------- | ------ | --------------------------------------------------------- |
| `suppressionType` | string | "Sprinkler" \| "FM200" \| "Novec 1230" \| "CO2" \| "Foam" |
| `zones`           | number | ≥1                                                        |
| `cylinders`       | number | ≥1                                                        |

### Panel / Controller Fields

| Field                | Type    | Options    |
| -------------------- | ------- | ---------- |
| `panelLocation`      | string  | string     |
| `rackAvailable`      | boolean | true/false |
| `powerAvailable`     | boolean | true/false |
| `networkRequired`    | boolean | true/false |
| `controllerLocation` | string  | string     |
| `poeAvailable`       | boolean | true/false |
| `upsRequired`        | boolean | true/false |
| `networkRequired`    | boolean | true/false |

### Other Systems (Generic)

| Field             | Type    | Options                                                            |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `otherSystemType` | string  | "Turnstile" \| "Boom Barrier" \| "Intercom" \| "Gate" \| "Parking" |
| `description`     | string  | free text                                                          |
| `quantity`        | number  | ≥1                                                                 |
| `powerRequired`   | boolean | true/false                                                         |

---

## Response (200 OK) — Estimation Analysis (API #3)

Envelope: `{ "success": true, "data": <object below> }`

```json
{
  "requestId": "est-2026-001234",
  "analyzedAt": "2026-01-15T10:30:00Z",
  "confidenceScore": 82,
  "assumptions": [
    "Standard 8-hour workday, 5-day work week",
    "Union labor rates per DOLE 2024",
    "Materials priced at 2024 Philippine market rates"
  ],
  "summary": {
    "totalEstimatedCost": 2470000.00,
    "currency": "PHP",
    "breakdown": {
      "materials": 1425000.00,
      "labor": 985000.00,
      "fees": 60000.00,
      "equipment": 0,
      "consumables": 0,
      "contingency": 0.10
    },
    "timeline": {
      "totalDays": 22,
      "phases": [
        { "phase": "Pre-install & Mobilization", "days": 2 },
        { "phase": "Rough-in (Cable/Conduit)", "days": 8 },
        { "phase": "Device Installation", "days": 6 },
        { "phase": "Termination & Configuration", "days": 4 },
        { "phase": "Testing & Commissioning", "days": 2 }
      ]
    }
  },
  "manpower": [
    {
      "role": "Project Manager",
      "headcount": 1,
      "hours": 176,
      "manDays": 22,
      "dayRate": 2500.00,
      "totalCost": 55000.00,
      "responsibilities": "Overall coordination, client liaison, schedule management"
    },
    {
      "role": "Lead Technician",
      "headcount": 2,
      "hours": 440,
      "manDays": 44,
      "dayRate": 1800.00,
      "totalCost": 79200.00,
      "responsibilities": "System terminations, commissioning, testing"
    }
  ],
  "labor": [
    {
      "activity": "Cable Pulling & Conduit Installation",
      "systemTypes": ["CCTV", "FDAS", "ACCESS_CONTROL"],
      "crewComposition": { "Technician": 4, "Helper": 2 },
      "estimatedHours": 480,
      "unit": "man-hours",
      "ratePerHour": 150.00,
      "totalCost": 72000.00,
      "details": "Cable pulling through existing conduit + new conduit runs"
    }
  ],
  "materials": [
    {
      "category": "CCTV Equipment",
      "items": [
        { "description": "4MP IP Dome Camera", "model": "IPC-D4MP", "brand": "Hikvision", "quantity": 40, "unit": "pcs", "srp": 4200.00, "contractorPrice": 3570.00, "dealerPrice": 3150.00, "unitPrice": 4200.00, "totalPrice": 168000.00, "source": "catalog", "catalog": { "prod_Code": "A0657", "prod_Name": "Dome Cam 4MP", "brand": "Hikvision", "prod_price": 4200.00 } }
      ],
      "subtotal": 306500.00
    }
  ],
  "equipment": [...],
  "fees": [
    { "type": "Travel Fee", "amount": 12500.00, "description": "Mobilization/Demobilization — Metro Manila site" },
    { "type": "Permit Fee", "amount": 3500.00, "description": "City building permit coordination" }
  ],
  "scopeOfWorks": [
    { "itemNumber": 1, "description": "Supply, install, terminate and commission 40 pcs 4MP IP dome cameras incl. brackets and connectors", "unit": "1 LOT", "totalPrice": 168000.00 },
    { "itemNumber": 2, "description": "Provide Cat6a UTP horizontal cabling from IDF to each camera outlet, labeled at both ends", "unit": "1 LOT", "totalPrice": 95000.00 },
    { "itemNumber": 3, "description": "Configure NVR, VMS licensing, recording schedules and user accounts", "unit": "1 LOT", "totalPrice": 42000.00 }
  ],
  "constraints": {
    "physical": "Server room is on the 3rd floor with an existing 42U rack; ceiling height 2.8m with limited crawl-space above the lobby ceiling.",
    "electrical": "Existing 220V outlets available near each IDF; NVR rack requires a dedicated 20A circuit provided by the client.",
    "installation": "Cable pulling and drilling restricted to 18:00–06:00 to avoid business disruption; loading dock access for deliveries requires a 24-hour prior notice."
  },
  "alternates": [...],
  "phaseSchedule": [...],
  "risks": [...]
}
```

**Form-ready blocks** — `manpower`, `fees`, `scopeOfWorks` and `constraints` are shaped exactly like the tables on the Cost Estimation page; the wizard drops them straight into the form:

| Field | Shape | Notes |
| --- | --- | --- |
| `manpower[]` | `{ role, headcount, hours, manDays, dayRate, totalCost, responsibilities }` | `hours` = hours per person over the job; `manDays` = total person-days (headcount × working days); `totalCost` = dayRate × manDays. Day rates: PM 2500, Lead Eng 2000, Lead Tech 1800, Tech 1200, Helper 800, QC 2200, Electrician 1500 (PHP/day). |
| `materials[].items[]` | `{ description, model, brand, quantity, unit, srp, contractorPrice, dealerPrice, unitPrice, totalPrice, source, catalog? }` | Always carries all three price tiers: contractor ≈ 85% of SRP, dealer ≈ 75%, `unitPrice` = SRP. When the item matched the product catalog, `srp` is overwritten with the catalog price and tiers are re-derived from it. |
| `fees[]` | `{ type, amount, description }` | `type` is always one of `Travel Fee`, `Congestion Fee`, `Short Notice Fee`, `Overtime Fee`, `Weekend Fee`, `Holiday Fee`, `Permit Fee`, `Other` (unrecognized types coerce to `Other`). |
| `scopeOfWorks[]` | `{ itemNumber, description, unit, totalPrice }` | Numbered installation work items; `itemNumber` defaults to the array order when the model omits it. |
| `constraints` | `{ physical, electrical, installation }` | Three free-text sentences; empty strings when unknown. |

**Summary reconciliation** — `summary.breakdown` is rebuilt server-side from the rows themselves (`materials` = Σ materials item `totalPrice`, `labor` = Σ manpower `totalCost`, `fees` = Σ fees `amount`) and `summary.totalEstimatedCost` = materials + labor + fees. That makes the panel headline, the breakdown, and the Cost Estimation page's Grand Total (Σ manpower + Σ materials + Σ fees) the same number. `equipment`/`consumables` stay 0 — narrative amounts with no matching row are dropped (prompt rule 16 forbids them; rentals and consumables must be returned as material items). `contingency` remains a ratio only (0.10 = 10%, not added to the total). When the response carries no priced rows at all, the model's original `summary` is passed through unchanged. Category `subtotal` is always the sum of its own items.

**Normalization guarantees** (applied in `normalizeEstimationResult`, unit-tested in `estimationAnalysis.test.js`): legacy `hoursPerDay`/`totalDays` manpower rows convert to the form shape; a `hours` value that is really the project/crew total is converted to per-person so the form invariant `manDays = ceil(headcount × hours / 8)` always holds; `totalCost` is recomputed as `dayRate × manDays` whenever a rate is present; malformed arrays degrade to `[]`; `confidenceScore` accepts 0–100 or 0–1 fractions with a 75 fallback; every key above is always present.

`confidenceScore` in this example is 82; the response also echoes `requestId` (`est-…`) and `analyzedAt` (ISO-8601).

---

## Common Error Responses

| Status | Code                   | Description                                       |
| ------ | ---------------------- | ------------------------------------------------- |
| 400    | `VALIDATION_ERROR`     | Request body / multipart validation failed        |
| 401    | `UNAUTHORIZED`         | Invalid or expired session token                  |
| 403    | `FORBIDDEN`            | Insufficient permissions                          |
| 404    | `NOT_FOUND`            | Resource not found                                |
| 413    | `FILE_TOO_LARGE`       | Upload exceeds the per-file size limit (12 MB)    |
| 422    | `UNPROCESSABLE_ENTITY` | Input valid but cannot process (e.g. unreadable PDF, DWG/DXF upload) |
| 429    | `RATE_LIMITED`         | Too many requests (per-endpoint limits below)     |
| 500    | `INTERNAL_ERROR`       | Server error                                      |
| 503    | `SERVICE_UNAVAILABLE`  | AI service busy, misconfigured, or returned unusable output |
| 504    | `TIMEOUT`              | AI analysis exceeded the 120 s budget             |

---

## Rate Limits

| Endpoint                                     | Limit                                             |
| -------------------------------------------- | ------------------------------------------------- |
| `/api/floorplan/analyze`                     | 5 requests/minute per IP, then 429                |
| `/service/estimation/ai/section/requirements` | 1 request/second per IP, then 429 (shared AI gateway) |
| `/service/estimation/ai/analyze`             | 1 request/second per IP, then 429 (shared AI gateway) |

---

## Integration Flow

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────────┐
│  Floor Plan     │────▶│  Section Requirements    │────▶│  Estimation         │
│  Analysis       │     │  Extraction (per section)│     │  Analysis           │
└─────────────────┘     └──────────────────────────┘     └─────────────────────┘
        │                        │                              │
        ▼                        ▼                              ▼
  Structured sections      Detailed specs per           Final BOQ with
  (rooms, corridors,       system with labor,            manpower, materials,
  systems detected)        materials, compliance          labor, schedule
```

---

## Testing with cURL

### Floor Plan Analysis

```bash
curl -X POST https://aa2000backend-server.onrender.com/api/floorplan/analyze \
  -H "Authorization: Bearer <token>" \
  -H "X-Session-Id: <token>" \
  -F "file=@floor-plan.pdf" \
  -F "fileType=pdf" \
  -F 'projectContext={"buildingType":"Office Building","floors":10}' \
  -F 'analysisOptions={"extractDimensions":true,"detectSystems":true}'
```

### Section Requirements

```bash
curl -X POST https://aa2000backend-server.onrender.com/service/estimation/ai/section/requirements \
  -H "Authorization: Bearer <token>" \
  -H "X-Session-Id: <token>" \
  -H "Content-Type: application/json" \
  -d '{"section":{"sectionId":"sec-003","type":"room","subType":"server_room",...},"projectContext":{...}}'
```

### Estimation Analysis

```bash
curl -X POST https://aa2000backend-server.onrender.com/service/estimation/ai/analyze \
  -H "Authorization: Bearer <token>" \
  -H "X-Session-Id: <token>" \
  -H "Content-Type: application/json" \
  -d '{"siteInfo":{...},"systems":{"CCTV":{...},"FDAS":{...}},...}'
```
