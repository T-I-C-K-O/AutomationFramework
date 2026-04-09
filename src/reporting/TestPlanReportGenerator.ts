/**
 * @fileoverview Test Plan Report Generator
 *
 * Fetches an Xray Test Plan (executions and test runs) via GraphQL and produces
 * HTML and CSV report formats. The script can be executed directly from the CLI
 * or its individual utilities imported for programmatic use.
 *
 * Key Features:
 * - GraphQL fetch of Test Plan data (plan -> executions -> test runs)
 * - Normalized tabular row model reused across all output formats
 * - CSV with proper escaping of special characters
 * - Interactive HTML report with summary cards, search, filters, and detail modal
 *
 * Usage (CLI):
 *   npx ts-node src/reporting/TestPlanReportGenerator.ts TP-123
 *
 * Output Directory:
 *   testreports/xray/<TestPlanKey>/<TestPlanKey>_TestPlan_Report.(csv|html)
 *
 * Environment:
 *   Requires Xray credentials resolved by getXrayAccessToken()
 *
 * @since 1.0.0
 * @version 2.1.0
 */
import * as fs from 'fs';
import * as path from 'path';
import { getXrayAccessToken, fetchTestPlanFromXray } from '../integrationLibrary/testManagement/xrayAPI';
import { logger } from '../helpers/logger';

/** Single test run inside an execution. */
interface TestRun {
  id: string;
  status: { name: string };
  comment?: string;
  test: { jira: { key: string; summary: string } };
}

/** Test Execution containing many test runs. */
interface TestExecution {
  jira: { key: string; summary: string };
  testRuns: { total: number; results: TestRun[] };
}

/** Shape returned by fetchTestPlanFromXray for a single test plan query. */
export interface TestPlanResponse {
  data: {
    getTestPlans: {
      results: {
        jira: { key: string; summary: string };
        testExecutions: { total: number; results: TestExecution[] };
      }[];
    };
  };
}

/** Test run detail for report data */
interface ReportTestRun {
  executionKey: string;
  executionSummary: string;
  testKey: string;
  testSummary: string;
  status: string;
  comment: string;
}

/** Summary statistics for the report */
interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  unknown: number;
}

/** Complete report data structure */
interface ReportData {
  planKey: string;
  planSummary: string;
  generatedAt: string;
  totalExecutions: number;
  summary: ReportSummary;
  testRuns: ReportTestRun[];
}

/** Row model: [Execution Key, Execution Summary, Test Key, Status, Test Summary, Comment] */
type ReportRow = [string, string, string, string, string, string];

/**
 * Fetch test plan data from Xray GraphQL API.
 * @param planKey Jira Test Plan key
 * @returns TestPlanResponse
 */
async function fetchTestPlan(planKey: string): Promise<TestPlanResponse> {
  const token = await getXrayAccessToken();
  return fetchTestPlanFromXray(planKey, token);
}

/**
 * Build normalized report rows from a raw TestPlanResponse.
 * @param response GraphQL response
 * @returns Object containing plan key, summary, and tabular rows (first row is header)
 */
function buildRows(response: TestPlanResponse): { planKey: string; planSummary: string; rows: ReportRow[] } {
  const plan = response.data.getTestPlans.results[0];
  const planKey = plan.jira.key;
  const planSummary = plan.jira.summary;

  const rows: ReportRow[] = [['Execution Key', 'Execution Summary', 'Test Key', 'Status', 'Test Summary', 'Comment']];

  plan.testExecutions.results.forEach((execution: TestExecution) => {
    execution.testRuns.results.forEach((run: TestRun) => {
      rows.push([
        execution.jira.key,
        execution.jira.summary,
        run.test.jira.key,
        run.status.name,
        run.test.jira.summary,
        run.comment || '',
      ]);
    });
  });

  return { planKey, planSummary, rows };
}

/**
 * Normalize status string to a standard format
 */
function normalizeStatus(status: string): string {
  const upper = status.toUpperCase().trim();
  if (/PASS|PASSED/i.test(upper)) return 'PASSED';
  if (/FAIL|FAILED/i.test(upper)) return 'FAILED';
  if (/BLOCK|BLOCKED/i.test(upper)) return 'BLOCKED';
  if (/TODO|NOT STARTED|PENDING/i.test(upper)) return 'TODO';
  return 'UNKNOWN';
}

/**
 * Build comprehensive report data from a raw TestPlanResponse.
 * @param response GraphQL response
 * @returns ReportData with summary statistics and test runs
 */
function buildReportData(response: TestPlanResponse): ReportData {
  const plan = response.data.getTestPlans.results[0];
  const planKey = plan.jira.key;
  const planSummary = plan.jira.summary;

  const testRuns: ReportTestRun[] = [];
  const summary: ReportSummary = { total: 0, passed: 0, failed: 0, blocked: 0, unknown: 0 };

  plan.testExecutions.results.forEach((execution: TestExecution) => {
    execution.testRuns.results.forEach((run: TestRun) => {
      const status = normalizeStatus(run.status.name);

      // Update summary counts
      summary.total++;
      switch (status) {
        case 'PASSED':
          summary.passed++;
          break;
        case 'FAILED':
          summary.failed++;
          break;
        case 'BLOCKED':
          summary.blocked++;
          break;
        default:
          summary.unknown++;
      }

      testRuns.push({
        executionKey: execution.jira.key,
        executionSummary: execution.jira.summary,
        testKey: run.test.jira.key,
        testSummary: run.test.jira.summary,
        status: run.status.name,
        comment: run.comment || '',
      });
    });
  });

  return {
    planKey,
    planSummary,
    generatedAt: new Date().toISOString(),
    totalExecutions: plan.testExecutions.total,
    summary,
    testRuns,
  };
}

/**
 * Build report data for a single execution.
 * @param execution Test Execution object
 * @param planKey Test Plan key (for context)
 * @param planSummary Test Plan summary (for context)
 * @returns ReportData for the single execution
 */
function buildExecutionReportData(execution: TestExecution, planKey: string, planSummary: string): ReportData {
  const testRuns: ReportTestRun[] = [];
  const summary: ReportSummary = { total: 0, passed: 0, failed: 0, blocked: 0, unknown: 0 };

  execution.testRuns.results.forEach((run: TestRun) => {
    const status = normalizeStatus(run.status.name);

    summary.total++;
    switch (status) {
      case 'PASSED':
        summary.passed++;
        break;
      case 'FAILED':
        summary.failed++;
        break;
      case 'BLOCKED':
        summary.blocked++;
        break;
      default:
        summary.unknown++;
    }

    testRuns.push({
      executionKey: execution.jira.key,
      executionSummary: execution.jira.summary,
      testKey: run.test.jira.key,
      testSummary: run.test.jira.summary,
      status: run.status.name,
      comment: run.comment || '',
    });
  });

  return {
    planKey,
    planSummary,
    generatedAt: new Date().toISOString(),
    totalExecutions: 1,
    summary,
    testRuns,
  };
}

/**
 * Build rows for a single execution.
 * @param execution Test Execution object
 * @returns Array of report rows (first row is header)
 */
function buildExecutionRows(execution: TestExecution): ReportRow[] {
  const rows: ReportRow[] = [['Execution Key', 'Execution Summary', 'Test Key', 'Status', 'Test Summary', 'Comment']];

  execution.testRuns.results.forEach((run: TestRun) => {
    rows.push([
      execution.jira.key,
      execution.jira.summary,
      run.test.jira.key,
      run.status.name,
      run.test.jira.summary,
      run.comment || '',
    ]);
  });

  return rows;
}

/** Escape a single CSV value (handles commas, quotes, newlines). */
function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Generate CSV report.
 * @param planKey Test Plan key for filename
 * @param rows Row data (first row is header)
 * @param outputDir Destination directory
 */
function generateCsvReport(planKey: string, rows: ReportRow[], outputDir: string) {
  // Sanitize planKey for filename
  const safeName = planKey.replace(/[^a-zA-Z0-9-_]/g, '_');
  const file = path.join(outputDir, `${safeName}_TestPlan_Report.csv`);
  const csv = rows.map((r) => r.map(escapeCsvValue).join(',')).join('\n');
  fs.writeFileSync(file, csv, 'utf-8');
  logger.info(`[TestPlanReportGenerator] CSV report written: ${file}`);
}

/**
 * Map test status to a representative CSS color.
 */
function statusColor(status: string): string {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'PASSED':
      return '#28a745';
    case 'FAILED':
      return '#dc3545';
    case 'BLOCKED':
      return '#fd7e14';
    case 'TODO':
      return '#17a2b8';
    default:
      return '#6c757d';
  }
}

let _cachedTemplate: string | null = null;
function getHtmlTemplate(): string {
  if (!_cachedTemplate) {
    _cachedTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  }
  return _cachedTemplate;
}

/** Generate interactive HTML report using the shared index.html template. */
function generateHtmlReport(planKey: string, planSummary: string, rows: ReportRow[], outputDir: string, reportData?: ReportData) {
  // Sanitize planKey for filename
  const safeName = planKey.replace(/[^a-zA-Z0-9-_]/g, '_');
  const outName = `${safeName}_TestPlan_Report.html`;
  const file = path.join(outputDir, outName);

  let template = getHtmlTemplate();

  // Build data in the format expected by the template
  const columns = ['Execution Key', 'Execution Summary', 'Test Key', 'Status', 'Test Summary', 'Comment'];
  const dataRows = rows.slice(1).map((r) => ({
    'Execution Key': r[0],
    'Execution Summary': r[1],
    'Test Key': r[2],
    'Status': r[3],
    'Test Summary': r[4],
    'Comment': r[5] || '',
  }));

  // Calculate summary
  const summary = { total: dataRows.length, passed: 0, failed: 0, blocked: 0, unknown: 0 };
  dataRows.forEach((row) => {
    const status = normalizeStatus(row['Status']);
    switch (status) {
      case 'PASSED': summary.passed++; break;
      case 'FAILED': summary.failed++; break;
      case 'BLOCKED': summary.blocked++; break;
      default: summary.unknown++;
    }
  });

  // Build JSON data for template
  const templateData = {
    columns,
    rows: dataRows,
    resultCol: 'Status',
    testIdCol: 'Test Key',
  };
  const jsonStr = JSON.stringify(templateData).replace(/<\/script/g, '<\\/script');

  // Replace template variables
  const html = template
    .replace(/\${baseFile}/g, planKey)
    .replace(/\${sheetName}/g, planSummary)
    .replace(/\${total}/g, String(summary.total))
    .replace(/\${passed}/g, String(summary.passed))
    .replace(/\${failed}/g, String(summary.failed))
    .replace(/\${blocked}/g, String(summary.blocked))
    .replace(/\${unknown}/g, String(summary.unknown))
    .replace(/\${outName}/g, outName)
    .replace('`${jsonStr}`', JSON.stringify(templateData));

  fs.writeFileSync(file, html, 'utf-8');
  
  logger.info(`[TestPlanReportGenerator] HTML report written: ${file}`);
}

/** Generate HTML report for a single execution using the shared template. */
function generateExecutionHtmlReport(
  execKey: string,
  execSummary: string,
  planKey: string,
  planSummary: string,
  rows: ReportRow[],
  filePath: string,
  reportData: ReportData
) {
  let template = getHtmlTemplate();

  // Build data in the format expected by the template
  const columns = ['Test Key', 'Status', 'Test Summary', 'Comment'];
  const dataRows = rows.slice(1).map((r) => ({
    'Test Key': r[2],
    'Status': r[3],
    'Test Summary': r[4],
    'Comment': r[5] || '',
  }));

  // Calculate summary
  const summary = { total: dataRows.length, passed: 0, failed: 0, blocked: 0, unknown: 0 };
  dataRows.forEach((row) => {
    const status = normalizeStatus(row['Status']);
    switch (status) {
      case 'PASSED': summary.passed++; break;
      case 'FAILED': summary.failed++; break;
      case 'BLOCKED': summary.blocked++; break;
      default: summary.unknown++;
    }
  });

  // Build JSON data for template
  const templateData = {
    columns,
    rows: dataRows,
    resultCol: 'Status',
    testIdCol: 'Test Key',
  };

  // Output filename for download link
  const outName = path.basename(filePath);

  // Replace template variables
  const html = template
    .replace(/\${baseFile}/g, execKey)
    .replace(/\${sheetName}/g, execSummary)
    .replace(/\${total}/g, String(summary.total))
    .replace(/\${passed}/g, String(summary.passed))
    .replace(/\${failed}/g, String(summary.failed))
    .replace(/\${blocked}/g, String(summary.blocked))
    .replace(/\${unknown}/g, String(summary.unknown))
    .replace(/\${outName}/g, outName)
    .replace('`${jsonStr}`', JSON.stringify(templateData));

  fs.writeFileSync(filePath, html, 'utf-8');
  
  logger.info(`[TestPlanReportGenerator] Execution HTML report written: ${filePath}`);
}
/**
 * Generate reports for each test execution separately.
 * Creates a combined report for the test plan plus individual reports per execution.
 * @param response Test Plan response object
 * @param outputDir Destination directory (created if missing)
 */
export function generateTestPlanReports(response: TestPlanResponse, outputDir: string): void {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const plan = response.data.getTestPlans.results[0];
  const planKey = plan.jira.key;
  const planSummary = plan.jira.summary;
  const executions = plan.testExecutions.results;

  // Generate combined report for the entire test plan
  const { rows } = buildRows(response);
  const reportData = buildReportData(response);

  generateCsvReport(planKey, rows, outputDir);
  generateHtmlReport(planKey, planSummary, rows, outputDir, reportData);

  logger.info(`[TestPlanReportGenerator] âœ… Combined Test Plan Report generated`);
  logger.info(`[TestPlanReportGenerator] Summary: Total=${reportData.summary.total}, Passed=${reportData.summary.passed}, Failed=${reportData.summary.failed}, Blocked=${reportData.summary.blocked}, Unknown=${reportData.summary.unknown}`);

  // Generate individual reports for each execution
  if (executions.length > 1) {
    const executionsDir = path.join(outputDir, 'executions');
    if (!fs.existsSync(executionsDir)) fs.mkdirSync(executionsDir, { recursive: true });

    executions.forEach((execution: TestExecution) => {
      const execKey = execution.jira.key;
      const execSummary = execution.jira.summary;
      const execRows = buildExecutionRows(execution);
      const execReportData = buildExecutionReportData(execution, planKey, planSummary);

      // Generate CSV and HTML for this execution
      const safeExecName = execKey.replace(/[^a-zA-Z0-9-_]/g, '_');
      const csvFile = path.join(executionsDir, `${safeExecName}_Execution_Report.csv`);
      const htmlFile = path.join(executionsDir, `${safeExecName}_Execution_Report.html`);

      // Write CSV
      const csv = execRows.map((r) => r.map(escapeCsvValue).join(',')).join('\n');
      fs.writeFileSync(csvFile, csv, 'utf-8');

      // Generate HTML with execution-specific data
      generateExecutionHtmlReport(execKey, execSummary, planKey, planSummary, execRows, htmlFile, execReportData);

      logger.info(`[TestPlanReportGenerator] âœ… Execution ${execKey} report generated (${execReportData.summary.total} tests)`);
    });

    logger.info(`[TestPlanReportGenerator] ðŸ“ ${executions.length} individual execution reports generated in: ${executionsDir}`);
  }

  logger.info(`[TestPlanReportGenerator] âœ… All reports generated in: ${outputDir}`);
}


// CLI Entrypoint (only executes when run directly)
if (require.main === module) {
  const readline = require('readline');

  function askQuestion(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  (async () => {
    try {
      const input = await askQuestion('Enter Test Plan Key(s) (comma or space separated): ');

      const planKeys = input
        .split(/[,\s]+/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);

      if (planKeys.length === 0) {
        logger.error('No Test Plan Keys provided. Exiting.');
        process.exit(1);
      }

      for (const planKey of planKeys) {
        logger.info(`[TestPlanReportGenerator] Generating reports for Test Plan: ${planKey}`);
        const response = await fetchTestPlan(planKey);
        const outputPath = path.join(process.cwd(), 'testreports', 'xray', planKey);
        generateTestPlanReports(response, outputPath);
      }
    } catch (err: any) {
      logger.error(err?.message || err);
      process.exit(1);
    }
  })();
}

