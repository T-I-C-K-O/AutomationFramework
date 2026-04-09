/**
 * @fileoverview Excel Plan Report Generator
 *
 * Mirrors the Xray TestPlanReportGenerator pattern for Excel-based test plans.
 * Reads execution Excel sheets from the test plan directory and produces:
 *   - A combined Plan-level report (Plan → Executions → Test Cases)
 *   - Individual per-execution reports in an `executions/` subfolder
 *
 * Output Directory:
 *   testreports/excel/<PlanName>/<PlanName>_TestPlan_Report.(csv|html)
 *   testreports/excel/<PlanName>/executions/<ExecName>_Execution_Report.(csv|html)
 *
 * @since 1.0.14
 */

import * as fs from 'fs';
import * as path from 'path';
import { readExecutionSheet } from './resultUpdater';
import { logger } from '../helpers/logger';

/* ───────────────────────── Interfaces ───────────────────────── */

/** Summary statistics for a report. */
export interface ExcelReportSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  unknown: number;
}

/** A single test row inside an execution. */
export interface ExcelReportTestRow {
  executionName: string;
  testCaseId: string;
  testCaseName: string;
  status: string;
  comment: string;
}

/** Complete report data for a plan (or single execution). */
export interface ExcelReportData {
  planName: string;
  generatedAt: string;
  totalExecutions: number;
  summary: ExcelReportSummary;
  testRows: ExcelReportTestRow[];
}

/** Tabular row: [Execution, Test Case ID, Test Case Name, Status, Comment] */
type ReportRow = [string, string, string, string, string];

/* ───────────────────────── Helpers ───────────────────────── */

/** Normalize a status string. */
function normalizeStatus(status: string): string {
  const upper = (status || '').toUpperCase().trim();
  if (/PASS|PASSED/.test(upper)) return 'PASSED';
  if (/FAIL|FAILED/.test(upper)) return 'FAILED';
  if (/BLOCK|BLOCKED/.test(upper)) return 'BLOCKED';
  if (/TODO|NOT STARTED|PENDING|SKIPPED/.test(upper)) return 'TODO';
  return 'UNKNOWN';
}

/** Escape a CSV cell value. */
function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

/** Derive a friendly execution name from an xlsx filename. */
function deriveExecutionName(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[_-]/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

/** Find all .xlsx files (excluding temp ~$ files) recursively. */
function findExcelFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findExcelFiles(full));
    else if (entry.name.endsWith('.xlsx') && !entry.name.startsWith('~$')) files.push(full);
  }
  return files;
}

/* ───────────────────────── Build Report Data ───────────────────────── */

/**
 * Read all execution xlsx files from a test plan directory and build
 * a unified ExcelReportData (Plan → Executions → Test Cases).
 */
export function buildExcelPlanReportData(planDir: string): ExcelReportData {
  const planName = path.basename(planDir);
  const excelFiles = findExcelFiles(planDir);

  const testRows: ExcelReportTestRow[] = [];
  const summary: ExcelReportSummary = { total: 0, passed: 0, failed: 0, blocked: 0, unknown: 0 };

  for (const filePath of excelFiles) {
    const execName = deriveExecutionName(path.basename(filePath));
    const { rows } = readExecutionSheet(filePath);

    // Detect columns
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const resultCol = columns.find((c) => /result/i.test(c)) || null;
    const testIdCol = columns.find((c) => /test\s*case\s*id/i.test(c)) || columns[0] || null;
    const nameCol =
      columns.find((c) => /test\s*case\s*name|summary|description/i.test(c)) ||
      columns.find((c) => /sheet\s*name/i.test(c)) ||
      null;
    const commentCol = columns.find((c) => /comment|error/i.test(c)) || null;

    for (const row of rows) {
      const rawStatus = resultCol ? String(row[resultCol] || '').trim() : '';
      const status = normalizeStatus(rawStatus);

      summary.total++;
      switch (status) {
        case 'PASSED': summary.passed++; break;
        case 'FAILED': summary.failed++; break;
        case 'BLOCKED': summary.blocked++; break;
        default: summary.unknown++;
      }

      testRows.push({
        executionName: execName,
        testCaseId: testIdCol ? String(row[testIdCol] || '') : '',
        testCaseName: nameCol ? String(row[nameCol] || '') : '',
        status: rawStatus || 'TODO',
        comment: commentCol ? String(row[commentCol] || '') : '',
      });
    }
  }

  return {
    planName,
    generatedAt: new Date().toISOString(),
    totalExecutions: excelFiles.length,
    summary,
    testRows,
  };
}

/**
 * Build report data for a single execution file.
 */
function buildSingleExecutionData(filePath: string, planName: string): ExcelReportData {
  const execName = deriveExecutionName(path.basename(filePath));
  const { rows } = readExecutionSheet(filePath);

  const testRows: ExcelReportTestRow[] = [];
  const summary: ExcelReportSummary = { total: 0, passed: 0, failed: 0, blocked: 0, unknown: 0 };

  const columns = rows.length ? Object.keys(rows[0]) : [];
  const resultCol = columns.find((c) => /result/i.test(c)) || null;
  const testIdCol = columns.find((c) => /test\s*case\s*id/i.test(c)) || columns[0] || null;
  const nameCol =
    columns.find((c) => /test\s*case\s*name|summary|description/i.test(c)) ||
    columns.find((c) => /sheet\s*name/i.test(c)) ||
    null;
  const commentCol = columns.find((c) => /comment|error/i.test(c)) || null;

  for (const row of rows) {
    const rawStatus = resultCol ? String(row[resultCol] || '').trim() : '';
    const status = normalizeStatus(rawStatus);

    summary.total++;
    switch (status) {
      case 'PASSED': summary.passed++; break;
      case 'FAILED': summary.failed++; break;
      case 'BLOCKED': summary.blocked++; break;
      default: summary.unknown++;
    }

    testRows.push({
      executionName: execName,
      testCaseId: testIdCol ? String(row[testIdCol] || '') : '',
      testCaseName: nameCol ? String(row[nameCol] || '') : '',
      status: rawStatus || 'TODO',
      comment: commentCol ? String(row[commentCol] || '') : '',
    });
  }

  return {
    planName,
    generatedAt: new Date().toISOString(),
    totalExecutions: 1,
    summary,
    testRows,
  };
}

/* ───────────────────────── Row builders (for CSV / HTML) ───────────────────────── */

function buildCombinedRows(data: ExcelReportData): ReportRow[] {
  const header: ReportRow = ['Execution', 'Test Case ID', 'Test Case Name', 'Status', 'Comment'];
  return [header, ...data.testRows.map((r) => [r.executionName, r.testCaseId, r.testCaseName, r.status, r.comment] as ReportRow)];
}

/* ───────────────────────── CSV ───────────────────────── */

function writeCsv(rows: ReportRow[], filePath: string): void {
  const csv = rows.map((r) => r.map(escapeCsvValue).join(',')).join('\n');
  fs.writeFileSync(filePath, csv, 'utf-8');
  logger.info(`[ExcelPlanReportGenerator] CSV written: ${filePath}`);
}

/* ───────────────────────── HTML (shared template) ───────────────────────── */

let _cachedTemplate: string | null = null;
function getHtmlTemplate(): string {
  if (!_cachedTemplate) {
    _cachedTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  }
  return _cachedTemplate;
}

function generateHtmlFromTemplate(
  titleLabel: string,
  subtitle: string,
  columns: string[],
  dataRows: Record<string, any>[],
  summary: ExcelReportSummary,
  outPath: string,
): void {
  const template = getHtmlTemplate();
  const outName = path.basename(outPath);

  const templateData = { columns, rows: dataRows, resultCol: 'Status', testIdCol: 'Test Case ID' };

  const html = template
    .replace(/\${baseFile}/g, titleLabel)
    .replace(/\${sheetName}/g, subtitle)
    .replace(/\${total}/g, String(summary.total))
    .replace(/\${passed}/g, String(summary.passed))
    .replace(/\${failed}/g, String(summary.failed))
    .replace(/\${blocked}/g, String(summary.blocked))
    .replace(/\${unknown}/g, String(summary.unknown))
    .replace(/\${outName}/g, outName)
    .replace('`${jsonStr}`', JSON.stringify(templateData));

  fs.writeFileSync(outPath, html, 'utf-8');

  logger.info(`[ExcelPlanReportGenerator] HTML written: ${outPath}`);
}

/* ───────────────────────── Public: generate all plan reports ───────────────────────── */

/**
 * Generate a full set of reports for an Excel-based test plan directory.
 *
 * Produces:
 *   <outputDir>/<PlanName>_TestPlan_Report.csv
 *   <outputDir>/<PlanName>_TestPlan_Report.html   (combined)
 *   <outputDir>/executions/<ExecName>_Execution_Report.csv
 *   <outputDir>/executions/<ExecName>_Execution_Report.html  (per-execution)
 *
 * @param planDir  Absolute path to the test plan folder containing xlsx files
 * @param outputDir  Destination directory (created if missing)
 * @returns ExcelReportData for the combined plan
 */
export function generateExcelPlanReports(planDir: string, outputDir: string): ExcelReportData {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const planData = buildExcelPlanReportData(planDir);
  const safeName = planData.planName.replace(/[^a-zA-Z0-9-_]/g, '_');

  // ── Combined plan report ──
  const combinedRows = buildCombinedRows(planData);
  writeCsv(combinedRows, path.join(outputDir, `${safeName}_TestPlan_Report.csv`));

  const combinedColumns = ['Execution', 'Test Case ID', 'Test Case Name', 'Status', 'Comment'];
  const combinedDataRows = planData.testRows.map((r) => ({
    'Execution': r.executionName,
    'Test Case ID': r.testCaseId,
    'Test Case Name': r.testCaseName,
    'Status': r.status,
    'Comment': r.comment,
  }));

  generateHtmlFromTemplate(
    safeName,
    `${planData.totalExecutions} Executions — ${planData.summary.total} Test Cases`,
    combinedColumns,
    combinedDataRows,
    planData.summary,
    path.join(outputDir, `${safeName}_TestPlan_Report.html`),
  );

  logger.info(
    `[ExcelPlanReportGenerator] Combined plan report: Total=${planData.summary.total}, Passed=${planData.summary.passed}, Failed=${planData.summary.failed}`,
  );

  // ── Per-execution reports ──
  const excelFiles = findExcelFiles(planDir);
  if (excelFiles.length > 1) {
    const execDir = path.join(outputDir, 'executions');
    if (!fs.existsSync(execDir)) fs.mkdirSync(execDir, { recursive: true });

    for (const filePath of excelFiles) {
      const execData = buildSingleExecutionData(filePath, planData.planName);
      const execSafeName = deriveExecutionName(path.basename(filePath)).replace(/[^a-zA-Z0-9-_]/g, '_');

      // CSV
      const execRows = buildCombinedRows(execData);
      writeCsv(execRows, path.join(execDir, `${execSafeName}_Execution_Report.csv`));

      // HTML (no Execution column needed for single execution)
      const execColumns = ['Test Case ID', 'Test Case Name', 'Status', 'Comment'];
      const execDataRows = execData.testRows.map((r) => ({
        'Test Case ID': r.testCaseId,
        'Test Case Name': r.testCaseName,
        'Status': r.status,
        'Comment': r.comment,
      }));

      generateHtmlFromTemplate(
        `${execSafeName} (${safeName})`,
        execData.testRows[0]?.executionName || execSafeName,
        execColumns,
        execDataRows,
        execData.summary,
        path.join(execDir, `${execSafeName}_Execution_Report.html`),
      );

      logger.info(
        `[ExcelPlanReportGenerator] Execution "${execSafeName}": ${execData.summary.total} tests`,
      );
    }

    logger.info(`[ExcelPlanReportGenerator] ${excelFiles.length} individual execution reports in: ${execDir}`);
  }

  logger.info(`[ExcelPlanReportGenerator] All reports generated in: ${outputDir}`);
  return planData;
}

/* ───────────────────────── CLI entrypoint ───────────────────────── */

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npx ts-node src/reporting/ExcelPlanReportGenerator.ts <planDir> [outputDir]');
    process.exit(1);
  }

  const planDir = path.resolve(args[0]);
  const outputDir = args[1]
    ? path.resolve(args[1])
    : path.join(process.cwd(), 'testreports', 'excel', path.basename(planDir));

  if (!fs.existsSync(planDir)) {
    console.error(`Plan directory not found: ${planDir}`);
    process.exit(1);
  }

  const data = generateExcelPlanReports(planDir, outputDir);
  console.log(`\nPlan: ${data.planName}`);
  console.log(`Executions: ${data.totalExecutions}`);
  console.log(`Total: ${data.summary.total} | Passed: ${data.summary.passed} | Failed: ${data.summary.failed} | Blocked: ${data.summary.blocked} | Unknown: ${data.summary.unknown}`);
}
