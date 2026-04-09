/**
 * @fileoverview
 * Excel Result Updater & Report Generator
 *
 * This module provides functionality to:
 * - Update Excel execution sheets with test results (PASSED/FAILED)
 * - Generate interactive HTML reports from execution sheets
 * - Read and parse execution sheet data
 *
 * Usage:
 *   import { updateExcelResult, generateHtmlReportFromExcel } from './resultUpdater';
 *   await updateExcelResult('/path/to/execution.xlsx', 'TEST-001', 'PASSED', 'Test completed');
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { config } from '../excelOperations/config';

/**
 * Report generation options
 */
export interface ReportOptions {
  outputDir: string; // Directory to write HTML reports
}

/**
 * Read an execution Excel file and return the rows (array of objects).
 * Normalizes header keys to readable label -> value map.
 *
 * @param execFilePath - Path to the execution Excel file
 * @returns Object containing sheetName and rows array
 */
export function readExecutionSheet(execFilePath: string) {
  if (!fs.existsSync(execFilePath)) {
    throw new Error(`Execution file not found: ${execFilePath}`);
  }

  const wb = XLSX.readFile(execFilePath);
  const sheetName = wb.SheetNames.find((n) => /execution/i.test(n)) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const dataRaw = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  // Normalize keys: preserve original header text for display
  const rows = dataRaw.map((r: any) => {
    const normalized: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      normalized[k.toString().trim()] = r[k];
    }
    return normalized;
  });

  return { sheetName, rows };
}

/**
 * Build and write a single HTML report for a given execution file.
 * The HTML file will be written to: <outputDir>/<folderName>.<baseFileName>.html
 *
 * @param execFilePath - Path to the execution Excel file
 * @param opts - Report options containing output directory
 * @returns Path to the generated HTML report
 */
export function generateHtmlReportFromExcel(execFilePath: string, opts: ReportOptions): string {
  const { outputDir } = opts;
  const { rows, sheetName } = readExecutionSheet(execFilePath);

  // Derive output file name similar to JSON naming style
  const execFolder = path.basename(path.dirname(execFilePath)).replace(/\s+/g, '_');
  const baseFile = path.basename(execFilePath, path.extname(execFilePath));
  const outName = `${execFolder}.${baseFile}.html`;
  const outPath = path.join(outputDir, outName);

  // Collect columns (in order of keys from first row)
  const columns = rows.length ? Object.keys(rows[0]) : [];

  // Try to detect a Result column (case-insensitive) and Test Case Id column
  const resultCol = columns.find((c) => /result/i.test(c)) || null;
  const testIdCol = columns.find((c) => /test\s*case\s*id/i.test(c)) || columns[0] || null;

  // Compute summary counts
  let passed = 0,
    failed = 0,
    blocked = 0,
    unknown = 0;
  for (const r of rows) {
    const val = resultCol ? (r[resultCol] || '').toString().trim().toUpperCase() : '';
    if (/PASS|PASSED/i.test(val)) passed++;
    else if (/FAIL|FAILED/i.test(val)) failed++;
    else if (/BLOCK|BLOCKED/i.test(val)) blocked++;
    else unknown++;
  }
  const total = rows.length;

  // Build JSON data for the shared template
  const templateData = {
    columns,
    rows,
    resultCol,
    testIdCol,
  };

  // Read the shared index.html template (same one used by Xray reports)
  const templatePath = path.join(__dirname, 'index.html');
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Replace template variables (matching the placeholders in index.html)
  const html = template
    .replace(/\${baseFile}/g, baseFile)
    .replace(/\${sheetName}/g, sheetName)
    .replace(/\${total}/g, String(total))
    .replace(/\${passed}/g, String(passed))
    .replace(/\${failed}/g, String(failed))
    .replace(/\${blocked}/g, String(blocked))
    .replace(/\${unknown}/g, String(unknown))
    .replace(/\${outName}/g, outName)
    .replace('`${jsonStr}`', JSON.stringify(templateData));

  // Ensure output dir exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outPath, html, 'utf8');

  return outPath;
}

/**
 * Updates the given Excel execution sheet with test results.
 * - Maps results using Test Case ID
 * - Updates "Result" column and optionally comment/error column
 * - Generates an HTML report after updating
 *
 * @param filePath - Path to Excel execution sheet
 * @param testKey - Test Case ID to update
 * @param result - Test result ("PASSED" or "FAILED")
 * @param comment - Optional comment or error message
 *
 * @example
 * await updateExcelResult(
 *   '/path/to/execution.xlsx',
 *   'APS-841',
 *   'PASSED',
 *   'Test completed successfully'
 * );
 */
export async function updateExcelResult(
  filePath: string,
  testKey: string,
  result: 'PASSED' | 'FAILED' | 'SKIPPED',
  comment: string
): Promise<void> {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(` Excel file not found: ${filePath}`);
    return;
  }

  const workbook = XLSX.readFile(filePath);

  // Find the sheet with "execution" in its name or use the first sheet
  const sheetName = workbook.SheetNames.find((name) => /execution/i.test(name)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

  if (!jsonData.length) {
    console.warn(` No data found in sheet: ${sheetName}`);
    return;
  }

  // Detect the column name for Test Case Id dynamically
  const headers = Object.keys(jsonData[0]);
  const testIdColumn = headers.find((h) => /test\s*case\s*id/i.test(h));

  if (!testIdColumn) {
    console.error(` Could not find a "Test Case Id" column in Excel sheet.`);
    return;
  }

  // Detect or create the Result column
  let resultColumn = headers.find((h) => /result/i.test(h));
  if (!resultColumn) {
    resultColumn = 'Result'; // Will be added automatically when writing JSON back
  }

  let commentColumn = headers.find((h) => /comment|error/i.test(h));
  if (!commentColumn) {
    commentColumn = 'Comment'; // Will be added automatically when writing JSON back
  }

  let found = false;

  for (const row of jsonData) {
    const rowTestKey = row[testIdColumn]?.toString().trim();
    if (rowTestKey === testKey.trim()) {
      row[resultColumn] = result;
      row[commentColumn] = comment?.trim() || '';
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(` TestKey "${testKey}" not found in sheet: ${sheetName}`);
  } else {
    console.log(` Updated "${testKey}" -> ${result} in sheet: ${sheetName}`);
  }

  // Write back to the same file
  const updatedSheet = XLSX.utils.json_to_sheet(jsonData);
  workbook.Sheets[sheetName] = updatedSheet;
  XLSX.writeFile(workbook, filePath);
  console.log(` Excel updated: ${filePath}`);

  // Generate HTML report
  try {
    const reportsDir = path.resolve(process.cwd(), 'testreports', 'excel');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const outPath = generateHtmlReportFromExcel(filePath, { outputDir: reportsDir });
    console.log(` Report generated: ${outPath}`);
  } catch (err) {
    console.error('Failed to generate HTML report:', err);
  }
}

/**
 * Marks multiple test cases as SKIPPED in their respective Excel files.
 * Groups cases by execution file path for efficient batch updates.
 *
 * @param skippedCases - Array of test cases to mark as skipped
 * @param reason - Reason for skipping (e.g., "Excluded by run mode: pending")
 *
 * @example
 * const skippedCases = getSkippedCasesByRunMode("pending");
 * await markCasesAsSkipped(skippedCases, "Excluded by run mode: pending");
 */
export async function markCasesAsSkipped(skippedCases: any[], reason: string = 'Skipped by run mode'): Promise<void> {
  if (!skippedCases.length) {
    console.log(' No cases to mark as skipped');
    return;
  }

  // Group cases by execution file path
  const casesByFile = new Map<string, string[]>();
  for (const tc of skippedCases) {
    const filePath = tc.jira?.executionFilePath;
    const testKey = tc.jira?.key;
    if (filePath && testKey) {
      if (!casesByFile.has(filePath)) {
        casesByFile.set(filePath, []);
      }
      casesByFile.get(filePath)!.push(testKey);
    }
  }

  // Update each file
  for (const [filePath, testKeys] of casesByFile) {
    if (!fs.existsSync(filePath)) {
      console.error(` Excel file not found: ${filePath}`);
      continue;
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames.find((name) => /execution/i.test(name)) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

    if (!jsonData.length) continue;

    const headers = Object.keys(jsonData[0]);
    const testIdColumn = headers.find((h) => /test\s*case\s*id/i.test(h));
    const resultColumn = headers.find((h) => /^result$/i.test(h)) || 'Result';
    const commentColumn = headers.find((h) => /comment|error/i.test(h)) || 'Comment';

    if (!testIdColumn) continue;

    let updatedCount = 0;
    for (const row of jsonData) {
      const rowTestKey = row[testIdColumn]?.toString().trim();
      if (testKeys.includes(rowTestKey)) {
        // Safety check: Never overwrite existing PASSED or FAILED results
        const currentResult = row[resultColumn]?.toString().toUpperCase().trim();
        if (currentResult === 'PASSED' || currentResult === 'FAILED') {
          // Skip - don't overwrite existing results
          continue;
        }
        row[resultColumn] = 'SKIPPED';
        row[commentColumn] = reason;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      const updatedSheet = XLSX.utils.json_to_sheet(jsonData);
      workbook.Sheets[sheetName] = updatedSheet;
      XLSX.writeFile(workbook, filePath);
      console.log(` Marked ${updatedCount} case(s) as SKIPPED in: ${path.basename(filePath)}`);
    }
  }
}
