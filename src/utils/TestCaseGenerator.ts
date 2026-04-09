import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { logger } from '../helpers/logger';
import { ElementIdExtractor, ExtractionResult } from './ElementIdExtractor';

// ── Public types ───────────────────────────────────────────────────

/**
 * A single row in the XLSX output.
 * Header rows have all columns filled; step (continuation) rows have only
 * Action / Data / Expected Results – the rest are null.
 */
export interface TestCaseRow {
  'S.no': number | null;
  Component: string | null;
  Priority: string | null;
  'Test Type': string | null;
  'Test Case ID': string | null;
  DataSet: string | null;
  'Test Case Name': string | null;
  'Test Case Description': string | null;
  Action: string;
  Data: string | null;
  'Expected Results': string | null;
}

export interface GeneratorOptions {
  /** Root folder that contains the Angular *-base.config.ts files */
  inputDir: string;
  /** Directory where the generated .xlsx test-case files are stored */
  outputDir?: string;
  /** Directory where generated page-object .ts files are written (used by ElementIdExtractor) */
  pageObjectOutputDir?: string;
  /** Full file path for the output .xlsx workbook (overrides outputDir) */
  outputXlsx?: string;
}

interface FieldMeta {
  name: string;
  label: string;
  uiType: string;
  isMandatory: boolean;
  isEnabled: boolean;
  hasEditAccess: boolean;
  hasViewAccess: boolean;
  placeholder: string;
  validations: Record<string, unknown>;
  allowedValues: { label: string; value: string }[];
  defaultValue: unknown;
}

interface PageMeta {
  pageType: 'detail' | 'list' | 'other';
  pageTitle: string;
  entityName: string;
  fields: FieldMeta[];
  buttons: { label: string; elementId: string; action?: string }[];
  columns: { label: string; field: string; elementId: string; uiType: string }[];
  sections: { label: string; elementId: string }[];
  hasQuickFilter: boolean;
  hasSearch: boolean;
  hasTable: boolean;
  configFilePath: string;
}

interface TCGenContext {
  rows: TestCaseRow[];
  component: string;
  idPrefix: string;
  tcNum: number;
  listPage?: PageMeta;
  detailPage?: PageMeta;
}

// ── UI‑type → action mapping ───────────────────────────────────────

const UI_TYPE_ACTION_MAP: Record<string, { action: string; sampleData: string }> = {
  STRING: { action: 'Enter', sampleData: 'Test String Value' },
  TEXT: { action: 'Enter', sampleData: 'Sample text content' },
  NUMBER: { action: 'Enter', sampleData: '42' },
  DOUBLE: { action: 'Enter', sampleData: '25.50' },
  CURRENCY: { action: 'Enter', sampleData: '100.00' },
  EMAIL: { action: 'Enter', sampleData: 'test@example.com' },
  URL: { action: 'Enter', sampleData: 'https://example.com' },
  DATE: { action: 'Enter', sampleData: '15/03/2026' },
  DATE_TIME: { action: 'Enter', sampleData: '15/Mar/26 10:30 AM' },
  DATE_RANGE: { action: 'Enter', sampleData: '01/01/2026 - 31/12/2026' },
  DATE_TIME_RANGE: { action: 'Enter', sampleData: '01/Jan/26 09:00 AM - 31/Dec/26 05:00 PM' },
  DROPDOWN: { action: 'Select', sampleData: '' },
  BOOLEAN: { action: 'Check', sampleData: '' },
  YES_NO: { action: 'Select', sampleData: 'Yes' },
  RADIO_BUTTON: { action: 'Click', sampleData: '' },
  AUTO_NUMBER: { action: '', sampleData: '' }, // read-only
  COLOR: { action: 'Enter', sampleData: '#FF5733' },
  FILE_ATTACHMENT: { action: 'Upload', sampleData: 'test-file.pdf' },
  IMAGE_CAROUSEL: { action: 'Upload', sampleData: 'test-image.png' },
};

/**
 * Generates test case workbooks (XLSX) from Angular *-base.config.ts files.
 *
 * Pipeline:
 * 1. Run {@link ElementIdExtractor} to produce page-object maps.
 * 2. Parse every *-base.config.ts to extract field metadata, buttons,
 *    sections, columns, and page type (list vs detail).
 * 3. Group pages by entity (list + detail on the same sheet).
 * 4. Generate multi-step, scenario-based test cases following the
 *    TestCaseFormat-Guidelines-Sample.xlsx format.
 * 5. Write an XLSX workbook with one sheet per entity.
 *
 * Usage:
 * ```ts
 * const gen = new TestCaseGenerator();
 * gen.generate({
 *   inputDir: '/path/to/generated',
 *   outputXlsx: './test-cases.xlsx',
 * });
 * ```
 */
export class TestCaseGenerator {
  private extractor = new ElementIdExtractor();

  /**
   * Main entry point – extracts page objects then generates the XLSX test plan.
   */
  generate(options: GeneratorOptions): string {
    const {
      inputDir,
      outputDir,
      pageObjectOutputDir = outputDir
        ? path.join(path.dirname(outputDir), 'page-objects')
        : path.join(inputDir, '..', 'page-objects', 'generated-objects'),
      outputXlsx = outputDir
        ? path.join(outputDir, 'generated-test-cases.xlsx')
        : path.join(inputDir, '..', 'test-cases', 'generated-test-cases.xlsx'),
    } = options;

    // Step 1 — generate page-object maps
    logger.info('[TestCaseGenerator] Step 1: Extracting page objects …');
    const extractionResults = this.extractor.extractFromDirectory(inputDir, pageObjectOutputDir);

    if (extractionResults.length === 0) {
      logger.warn('[TestCaseGenerator] No base config files found. Nothing to generate.');
      return '';
    }

    // Step 2 — parse all config files for rich metadata
    logger.info('[TestCaseGenerator] Step 2: Parsing config files for metadata …');
    const pages = this.parseAllConfigs(extractionResults);

    // Step 3 — group pages by entity (list + detail together on one sheet)
    logger.info('[TestCaseGenerator] Step 3: Grouping pages by entity …');
    const entityGroups = this.groupByEntity(pages);

    // Step 4 — generate test cases per entity group
    logger.info('[TestCaseGenerator] Step 4: Generating test cases …');
    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const [entity, group] of entityGroups) {
      const rows = this.generateEntityTestCases(entity, group);
      if (rows.length === 0) continue;

      let sheetName = this.sanitiseSheetName(this.toTitleCase(entity));
      if (usedSheetNames.has(sheetName)) {
        let suffix = 2;
        while (usedSheetNames.has(`${sheetName.substring(0, 28)}_${suffix}`)) suffix++;
        sheetName = `${sheetName.substring(0, 28)}_${suffix}`;
      }
      usedSheetNames.add(sheetName);

      const ws = XLSX.utils.json_to_sheet(rows);
      this.autoFitColumns(ws, rows);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    }

    // Step 5 — write workbook
    const xlsxDir = path.dirname(outputXlsx);
    if (!fs.existsSync(xlsxDir)) {
      fs.mkdirSync(xlsxDir, { recursive: true });
    }
    XLSX.writeFile(workbook, outputXlsx);
    logger.info(`[TestCaseGenerator] Test cases written to ${outputXlsx}`);

    return outputXlsx;
  }

  // ── Entity grouping ────────────────────────────────────────────

  private groupByEntity(pages: PageMeta[]): Map<string, { list?: PageMeta; detail?: PageMeta; others: PageMeta[] }> {
    const map = new Map<string, { list?: PageMeta; detail?: PageMeta; others: PageMeta[] }>();

    for (const page of pages) {
      const entity = page.entityName;
      if (!map.has(entity)) map.set(entity, { others: [] });
      const group = map.get(entity)!;

      if (page.pageType === 'list' && !group.list) {
        group.list = page;
      } else if (page.pageType === 'detail' && !group.detail) {
        group.detail = page;
      } else {
        group.others.push(page);
      }
    }

    return map;
  }

  // ── Test case generation per entity ────────────────────────────

  private generateEntityTestCases(
    entity: string,
    group: { list?: PageMeta; detail?: PageMeta; others: PageMeta[] }
  ): TestCaseRow[] {
    const ctx: TCGenContext = {
      rows: [],
      component: this.toTitleCase(entity),
      idPrefix: entity.toUpperCase(),
      tcNum: 0,
      listPage: group.list,
      detailPage: group.detail,
    };

    // List page test cases
    this.tcVerifyListPageLoads(ctx);
    this.tcVerifyListPageActionButtons(ctx);
    this.tcVerifyQuickFilter(ctx);

    // List → Detail navigation
    this.tcClickNewNavigateToDetail(ctx);

    // Detail page test cases
    this.tcCreateNewRecord(ctx);
    this.tcVerifyDetailFieldVisibility(ctx);
    this.tcMandatoryFieldValidation(ctx);
    this.tcBoundaryValidation(ctx);
    this.tcReadOnlyFieldVerification(ctx);
    this.tcDropdownOptionsVerification(ctx);
    this.tcCancelBackNavigation(ctx);

    // List page record operations
    this.tcOpenExistingRecord(ctx);
    this.tcDeleteRecord(ctx);
    this.tcRefresh(ctx);

    // Other pages
    this.tcOtherPages(ctx, group.others);

    return ctx.rows;
  }

  // ── Extracted TC generators ────────────────────────────────────

  /** Navigate to list page and verify columns / data table */
  private tcVerifyListPageLoads(ctx: TCGenContext): void {
    const { listPage } = ctx;
    if (!listPage) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} list page loads`,
      `Verify the user is able to navigate to the ${ctx.component} list page and all UI elements render correctly`
    );
    this.addStepRow(
      ctx.rows,
      `Verify the '${listPage.pageTitle}' page is displayed`,
      null,
      `${listPage.pageTitle} page loads successfully with correct layout`
    );
    if (listPage.hasTable) {
      this.addStepRow(
        ctx.rows,
        `Verify the data table is displayed on the '${listPage.pageTitle}' page`,
        null,
        'Data table is displayed with column headers and data'
      );
    }
    for (const col of listPage.columns) {
      this.addStepRow(
        ctx.rows,
        `Verify the '${col.label}' column is displayed in the data table`,
        null,
        `'${col.label}' column header is visible`
      );
    }
  }

  /** Verify all action buttons on the list page */
  private tcVerifyListPageActionButtons(ctx: TCGenContext): void {
    const { listPage } = ctx;
    if (!listPage) return;

    const actionButtons = listPage.buttons.filter((b) => b.label && b.label.trim());
    if (actionButtons.length === 0) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} list page action buttons`,
      `Verify all action buttons are displayed and functional on the ${ctx.component} list page`
    );
    for (const btn of actionButtons) {
      this.addStepRow(
        ctx.rows,
        `Verify the '${btn.label}' button is displayed`,
        null,
        `'${btn.label}' button is visible and accessible`
      );
    }
  }

  /** Test the quick filter functionality on the list page */
  private tcVerifyQuickFilter(ctx: TCGenContext): void {
    const { listPage } = ctx;
    if (!listPage?.hasQuickFilter || listPage.fields.length === 0) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} list quick filter`,
      `Verify the quick filter functionality works correctly on the ${ctx.component} list page`
    );
    this.addStepRow(ctx.rows, `Assert 'Quick Filter'`, null, 'should be visible');
    for (const field of listPage.fields.slice(0, 3)) {
      const actionInfo = UI_TYPE_ACTION_MAP[field.uiType] || { action: 'Enter', sampleData: 'Test' };
      if (!actionInfo.action) continue;
      const data = actionInfo.sampleData || (field.allowedValues[0]?.label ?? 'Test Value');
      this.addStepRow(
        ctx.rows,
        `${actionInfo.action} '${field.label}'`,
        data,
        `'${field.label}' filter is applied successfully`
      );
    }
    this.addStepRow(ctx.rows, `Assert 'Data Table'`, null, 'should be visible');
  }

  /** Click New button and navigate to the detail page */
  private tcClickNewNavigateToDetail(ctx: TCGenContext): void {
    const { listPage, detailPage } = ctx;
    if (!listPage || !detailPage) return;

    const newBtn = listPage.buttons.find((b) => /new/i.test(b.label) || /onNew/.test(b.action || ''));
    if (!newBtn) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Major',
      `Open a new ${ctx.component} creation page`,
      `Verify the user can navigate from the list page to the ${ctx.component} detail creation page`
    );
    this.addStepRow(
      ctx.rows,
      `Click on the '${newBtn.label || 'New'}' button from ${listPage.pageTitle}`,
      null,
      `'${detailPage.pageTitle}' page is opened`
    );
    this.addStepRow(
      ctx.rows,
      `Verify the '${detailPage.pageTitle}' page is displayed`,
      null,
      `${detailPage.pageTitle} page loads successfully with all fields visible`
    );
  }

  /** Fill all editable fields and save a new record */
  private tcCreateNewRecord(ctx: TCGenContext): void {
    const { detailPage, listPage } = ctx;
    if (!detailPage) return;

    const editableFields = detailPage.fields.filter((f) => f.hasEditAccess && f.isEnabled);
    if (editableFields.length === 0) return;

    ctx.tcNum++;
    const saveBtn = detailPage.buttons.find((b) => /save/i.test(b.label || b.action || ''));
    this.addDetailPageHeader(
      ctx,
      'Major',
      `Create a new ${ctx.component} record`,
      `Verify the user is able to fill all fields and create a new ${ctx.component} record`
    );
    this.addClickNewStepIfNeeded(ctx);

    this.addStepRow(
      ctx.rows,
      `Verify the '${detailPage.pageTitle}' page is displayed`,
      null,
      `${detailPage.pageTitle} page loads successfully with all fields visible`
    );

    for (const field of editableFields) {
      const actionInfo = UI_TYPE_ACTION_MAP[field.uiType];
      if (!actionInfo?.action) continue;

      const step = this.buildFieldActionStep(field);
      this.addStepRow(ctx.rows, step.action, step.data, step.expected);
    }

    if (saveBtn) {
      this.addStepRow(
        ctx.rows,
        `Click on the '${saveBtn.label || 'Save'}' button`,
        null,
        `${ctx.component} record is saved and confirmation message is shown`
      );
    }
  }

  /** Verify all fields / sections are visible on the detail page */
  private tcVerifyDetailFieldVisibility(ctx: TCGenContext): void {
    const { detailPage } = ctx;
    if (!detailPage) return;

    const viewableFields = detailPage.fields.filter((f) => f.hasViewAccess);
    if (viewableFields.length === 0) return;

    ctx.tcNum++;
    this.addDetailPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} detail page fields are visible`,
      `Verify all fields are displayed correctly on the ${ctx.component} detail page`
    );
    this.addClickNewStepIfNeeded(ctx);

    for (const section of detailPage.sections) {
      this.addStepRow(
        ctx.rows,
        `Verify the '${section.label}' section is displayed`,
        null,
        `'${section.label}' section is visible`
      );
    }
    for (const field of viewableFields) {
      this.addStepRow(
        ctx.rows,
        `Verify the '${field.label}' field is displayed on the form`,
        null,
        `'${field.label}' field is visible with correct label`
      );
    }
  }

  /** Verify validation errors when saving without mandatory fields */
  private tcMandatoryFieldValidation(ctx: TCGenContext): void {
    const { detailPage } = ctx;
    if (!detailPage) return;

    const mandatoryFields = detailPage.fields.filter((f) => f.isMandatory && f.hasEditAccess);
    if (mandatoryFields.length === 0) return;

    ctx.tcNum++;
    const saveBtn = detailPage.buttons.find((b) => /save/i.test(b.label || b.action || ''));
    this.addDetailPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} mandatory field validation`,
      `Verify saving without filling mandatory fields triggers validation errors`
    );
    this.addClickNewStepIfNeeded(ctx);

    if (saveBtn) {
      this.addStepRow(
        ctx.rows,
        `Click on the '${saveBtn.label || 'Save'}' button without filling mandatory fields`,
        null,
        'Validation error messages should be displayed for mandatory fields'
      );
    }
    for (const field of mandatoryFields) {
      this.addStepRow(
        ctx.rows,
        `Verify the validation error for '${field.label}' is displayed`,
        null,
        `Validation message is shown for mandatory field '${field.label}'`
      );
    }
  }

  /** Verify min/max and regex validations on fields */
  private tcBoundaryValidation(ctx: TCGenContext): void {
    const { detailPage } = ctx;
    if (!detailPage) return;

    const fieldsWithBoundary = detailPage.fields.filter(
      (f) => f.hasEditAccess && (f.validations['minValue'] !== undefined || f.validations['regexPattern'])
    );
    if (fieldsWithBoundary.length === 0) return;

    ctx.tcNum++;
    this.addDetailPageHeader(
      ctx,
      'Minor',
      `Verify ${ctx.component} field boundary validations`,
      `Verify field-level validations for min/max values and patterns on the ${ctx.component} detail page`
    );
    this.addClickNewStepIfNeeded(ctx);

    for (const field of fieldsWithBoundary) {
      const v = field.validations;
      if (v['minValue'] !== undefined && v['maxValue'] !== undefined) {
        this.addStepRow(
          ctx.rows,
          `Enter the value in field name '${field.label}'`,
          String(Number(v['minValue']) - 1),
          `Validation error should be displayed for value below minimum (${v['minValue']})`
        );
        this.addStepRow(
          ctx.rows,
          `Enter the value in field name '${field.label}'`,
          String(Number(v['maxValue']) + 1),
          `Validation error should be displayed for value above maximum (${v['maxValue']})`
        );
      }
      if (v['regexPattern']) {
        this.addStepRow(
          ctx.rows,
          `Enter the value in field name '${field.label}'`,
          'invalid!@#',
          'Validation error should be displayed for invalid pattern'
        );
      }
    }
  }

  /** Verify read-only fields reject input */
  private tcReadOnlyFieldVerification(ctx: TCGenContext): void {
    const { detailPage } = ctx;
    if (!detailPage) return;

    const readOnlyFields = detailPage.fields.filter(
      (f) => !f.hasEditAccess && f.hasViewAccess && f.uiType !== 'AUTO_NUMBER'
    );
    if (readOnlyFields.length === 0) return;

    ctx.tcNum++;
    this.addDetailPageHeader(
      ctx,
      'Minor',
      `Verify ${ctx.component} read-only fields`,
      `Verify that read-only fields cannot be edited on the ${ctx.component} detail page`
    );
    this.addClickNewStepIfNeeded(ctx);

    for (const field of readOnlyFields) {
      this.addStepRow(
        ctx.rows,
        `Enter the value in field name '${field.label}'`,
        'test',
        `Field should not be entered — '${field.label}' is read-only`
      );
    }
  }

  /** Verify dropdown fields contain expected option values */
  private tcDropdownOptionsVerification(ctx: TCGenContext): void {
    const { detailPage } = ctx;
    if (!detailPage) return;

    const dropdownFields = detailPage.fields.filter((f) => f.uiType === 'DROPDOWN' && f.allowedValues.length > 0);
    if (dropdownFields.length === 0) return;

    ctx.tcNum++;
    this.addDetailPageHeader(
      ctx,
      'Minor',
      `Verify ${ctx.component} dropdown options`,
      `Verify all dropdown fields contain the correct option values on the ${ctx.component} detail page`
    );
    this.addClickNewStepIfNeeded(ctx);

    for (const field of dropdownFields) {
      for (const opt of field.allowedValues) {
        this.addStepRow(
          ctx.rows,
          `Select the required value from '${field.label}'`,
          opt.label,
          `Selected '${opt.label}' is reflected in the '${field.label}' field`
        );
      }
    }
  }

  /** Verify Cancel / Back buttons navigate away from detail page */
  private tcCancelBackNavigation(ctx: TCGenContext): void {
    const { detailPage, listPage } = ctx;
    if (!detailPage) return;

    const cancelBtn = detailPage.buttons.find((b) => /cancel/i.test(b.label || b.action || ''));
    const backBtn = detailPage.buttons.find((b) => /back/i.test(b.label || b.action || ''));
    if (!cancelBtn && !backBtn) return;

    ctx.tcNum++;
    this.addDetailPageHeader(
      ctx,
      'Major',
      `Verify ${ctx.component} cancel and back navigation`,
      `Verify the Cancel and Back buttons navigate correctly from the ${ctx.component} detail page`
    );
    this.addClickNewStepIfNeeded(ctx);

    if (cancelBtn) {
      this.addStepRow(
        ctx.rows,
        `Click on the '${cancelBtn.label || 'Cancel'}' button`,
        null,
        'Changes should be discarded and user is navigated back'
      );
    }
    if (backBtn) {
      this.addStepRow(
        ctx.rows,
        `Click on the 'Back' button`,
        null,
        `User is navigated back to the ${listPage ? listPage.pageTitle : 'previous'} page`
      );
    }
  }

  /** Open an existing record from the list via double click */
  private tcOpenExistingRecord(ctx: TCGenContext): void {
    const { listPage, detailPage } = ctx;
    if (!listPage || !detailPage) return;

    ctx.tcNum++;
    const firstCol = listPage.columns[0];
    this.addListPageHeader(
      ctx,
      'Major',
      `Open an existing ${ctx.component} record`,
      `Verify the user can open an existing ${ctx.component} record from the list`
    );
    this.addStepRow(
      ctx.rows,
      `Verify the data table is displayed on the '${listPage.pageTitle}' page`,
      null,
      'Data table is displayed with records'
    );
    this.addStepRow(
      ctx.rows,
      `Double click on the '${firstCol?.label || 'Record'}' in the data table`,
      null,
      'The detailed view page for the selected record opens'
    );
    this.addStepRow(
      ctx.rows,
      `Verify the '${detailPage.pageTitle}' page is displayed`,
      null,
      `${detailPage.pageTitle} page loads successfully with all the record information visible`
    );
    if (firstCol) {
      this.addStepRow(
        ctx.rows,
        `The opened record and displayed record should have same '${firstCol.label}' displayed`,
        null,
        `'${firstCol.label}' in the detail page matches the selected record from the list`
      );
    }
  }

  /** Delete a record from the list page */
  private tcDeleteRecord(ctx: TCGenContext): void {
    const { listPage } = ctx;
    if (!listPage) return;

    const deleteBtn = listPage.buttons.find((b) => /delete/i.test(b.label) || /onDelete/.test(b.action || ''));
    if (!deleteBtn) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Major',
      `Delete an existing ${ctx.component} record`,
      `Verify the user is able to delete a ${ctx.component} record from the list`
    );
    this.addStepRow(ctx.rows, `Select a record from the data table`, null, 'Record is selected / highlighted');
    this.addStepRow(
      ctx.rows,
      `Click on the '${deleteBtn.label || 'Delete'}' button`,
      null,
      'Confirmation dialog is displayed'
    );
    this.addStepRow(
      ctx.rows,
      `Click on 'Yes' in the confirmation dialog`,
      null,
      `${ctx.component} record is deleted and removed from the data table`
    );
  }

  /** Verify the Refresh button on the list page */
  private tcRefresh(ctx: TCGenContext): void {
    const { listPage } = ctx;
    if (!listPage) return;

    const refreshBtn = listPage.buttons.find((b) => /refresh/i.test(b.label || b.action || ''));
    if (!refreshBtn) return;

    ctx.tcNum++;
    this.addListPageHeader(
      ctx,
      'Minor',
      `Verify ${ctx.component} list refresh`,
      `Verify the Refresh button reloads the data table on the ${ctx.component} list page`
    );
    this.addStepRow(
      ctx.rows,
      `Click on the 'Refresh' button`,
      null,
      'Data table is refreshed and latest records are displayed'
    );
  }

  /** Generate test cases for pages that are neither list nor detail */
  private tcOtherPages(ctx: TCGenContext, others: PageMeta[]): void {
    for (const other of others) {
      ctx.tcNum++;
      this.addHeaderRow(
        ctx.rows,
        ctx.tcNum,
        ctx.component,
        'Major',
        'Manual / Automation',
        this.toTestCaseId(ctx),
        null,
        `Verify ${other.pageTitle} page loads`,
        `Verify the user is able to navigate to the ${other.pageTitle} page`,
        `Goto the application ${this.toPageRoute(other.pageTitle)} page`,
        null,
        `${other.pageTitle} page should be displayed`
      );
      this.addStepRow(
        ctx.rows,
        `Verify the '${other.pageTitle}' page is displayed`,
        null,
        `${other.pageTitle} page loads successfully`
      );
      for (const btn of other.buttons.filter((b) => b.label?.trim())) {
        this.addStepRow(
          ctx.rows,
          `Verify the '${btn.label}' button is displayed`,
          null,
          `'${btn.label}' button is visible`
        );
      }
    }
  }

  // ── Shared TC helpers ──────────────────────────────────────────

  /** Convert page title to route-style string: "Sample List" → "SAMPLE_LIST" */
  private toPageRoute(pageTitle: string): string {
    return pageTitle.toUpperCase().replace(/\s+/g, '_');
  }

  /** Build the test case ID for the current counter:  "SAMPLE-001" */
  private toTestCaseId(ctx: TCGenContext): string {
    return `${ctx.idPrefix}-${String(ctx.tcNum).padStart(3, '0')}`;
  }

  /** Adds a header row for a list-page TC with Goto navigation. */
  private addListPageHeader(ctx: TCGenContext, priority: string, name: string, description: string): void {
    const { listPage } = ctx;
    if (!listPage) return;

    this.addHeaderRow(
      ctx.rows,
      ctx.tcNum,
      ctx.component,
      priority,
      'Manual / Automation',
      this.toTestCaseId(ctx),
      null,
      name,
      description,
      `Goto the application ${this.toPageRoute(listPage.pageTitle)} page`,
      null,
      `${listPage.pageTitle} page should be displayed`
    );
  }

  /**
   * Adds a header row for a detail-page TC. When a list page is available,
   * navigates there first; otherwise navigates directly to the detail page.
   */
  private addDetailPageHeader(ctx: TCGenContext, priority: string, name: string, description: string): void {
    const targetPage = ctx.listPage || ctx.detailPage!;

    this.addHeaderRow(
      ctx.rows,
      ctx.tcNum,
      ctx.component,
      priority,
      'Manual / Automation',
      this.toTestCaseId(ctx),
      null,
      name,
      description,
      `Goto the application ${this.toPageRoute(targetPage.pageTitle)} page`,
      null,
      `${targetPage.pageTitle} page should be displayed`
    );
  }

  /**
   * If a list page exists and has a "New" button, adds the click-New step
   * that many detail-page TCs use as their preamble.
   */
  private addClickNewStepIfNeeded(ctx: TCGenContext): void {
    const { listPage, detailPage } = ctx;
    if (!listPage || !detailPage) return;

    const newBtn = listPage.buttons.find((b) => /new/i.test(b.label) || /onNew/.test(b.action || ''));
    if (!newBtn) return;

    this.addStepRow(
      ctx.rows,
      `Click on the '${newBtn.label || 'New'}' button from ${listPage.pageTitle}`,
      null,
      `'${detailPage.pageTitle}' page is opened`
    );
  }

  /** Build an action step row for a field based on its UI type */
  private buildFieldActionStep(field: FieldMeta): { action: string; data: string | null; expected: string } {
    const actionInfo = UI_TYPE_ACTION_MAP[field.uiType] || { action: 'Enter', sampleData: 'Test Value' };

    let data: string | null = actionInfo.sampleData || null;
    if (field.uiType === 'DROPDOWN' && field.allowedValues.length > 0) {
      data = field.allowedValues[0].label;
    }

    const ACTION_VERB: Record<string, string> = {
      Select: 'Select the required value from',
      Check: 'Check the',
      Upload: 'Upload the file for',
      Click: 'Click on the',
    };
    const EXPECTED_VERB: Record<string, string> = {
      Select: `Selected value is reflected in the '${field.label}' field`,
      Check: `'${field.label}' checkbox is toggled`,
      Upload: `File is attached to '${field.label}' field`,
    };

    const actionVerb = ACTION_VERB[actionInfo.action] || 'Enter the value in field name';
    const expected = EXPECTED_VERB[actionInfo.action] || `Value is entered into '${field.label}' field`;

    return { action: `${actionVerb} '${field.label}'`, data, expected };
  }

  // ── Row helpers (multi-row format) ─────────────────────────────

  private addHeaderRow(
    rows: TestCaseRow[],
    sno: number,
    component: string,
    priority: string,
    testType: string,
    testCaseId: string,
    dataSet: string | null,
    name: string,
    description: string,
    action: string,
    data: string | null,
    expected: string | null
  ): void {
    rows.push({
      'S.no': sno,
      Component: component,
      Priority: priority,
      'Test Type': testType,
      'Test Case ID': testCaseId,
      DataSet: dataSet,
      'Test Case Name': name,
      'Test Case Description': description,
      Action: action,
      Data: data,
      'Expected Results': expected,
    });
  }

  private addStepRow(rows: TestCaseRow[], action: string, data: string | null, expected: string | null): void {
    rows.push({
      'S.no': null,
      Component: null,
      Priority: null,
      'Test Type': null,
      'Test Case ID': null,
      DataSet: null,
      'Test Case Name': null,
      'Test Case Description': null,
      Action: action,
      Data: data,
      'Expected Results': expected,
    });
  }

  // ── Config parsing ─────────────────────────────────────────────

  private parseAllConfigs(results: ExtractionResult[]): PageMeta[] {
    const pages: PageMeta[] = [];

    for (const result of results) {
      const content = fs.readFileSync(result.sourceFile, 'utf-8');
      const page = this.parseConfigContent(content, result);
      pages.push(page);
    }

    return pages;
  }

  private parseConfigContent(content: string, result: ExtractionResult): PageMeta {
    const filePath = result.sourceFile;
    const fileName = path.basename(filePath);
    const pageType = this.inferPageType(fileName, content);
    const entityName = this.inferEntityName(filePath);
    const pageTitle = this.extractPageTitle(content) || result.exportName.replace(/_/g, ' ');
    const dir = path.dirname(filePath);

    // Resolve field config for rich field metadata
    const fieldConfigPath = this.resolveFieldConfigImport(content, dir);
    const fields = fieldConfigPath ? this.parseFieldMetadata(fieldConfigPath) : [];

    // Inline form fields (detail pages may redefine fields)
    const inlineFields = this.parseInlineFormFields(content, fields);

    // Buttons
    const buttons = this.parseButtons(content);

    // Columns (list pages)
    const columns = this.parseColumns(content);

    // Sections
    const sections = this.parseSections(content);

    const hasQuickFilter = /quickFilter/i.test(content);
    const hasSearch = /searchBar/i.test(content);
    const hasTable = /tableConfig|TableProps/i.test(content);

    // Cross-reference with page object entries — only keep labels that exist
    // in the generated page object so the framework can resolve them.
    const pageObjectLabels = new Set(Object.keys(result.entries));
    const rawFields = inlineFields.length > 0 ? inlineFields : fields;
    const filteredFields = rawFields.filter((f) => pageObjectLabels.has(f.label));

    return {
      pageType,
      pageTitle,
      entityName,
      fields: filteredFields,
      buttons,
      columns,
      sections,
      hasQuickFilter,
      hasSearch,
      hasTable,
      configFilePath: filePath,
    };
  }

  // ── Field metadata ─────────────────────────────────────────────

  private resolveFieldConfigImport(content: string, baseDir: string): string | null {
    const m = content.match(/import\s*\{[^}]*fieldConfig[^}]*\}\s*from\s*['"`]([^'"`]+)['"`]/);
    if (!m) return null;
    let importPath = m[1];
    if (!importPath.endsWith('.ts')) importPath += '.ts';
    // Handle relative import starting with ../.. etc
    const resolved = path.resolve(baseDir, importPath);
    return fs.existsSync(resolved) ? resolved : null;
  }

  private parseFieldMetadata(filePath: string): FieldMeta[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fields: FieldMeta[] = [];
    const seen = new Set<string>();

    // Match fields wrapped with applyOverride()
    const blockRe = /(\w+)\s*:\s*applyOverride\s*\(\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = blockRe.exec(content)) !== null) {
      const block = this.findBlock(content, m.index + m[0].length - 1);
      const field = this.extractFieldMeta(m[1], block);
      fields.push(field);
      seen.add(m[1]);
    }

    // Match plain object fields (e.g. quick filter / list fields without applyOverride)
    const plainRe = /(\w+)\s*:\s*\{[^}]*type\s*:\s*COMPONENT_TYPES\.FIELD/g;
    while ((m = plainRe.exec(content)) !== null) {
      if (seen.has(m[1])) continue;
      const block = this.findBlock(content, content.indexOf('{', m.index + m[1].length));
      const field = this.extractFieldMeta(m[1], block);
      fields.push(field);
      seen.add(m[1]);
    }

    return fields;
  }

  private extractFieldMeta(key: string, block: string): FieldMeta {
    const getString = (prop: string): string => {
      const re = new RegExp(`${prop}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
      const m = block.match(re);
      return m ? m[1] : '';
    };

    const uiType = this.extractEnumValue(block, 'uiType', 'UI_TYPES');
    const isMandatory = /mandatory[\s\S]*?value\s*:\s*['"`]yes['"`]/i.test(block);
    const isEnabled = !/isEnabled\s*:\s*false/.test(block);
    const hasEditAccess = /edit[\s\S]*?value\s*:\s*['"`]yes['"`]/i.test(block);
    const hasViewAccess = /view[\s\S]*?value\s*:\s*['"`]yes['"`]/i.test(block);

    // Extract allowed values for dropdowns
    const allowedValues: { label: string; value: string }[] = [];
    const avMatch = block.match(/allowedValues\s*:\s*\{[\s\S]*?values\s*:\s*\[([\s\S]*?)\]/);
    if (avMatch) {
      const entriesRe = /\{\s*label\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*value\s*:\s*['"`]([^'"`]+)['"`]\s*\}/g;
      let em: RegExpExecArray | null;
      while ((em = entriesRe.exec(avMatch[1])) !== null) {
        allowedValues.push({ label: em[1], value: em[2] });
      }
    }

    // Extract validations
    const validations: Record<string, unknown> = {};
    const maxVal = block.match(/maxValue\s*:\s*(\d+)/);
    const minVal = block.match(/minValue\s*:\s*(\d+)/);
    const regex = block.match(/regexPattern\s*:\s*(?:String\.raw`|['"`])([^'"`]+)['"``]/);
    if (maxVal) validations['maxValue'] = Number(maxVal[1]);
    if (minVal) validations['minValue'] = Number(minVal[1]);
    if (regex) validations['regexPattern'] = regex[1];
    if (isMandatory) validations['mandatory'] = true;

    return {
      name: getString('name') || key,
      label: getString('label') || key,
      uiType,
      isMandatory,
      isEnabled,
      hasEditAccess,
      hasViewAccess,
      placeholder: getString('placeholder'),
      validations,
      allowedValues,
      defaultValue: this.extractDefault(block),
    };
  }

  private parseInlineFormFields(content: string, fieldConfigFields: FieldMeta[]): FieldMeta[] {
    // Detail pages define formFieldConfig with spread from fieldConfig
    const formFieldMatch = content.match(/export const formFieldConfig[\s\S]*?=\s*\{([\s\S]*?)\};\s*\n/);
    if (!formFieldMatch) return [];

    const fieldMap = new Map(fieldConfigFields.map((f) => [f.name, f]));
    const inlineFields: FieldMeta[] = [];
    const entryRe = /(\w+)\s*:\s*\{[\s\S]*?\.\.\.fieldConfig\[['"`](\w+)['"`]\]/g;
    let m: RegExpExecArray | null;

    while ((m = entryRe.exec(content)) !== null) {
      const fieldName = m[2];
      const existing = fieldMap.get(fieldName);
      if (existing) {
        inlineFields.push({ ...existing });
      }
    }

    return inlineFields;
  }

  // ── Button parsing ─────────────────────────────────────────────

  private parseButtons(content: string): { label: string; elementId: string; action?: string }[] {
    const buttons: { label: string; elementId: string; action?: string }[] = [];
    const blockRe = /(\w+Button\w*|\w+button\w*)\s*:\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = blockRe.exec(content)) !== null) {
      const block = this.findBlock(content, m.index + m[0].length - 1);
      const label = this.getPropStr(block, 'label');
      const elementId = this.getPropStr(block, 'elementId');
      const actionMatch = block.match(/targetActionName\s*:\s*['"`]([^'"`]+)['"`]/);
      if (elementId) {
        buttons.push({ label: label || m[1], elementId, action: actionMatch?.[1] });
      }
    }

    return buttons;
  }

  // ── Column parsing (list pages) ────────────────────────────────

  private parseColumns(content: string): { label: string; field: string; elementId: string; uiType: string }[] {
    const columns: { label: string; field: string; elementId: string; uiType: string }[] = [];
    const colSection = content.match(/columnConfig[\s\S]*?=\s*\{([\s\S]*?)\};\s*\n/);
    if (!colSection) return columns;

    const entryRe =
      /(\w+)\s*:\s*\{[^}]*elementId\s*:\s*['"`]([^'"`]+)['"`][^}]*label\s*:\s*['"`]([^'"`]+)['"`][^}]*field\s*:\s*['"`]([^'"`]+)['"`][^}]*uiType\s*:\s*UI_TYPES\.(\w+)/g;
    let m: RegExpExecArray | null;

    while ((m = entryRe.exec(content)) !== null) {
      columns.push({ elementId: m[2], label: m[3], field: m[4], uiType: m[5] });
    }

    // Fallback: parse columns individually
    if (columns.length === 0) {
      const colRe = /elementId\s*:\s*['"`](column_\w+)['"`]/g;
      while ((m = colRe.exec(content)) !== null) {
        const block = this.findBlock(content, m.index);
        columns.push({
          elementId: m[1],
          label: this.getPropStr(block, 'label') || m[1],
          field: this.getPropStr(block, 'field') || '',
          uiType: this.extractEnumValue(block, 'uiType', 'UI_TYPES'),
        });
      }
    }

    return columns;
  }

  // ── Section parsing ────────────────────────────────────────────

  private parseSections(content: string): { label: string; elementId: string }[] {
    const sections: { label: string; elementId: string }[] = [];
    const re = /elementId\s*:\s*['"`]([^'"`]*[Ss]ection[^'"`]*)['"`]/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(content)) !== null) {
      const block = this.findBlock(content, m.index);
      sections.push({ elementId: m[1], label: this.getPropStr(block, 'label') || m[1] });
    }

    return sections;
  }

  // ── Helpers ────────────────────────────────────────────────────

  private inferPageType(fileName: string, content: string): 'detail' | 'list' | 'other' {
    if (/list/i.test(fileName) || /TableProps|columnConfig/i.test(content)) return 'list';
    if (/detail/i.test(fileName) || /FormProps|formConfig/i.test(content)) return 'detail';
    return 'other';
  }

  private inferEntityName(filePath: string): string {
    // e.g. .../app-pages/sample/sample-detail/configuration/sample-detail-base.config.ts → sample
    const parts = filePath.split(path.sep);
    const appPagesIdx = parts.findIndex((p) => p === 'app-pages' || p === 'system-pages');
    if (appPagesIdx >= 0 && appPagesIdx + 1 < parts.length) {
      return parts[appPagesIdx + 1];
    }
    // Fallback: derive from filename
    const base = path.basename(filePath);
    return base.replace(/-(?:detail|list)-base\.config\.ts$/, '').replace(/-base\.config\.ts$/, '');
  }

  private extractPageTitle(content: string): string {
    const m = content.match(/pageTitle\s*:\s*['"`]([^'"`]+)['"`]/);
    return m ? m[1] : '';
  }

  private toTitleCase(str: string): string {
    return str.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private sanitiseSheetName(name: string): string {
    // Excel sheet names: max 31 chars, no special chars []:*?/\
    return name.replace(/[[\]:*?/\\]/g, '_').substring(0, 31);
  }

  private extractEnumValue(block: string, prop: string, enumName: string): string {
    const re = new RegExp(`${prop}\\s*:\\s*${enumName}\\.(\\w+)`);
    const m = block.match(re);
    return m ? m[1] : '';
  }

  private extractDefault(block: string): unknown {
    const m = block.match(/defaultValue\s*:\s*(?:['"`]([^'"`]*)['"`]|(true|false|\d+))/);
    if (!m) return undefined;
    if (m[1] !== undefined) return m[1];
    if (m[2] === 'true') return true;
    if (m[2] === 'false') return false;
    return Number(m[2]);
  }

  private getPropStr(block: string, prop: string): string {
    const re = new RegExp(`${prop}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
    const m = block.match(re);
    return m ? m[1] : '';
  }

  private findBlock(content: string, openBracePos: number): string {
    let depth = 0;
    for (let i = openBracePos; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') {
        depth--;
        if (depth === 0) return content.substring(openBracePos, i + 1);
      }
    }
    return content.substring(openBracePos);
  }

  private autoFitColumns(ws: XLSX.WorkSheet, rows: TestCaseRow[]): void {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]) as (keyof TestCaseRow)[];
    ws['!cols'] = headers.map((h) => {
      const maxLen = Math.max(String(h).length, ...rows.map((r) => String(r[h] ?? '').length));
      return { wch: Math.min(maxLen + 2, 60) };
    });
  }
}

// ── CLI Entrypoint ─────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args[0];
  const outputDir = args[1];
  const pageObjectOutputDir = args[2];

  if (!inputDir) {
    console.log('');
    console.log('Usage:');
    console.log('  node TestCaseGenerator.js <source-dir> [output-dir] [page-object-dir]');
    console.log('');
    console.log('Arguments:');
    console.log('  source-dir       Root folder to scan recursively for *-base.config.ts files');
    console.log('  output-dir       Directory where the generated XLSX test-case file is stored');
    console.log('  page-object-dir  Directory where generated page-object .ts files are written');
    console.log('');
    process.exit(1);
  }

  const generator = new TestCaseGenerator();
  const outPath = generator.generate({
    inputDir,
    ...(outputDir ? { outputDir } : {}),
    ...(pageObjectOutputDir ? { pageObjectOutputDir } : {}),
  });

  if (outPath) {
    console.log(`\nTest cases generated successfully: ${outPath}`);
  } else {
    console.log('No test cases generated.');
  }
}
