# Technical & Solution Design — ElementIdExtractor + TestCaseGenerator

| Field | Value |
|---|---|
| **Module** | `src/utils/` |
| **Author** | — |
| **Version** | 1.0 |
| **Status** | Active |

---

## 1. Purpose

Automate two labour-intensive tasks in the test automation lifecycle:

1. **ElementIdExtractor** — Parse Angular `*-base.config.ts` files and produce stable, human-readable **label → elementId** page-object maps.
2. **TestCaseGenerator** — Consume those maps plus rich UI metadata to synthesise scenario-based **XLSX test-case workbooks**, one sheet per business entity.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Input Source                            │
│   Angular app-pages/*-base.config.ts + fieldConfig files    │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   ElementIdExtractor    │
              │  (Label Normaliser)     │
              └────────────┬────────────┘
                           │  ExtractionResult[]
              ┌────────────▼────────────┐
              │  Generated Page-Object  │
              │  .ts files (one/config) │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   TestCaseGenerator     │
              │  (Scenario Synthesiser) │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  generated-test-cases   │
              │  .xlsx (sheet/entity)   │
              └─────────────────────────┘
```

---

## 3. Component Design

### 3.1 ElementIdExtractor

| Aspect | Detail |
|---|---|
| **Input** | Root directory containing `*-base.config.ts` files |
| **Output** | `ExtractionResult[]` — each containing `exportName`, `entries` (label→elementId), `sourceFile` |
| **Side-effect** | Writes one `.ts` page-object file per config into the output directory |

#### 3.1.1 Processing Pipeline

```
findBaseConfigs(dir)            ← Recursive FS scan for *-base.config.ts
        │
        ▼
extractFromFile(filePath)       ← Per-file extraction
   ├─ Read file content
   ├─ resolveFieldConfigPath()  ← Resolve imported fieldConfig module
   ├─ parseFieldConfig()        ← Build name→label map from fieldConfig
   ├─ Regex scan: elementId blocks
   └─ Label resolution chain:
        1. `label` prop in same block
        2. `pageTitle` prop in same block
        3. `...fieldConfig['key']` spread reference
        4. Direct fieldConfig name match
        5. Fallback → use elementId as label
        │
        ▼
generateOutput(exportName, entries)
   └─ Write: export const <name>_page = { 'Label': 'elementId', ... }
```

#### 3.1.2 Key Design Decisions

| Decision | Rationale |
|---|---|
| Regex-based parsing (not AST) | Config files follow a strict pattern; avoids TS compiler dependency at runtime |
| 5-level label fallback chain | Maximises human-readable labels while guaranteeing every elementId gets mapped |
| Overloaded `extract()` method | Provides both single-file and batch APIs for flexibility |

---

### 3.2 TestCaseGenerator

| Aspect | Detail |
|---|---|
| **Input** | `GeneratorOptions` — `inputDir`, optional `outputDir`, `pageObjectOutputDir`, `outputXlsx` |
| **Output** | XLSX workbook file path |
| **Dependency** | `ElementIdExtractor` (composed internally) |

#### 3.2.1 Processing Pipeline

```
generate(options)
   │
   ├─ Step 1: ElementIdExtractor.extractFromDirectory()
   │          → ExtractionResult[]
   │
   ├─ Step 2: parseAllConfigs()
   │   └─ Per config → PageMeta
   │       ├─ inferPageType()       → list | detail | other
   │       ├─ inferEntityName()     → entity key from path
   │       ├─ parseFieldMetadata()  → FieldMeta[] (type, mandatory, validations, etc.)
   │       ├─ parseButtons()        → button label, elementId, action
   │       ├─ parseColumns()        → column label, field, elementId
   │       ├─ parseSections()       → section label, elementId
   │       └─ Filter fields against page-object labels
   │
   ├─ Step 3: groupByEntity()
   │          → Map<entity, { list?, detail?, others[] }>
   │
   ├─ Step 4: generateEntityTestCases() per group
   │   ├─ List page scenarios
   │   │   ├─ Page load verification
   │   │   ├─ Action button verification
   │   │   ├─ Quick filter
   │   │   ├─ Open existing record
   │   │   ├─ Delete record
   │   │   └─ Refresh
   │   │
   │   ├─ Detail page scenarios
   │   │   ├─ Create new record (fill all editable fields)
   │   │   ├─ Field visibility verification
   │   │   ├─ Mandatory field validation
   │   │   ├─ Boundary / regex validation
   │   │   ├─ Read-only field verification
   │   │   ├─ Dropdown options verification
   │   │   └─ Cancel / Back navigation
   │   │
   │   └─ Other page scenarios
   │
   └─ Step 5: Write XLSX (one sheet per entity, auto-fit columns)
```

#### 3.2.2 Test Case Row Format

| Column | Populated On |
|---|---|
| S.no, Component, Priority, Test Type, Test Case ID, DataSet, Name, Description | Header row only |
| Action, Data, Expected Results | Every row (header + step rows) |

Step rows leave metadata columns `null` — they inherit context from the preceding header row.

#### 3.2.3 UI Type → Action Mapping

The `UI_TYPE_ACTION_MAP` drives automatic step generation:

| UI Type | Action Verb | Sample Data |
|---|---|---|
| STRING / TEXT | Enter | Test String Value |
| NUMBER | Enter | 42 |
| DROPDOWN | Select | First allowed value |
| BOOLEAN | Check | — |
| DATE | Enter | 15/03/2026 |
| FILE_ATTACHMENT | Upload | test-file.pdf |
| AUTO_NUMBER | *(skip — read-only)* | — |

#### 3.2.4 Key Design Decisions

| Decision | Rationale |
|---|---|
| Composes ElementIdExtractor internally | Single-command pipeline; user doesn't need to pre-run extraction |
| Groups list + detail per entity | Mirrors real user workflows (list → navigate → detail → save) |
| Filters fields against page-object labels | Only generates steps for elements the framework can actually resolve at runtime |
| Scenario-first generation (not field-first) | Produces coherent end-to-end test flows, not fragmented field checks |

---

## 4. Data Flow Diagram

```
  *-base.config.ts ──┐
                     │
  fieldConfig.ts ────┤
                     ▼
            ┌────────────────┐     ExtractionResult[]    ┌──────────────────┐
            │ ElementId      │ ─────────────────────────▶│ Page-Object .ts  │
            │ Extractor      │                           │ files            │
            └───────┬────────┘                           └──────────────────┘
                    │
                    │ ExtractionResult[]
                    ▼
            ┌────────────────┐     PageMeta[]
            │ Config Parser  │ ──────────────┐
            │ (inside TCGen) │               │
            └────────────────┘               ▼
                                    ┌────────────────┐
                                    │ Entity Grouper │
                                    └───────┬────────┘
                                            │
                                            ▼
                                    ┌────────────────┐     TestCaseRow[]
                                    │ Scenario       │ ───────────────────▶ XLSX
                                    │ Generator      │
                                    └────────────────┘
```

---

## 5. Interface Contracts

### ExtractionResult

```ts
interface ExtractionResult {
  exportName: string;              // e.g. "sample_detail_page"
  entries: Record<string, string>; // label → elementId
  sourceFile: string;              // absolute path
}
```

### GeneratorOptions

```ts
interface GeneratorOptions {
  inputDir: string;
  outputDir?: string;
  pageObjectOutputDir?: string;
  outputXlsx?: string;
}
```

### PageMeta (internal)

```ts
interface PageMeta {
  pageType: 'detail' | 'list' | 'other';
  pageTitle: string;
  entityName: string;
  fields: FieldMeta[];
  buttons: { label, elementId, action? }[];
  columns: { label, field, elementId, uiType }[];
  sections: { label, elementId }[];
  hasQuickFilter: boolean;
  hasSearch: boolean;
  hasTable: boolean;
}
```

---

## 6. Execution Modes

| Mode | Command |
|---|---|
| **Programmatic** | `new TestCaseGenerator().generate({ inputDir: '...' })` |
| **CLI — Extractor only** | `node ElementIdExtractor.js <folder> [output-dir]` |
| **CLI — Full pipeline** | `node TestCaseGenerator.js <source-dir> [output-dir] [page-object-dir]` |

---

## 7. Constraints & Assumptions

| # | Item |
|---|---|
| 1 | Config files follow the Angular `*-base.config.ts` naming convention |
| 2 | `fieldConfig` is imported with a relative path resolvable from the config file directory |
| 3 | Regex parsing assumes consistent formatting (no computed property keys) |
| 4 | Entity grouping derives from folder structure (`app-pages/<entity>/`) or filename fallback |
| 5 | Sheet names are truncated to 31 characters per Excel limits |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Non-standard config formatting breaks regex parsing | Missing fields in output | Validate generated output; fall back to elementId as label |
| Large number of entities → huge XLSX | Slow generation, large file | Pagination or per-entity file split (future) |
| fieldConfig import path unresolvable | Empty field metadata | Graceful fallback — fields array is empty, TC generation still proceeds for buttons/columns/sections |

---

## 9. Future Considerations

- AST-based parsing for stronger resilience to formatting variations
- Delta generation — only regenerate for changed configs
- Direct Xray/Jira upload integration from generated XLSX
- Parameterised test data injection from external data sources
