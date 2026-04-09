/**
 * Email Reporter Utility
 * Sends test reports via email with attachments.
 *
 * Usage:
 *   import { EmailReporter } from './utils/emailReporter/EmailReporter';
 *
 *   // Send with default config (from env vars)
 *   await EmailReporter.sendReport();
 *
 *   // Send to specific recipients
 *   await EmailReporter.sendReport({
 *     recipients: ['user1@company.com', 'user2@company.com'],
 *     subject: 'Sprint 5 Test Results',
 *   });
 *
 *   // Send with custom report path
 *   await EmailReporter.sendReport({
 *     reportPath: './custom-report',
 *     reportType: 'playwright',
 *   });
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from automationframework directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // Also try current working directory

import { defaultEmailConfig, EmailConfig } from './emailConfig';
import { generateExcelPlanReports, ExcelReportData } from '../reporting/ExcelPlanReportGenerator';

// Dynamic import for nodemailer (user must install: npm install nodemailer @types/nodemailer)
let nodemailer: any;

interface SendReportOptions {
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  reportPath?: string;
  reportType?: 'playwright' | 'allure' | 'custom';
  /** Source of the report: 'excel' for Excel-based plans, 'xray' for Xray plans */
  reportSource?: 'excel' | 'xray';
  /** Xray Test Plan key(s) — required when reportSource is 'xray' */
  planKeys?: string[];
  customBody?: string;
  attachResults?: boolean;
  config?: Partial<EmailConfig>;
}

interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  startTime: string;
  environment: string;
}

interface TestCaseDetail {
  testCaseId: string;
  testCaseName: string;
  module: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  executionFile?: string; // Track which execution file this test belongs to
  // comment: string;
}

interface ExecutionSummary {
  name: string; // e.g., "Parallel Execution" or "Sequential Execution"
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  testCases: TestCaseDetail[];
}

interface TestCaseJsonFormat {
  name: string;
  module: string;
  jira: {
    key: string;
    summary: string;
    status: string;
    description?: string;
  };
  steps: Array<{ action: string; data: string | null; result: string }>;
}

export class EmailReporter {
  private static readonly TESTCASES_JSON_PATH = './testcases/excel';
  private static readonly TESTREPORTS_PATH = './testreports/excel';
  private static readonly PLAYWRIGHT_CONFIG_PATH = './playwright.config.js';
  private static readonly EMAIL_TEMPLATE_PATH = path.join(__dirname, 'emailTemplate.html');

  /**
   * Extract test plan path from package.json fetch:excel command
   * Looks for the last argument in the command which is the test plan destination path
   */
  private static getExecutionFilesPath(): string {
    try {
      // Read package.json from the consumer project root (process.cwd())
      const packageJsonPath = path.join(process.cwd(), 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`package.json not found at: ${packageJsonPath}`);
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const fetchExcelCommand = packageJson.scripts?.['fetch:excel'];

      if (!fetchExcelCommand) {
        throw new Error(
          'fetch:excel script not found in package.json. Please configure the fetch:excel command with test plan path.'
        );
      }

      // Parse command to extract test plan path (last argument)
      // Example: "node ./node_modules/@rappit/ps-test-automation-base/dist/excelOperations/excelTestPlanProcessor.js Automation/TestRepository Automation/TestPlan/TestPlanSprint1"
      const parts = fetchExcelCommand.trim().split(/\s+/);

      // Last argument is the test plan destination path
      const testPlanPath = parts[parts.length - 1];

      if (!testPlanPath || testPlanPath.startsWith('node') || testPlanPath.endsWith('.js')) {
        throw new Error(`Invalid test plan path in fetch:excel command: ${fetchExcelCommand}`);
      }

      console.log(`📁 Using test plan path from package.json fetch:excel: ${testPlanPath}`);
      return testPlanPath;
    } catch (err) {
      console.error('❌ Failed to extract test plan path from package.json fetch:excel command:', err);
      throw err;
    }
  }

  /**
   * Load HTML template from file
   */
  private static loadTemplate(templatePath: string): string {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    return fs.readFileSync(templatePath, 'utf-8');
  }

  /**
   * Extract browser names from playwright.config.js
   */
  private static getBrowsersFromConfig(): string {
    try {
      if (!fs.existsSync(this.PLAYWRIGHT_CONFIG_PATH)) {
        return 'Chromium';
      }

      const configContent = fs.readFileSync(this.PLAYWRIGHT_CONFIG_PATH, 'utf-8');

      // Extract project names using regex
      const projectMatches = configContent.match(/name:\s*['"]([^'"]+)['"]/g);

      if (!projectMatches || projectMatches.length === 0) {
        return 'Chromium';
      }

      // Extract browser names and filter out commented projects
      const browsers: string[] = [];
      const lines = configContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nameMatch = line.match(/name:\s*['"]([^'"]+)['"]/);

        if (nameMatch) {
          // Check if this line or the project block is commented
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) {
            // Check if we're inside a commented block by looking backwards
            let isCommented = false;
            for (let j = i - 1; j >= 0; j--) {
              const prevLine = lines[j].trim();
              if (prevLine.includes('{') && !prevLine.startsWith('//')) {
                // Found opening brace, check if it's commented
                if (prevLine.startsWith('//')) {
                  isCommented = true;
                }
                break;
              }
              if (prevLine.startsWith('//') || prevLine.startsWith('/*')) {
                isCommented = true;
              }
            }

            if (!isCommented) {
              const browserName = nameMatch[1];
              // Capitalize first letter
              browsers.push(browserName.charAt(0).toUpperCase() + browserName.slice(1));
            }
          }
        }
      }

      return browsers.length > 0 ? browsers.join(', ') : 'Chromium';
    } catch (err) {
      console.warn('⚠️ Failed to read playwright config:', err);
      return 'Chromium';
    }
  }

  /**
   * Send test report via email.
   *
   * Dispatches to the appropriate flow based on `reportSource`:
   *   - **excel** (default): Generates plan-level Excel reports (Plan → Executions → Tests),
   *     builds an email with per-execution breakdown, and attaches the HTML reports.
   *   - **xray**: Reads previously generated Xray reports from `testreports/xray/<PlanKey>/`,
   *     builds an email with plan summary, and attaches the HTML/CSV reports.
   *
   * Call this ONCE after all test executions complete to avoid sending duplicate emails.
   */
  static async sendReport(options: SendReportOptions = {}): Promise<boolean> {
    try {
      // Lazy load nodemailer
      if (!nodemailer) {
        try {
          nodemailer = await import('nodemailer');
        } catch {
          console.error('❌ nodemailer is not installed. Run: npm install nodemailer @types/nodemailer');
          return false;
        }
      }

      const config = { ...defaultEmailConfig, ...options.config };
      const recipients = options.recipients || config.recipients;

      if (!recipients.length) {
        console.error('❌ No recipients specified. Set EMAIL_RECIPIENTS env var or pass recipients array.');
        return false;
      }

      if (!config.smtp.auth.user || !config.smtp.auth.pass) {
        console.error('❌ SMTP credentials not configured. Set SMTP_USER and SMTP_PASS env vars.');
        return false;
      }

      const source = options.reportSource || 'excel';

      let subject: string;
      let htmlBody: string;
      let attachments: any[];

      if (source === 'xray') {
        // ── Xray flow ──
        const result = this.buildXrayEmail(options);
        subject = this.formatSubject(options.subject || config.subject, result.summary);
        htmlBody = options.customBody || result.html;
        attachments = result.attachments;
      } else {
        // ── Excel plan flow (default) ──
        console.log('🔄 Generating Excel plan-level reports...');
        const result = this.buildExcelPlanEmail(options);
        subject = this.formatSubject(options.subject || config.subject, result.summary);
        htmlBody = options.customBody || result.html;
        attachments = result.attachments;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.auth,
      });

      // Send email
      const info = await transporter.sendMail({
        from: config.from,
        to: recipients.join(', '),
        cc: (options.cc || config.cc || []).join(', ') || undefined,
        bcc: (options.bcc || config.bcc || []).join(', ') || undefined,
        subject,
        html: htmlBody,
        attachments,
      });

      console.log(`✅ Report email sent successfully! (source: ${source})`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Recipients: ${recipients.join(', ')}`);
      console.log(`   Attachments: ${attachments.length} file(s)`);

      return true;
    } catch (error: any) {
      console.error(`❌ Failed to send report email: ${error.message}`);
      return false;
    }
  }

  /* ================================================================
   *  Excel Plan flow — generates plan-level reports, builds email
   * ================================================================ */

  private static buildExcelPlanEmail(options: SendReportOptions): {
    summary: ReportSummary;
    html: string;
    attachments: any[];
  } {
    // 1. Generate plan-level reports (combined + per-execution) — single source of truth
    const testPlanPath = path.resolve(this.getExecutionFilesPath());
    const planName = path.basename(testPlanPath);
    const planOutputDir = path.resolve('testreports', 'excel', planName);

    let planData: ExcelReportData | null = null;
    try {
      planData = generateExcelPlanReports(testPlanPath, planOutputDir);
      console.log(
        `📊 Plan report generated: ${planData.planName} (${planData.summary.total} tests across ${planData.totalExecutions} executions)`
      );
    } catch (err) {
      console.warn('⚠️ Failed to generate Excel plan reports:', err);
    }

    // 2. Build email summary from plan data (or fall back to JSON parsing)
    const testCases = this.parseTestCaseResults();
    let displaySummary: ReportSummary;

    if (planData) {
      displaySummary = {
        total: planData.summary.total,
        passed: planData.summary.passed,
        failed: planData.summary.failed,
        skipped: planData.summary.blocked + planData.summary.unknown,
        duration: 'N/A',
        environment: process.env.ENVIRONMENT || 'N/A',
        startTime: new Date().toISOString(),
      };
    } else if (testCases.length > 0) {
      const passed = testCases.filter(tc => tc.status === 'PASSED').length;
      const failed = testCases.filter(tc => tc.status === 'FAILED').length;
      const skipped = testCases.filter(tc => tc.status === 'SKIPPED').length;
      displaySummary = { total: testCases.length, passed, failed, skipped, duration: 'N/A', environment: process.env.ENVIRONMENT || 'N/A', startTime: new Date().toISOString() };
    } else {
      displaySummary = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 'N/A',
        environment: process.env.ENVIRONMENT || 'N/A', 
        startTime: new Date().toISOString(),
      };
    }

    const html = this.generateEmailBody(displaySummary, testCases);

    // 3. Collect attachments — ONLY from plan output folder (clean, no duplicates)
    const attachments: any[] = [];
    if (planData && fs.existsSync(planOutputDir)) {
      // Combined plan report
      const planHtml = fs.readdirSync(planOutputDir).find((f) => f.endsWith('_TestPlan_Report.html'));
      if (planHtml) {
        attachments.push({ filename: planHtml, path: path.join(planOutputDir, planHtml) });
      }
      const planCsv = fs.readdirSync(planOutputDir).find((f) => f.endsWith('_TestPlan_Report.csv'));
      if (planCsv) {
        attachments.push({ filename: planCsv, path: path.join(planOutputDir, planCsv) });
      }

      // Per-execution reports
      const execDir = path.join(planOutputDir, 'executions');
      if (fs.existsSync(execDir)) {
        for (const file of fs.readdirSync(execDir).filter((f) => f.endsWith('.html') || f.endsWith('.csv'))) {
          attachments.push({ filename: file, path: path.join(execDir, file) });
        }
      }
    }

    return { summary: displaySummary, html, attachments };
  }

  /* ================================================================
   *  Xray flow — reads existing Xray reports, builds email
   * ================================================================ */

  private static buildXrayEmail(options: SendReportOptions): {
    summary: ReportSummary;
    html: string;
    attachments: any[];
  } {
    const xrayBaseDir = path.resolve('testreports', 'xray');
    const planKeys = options.planKeys || [];

    // If no specific plan keys given, find all plan directories
    let planDirs: string[] = [];
    if (planKeys.length > 0) {
      planDirs = planKeys.map((k) => path.join(xrayBaseDir, k)).filter((d) => fs.existsSync(d));
    } else if (fs.existsSync(xrayBaseDir)) {
      planDirs = fs
        .readdirSync(xrayBaseDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(xrayBaseDir, d.name));
    }

    if (planDirs.length === 0) {
      console.warn('⚠️ No Xray reports found in testreports/xray/. Generate them first with TestPlanReportGenerator.');
      return {
        summary: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 'N/A', environment: 'N/A', startTime: new Date().toISOString() },
        html: '<p>No Xray reports found.</p>',
        attachments: [],
      };
    }

    // Parse embedded JSON data from each plan's combined HTML to get summary stats
    let totalPassed = 0,
      totalFailed = 0,
      totalBlocked = 0,
      totalUnknown = 0;
    const allTestRows: {
      planKey: string;
      testKey: string;
      testSummary: string;
      executionKey: string;
      status: string;
      comment: string;
    }[] = [];
    const attachments: any[] = [];

    for (const planDir of planDirs) {
      const planKey = path.basename(planDir);

      // Find the combined HTML report
      const files = fs.existsSync(planDir) ? fs.readdirSync(planDir) : [];
      const htmlReport = files.find((f) => f.endsWith('_TestPlan_Report.html'));
      const csvReport = files.find((f) => f.endsWith('_TestPlan_Report.csv'));

      if (htmlReport) {
        attachments.push({ filename: htmlReport, path: path.join(planDir, htmlReport) });

        // Parse embedded data to build email summary
        const content = fs.readFileSync(path.join(planDir, htmlReport), 'utf-8');
        const dataMarker = 'const data = ';
        const dataStart = content.indexOf(dataMarker);
        if (dataStart !== -1) {
          const jsonStart = dataStart + dataMarker.length;
          const lineEnd = content.indexOf('\n', jsonStart);
          const rawLine = content.substring(jsonStart, lineEnd === -1 ? undefined : lineEnd).trim();
          const jsonStr = rawLine.replace(/;\s*$/, '');
          try {
            const data = JSON.parse(jsonStr) as {
              columns: string[];
              rows: Record<string, any>[];
              resultCol: string | null;
            };
            for (const row of data.rows) {
              const status = data.resultCol ? (row[data.resultCol] || '').toString().trim().toUpperCase() : '';
              if (/PASS|PASSED/.test(status)) totalPassed++;
              else if (/FAIL|FAILED/.test(status)) totalFailed++;
              else if (/BLOCK|BLOCKED/.test(status)) totalBlocked++;
              else totalUnknown++;

              allTestRows.push({
                planKey,
                testKey: row['Test Key'] || '',
                testSummary: row['Test Summary'] || '',
                executionKey: row['Execution Key'] || '',
                status: row[data.resultCol || 'Status'] || '',
                comment: row['Comment'] || '',
              });
            }
          } catch {
            /* skip unparseable */
          }
        }
      }

      if (csvReport) {
        attachments.push({ filename: csvReport, path: path.join(planDir, csvReport) });
      }

      // Attach per-execution reports
      const execDir = path.join(planDir, 'executions');
      if (fs.existsSync(execDir)) {
        for (const file of fs.readdirSync(execDir).filter((f) => f.endsWith('.html') || f.endsWith('.csv'))) {
          attachments.push({ filename: `${planKey}_${file}`, path: path.join(execDir, file) });
        }
      }
    }

    const total = allTestRows.length;
    const summary: ReportSummary = {
      total,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalBlocked + totalUnknown,
      duration: 'N/A',
      startTime: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'N/A',
    };

    // Build Xray-specific email body
    const html = this.generateXrayEmailBody(
      summary,
      allTestRows,
      planDirs.map((d) => path.basename(d))
    );

    return { summary, html, attachments };
  }

  /**
   * Generate email body for Xray reports with plan/execution breakdown.
   */
  private static generateXrayEmailBody(
    summary: ReportSummary,
    testRows: {
      planKey: string;
      testKey: string;
      testSummary: string;
      executionKey: string;
      status: string;
      comment: string;
    }[],
    planKeys: string[]
  ): string {
    const passRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : '0';
    const browsers = this.getBrowsersFromConfig();

    // Build doughnut chart
    const chartConfig = {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: [summary.passed, summary.failed, summary.skipped],
            backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
          },
        ],
      },
      options: {
        plugins: { doughnutlabel: { labels: [{ text: `${passRate}%`, font: { size: 20, weight: 'bold' } }] } },
      },
    };
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=150&h=150&bkg=white`;

    // Build execution breakdown
    const execGroups = new Map<string, typeof testRows>();
    for (const r of testRows) {
      const key = r.executionKey;
      if (!execGroups.has(key)) execGroups.set(key, []);
      execGroups.get(key)!.push(r);
    }

    let executionBreakdown = '';
    if (execGroups.size > 1) {
      executionBreakdown = '<h3 style="margin-top:25px;margin-bottom:15px;color:#333;">📊 Execution Breakdown</h3>';
      executionBreakdown += '<div style="display:flex;flex-wrap:wrap;gap:15px;margin-bottom:20px;">';
      for (const [name, rows] of execGroups) {
        const p = rows.filter((r) => /PASS|PASSED/i.test(r.status)).length;
        const f = rows.filter((r) => /FAIL|FAILED/i.test(r.status)).length;
        const s = rows.length - p - f;
        const pr = rows.length > 0 ? ((p / rows.length) * 100).toFixed(0) : '0';
        executionBreakdown += `
          <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:15px;min-width:200px;flex:1;">
            <h4 style="margin:0 0 10px 0;color:#3f6ad8;font-size:14px;">${name}</h4>
            <div style="font-size:12px;color:#666;line-height:1.8;">
              <div><strong>Total:</strong> ${rows.length}</div>
              <div style="color:#28a745;"><strong>Passed:</strong> ${p}</div>
              <div style="color:#dc3545;"><strong>Failed:</strong> ${f}</div>
              <div style="color:#ffc107;"><strong>Other:</strong> ${s}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;"><strong>Pass Rate:</strong> ${pr}%</div>
            </div>
          </div>`;
      }
      executionBreakdown += '</div>';
    }

    // Build test case table
    let rowIndex = 0;
    const tableRows = testRows
      .map((r) => {
        const badge = /PASS|PASSED/i.test(r.status)
          ? '<span style="background:#dff7ea;color:#0a6b3a;padding:4px 8px;border-radius:4px;font-weight:600;">PASSED</span>'
          : /FAIL|FAILED/i.test(r.status)
            ? '<span style="background:#ffecec;color:#9b1c1c;padding:4px 8px;border-radius:4px;font-weight:600;">FAILED</span>'
            : `<span style="background:#e2e3e5;color:#383d41;padding:4px 8px;border-radius:4px;font-weight:600;">${r.status}</span>`;
        return `<tr style="background:${rowIndex++ % 2 === 0 ? '#fff' : '#f9f9f9'};">
        <td style="padding:10px;border-bottom:1px solid #eee;">${r.executionKey}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${r.testKey}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${r.testSummary}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${badge}</td>
      </tr>`;
      })
      .join('');

    const testCaseTable = `
      ${executionBreakdown}
      <h3 style="margin-top:20px;margin-bottom:10px;">📋 All Test Cases (${testRows.length} total)</h3>
      <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #ddd;border-radius:8px;">
        <thead><tr style="background:#f5f5f5;">
          <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Execution</th>
          <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Test Key</th>
          <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Test Summary</th>
          <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Status</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`;

    const statusText =
      planKeys.length === 1 ? `Xray Test Plan: ${planKeys[0]}` : `Xray Test Plans: ${planKeys.join(', ')}`;

    // Use the same email template
    const template = this.loadTemplate(this.EMAIL_TEMPLATE_PATH);
    return template
      .replace(/\{\{statusColor\}\}/g, '#3f6ad8')
      .replace(/\{\{statusText\}\}/g, statusText)
      .replace(/\{\{total\}\}/g, String(summary.total))
      .replace(/\{\{passed\}\}/g, String(summary.passed))
      .replace(/\{\{failed\}\}/g, String(summary.failed))
      .replace(/\{\{skipped\}\}/g, String(summary.skipped))
      .replace(/\{\{passRate\}\}/g, passRate)
      .replace(/\{\{chartUrl\}\}/g, chartUrl)
      .replace(/\{\{duration\}\}/g, summary.duration)
      .replace(/\{\{environment\}\}/g, summary.environment)
      .replace(/\{\{browsers\}\}/g, browsers)
      .replace(/\{\{executionTime\}\}/g, new Date().toLocaleString())
      .replace(/\{\{generatedTime\}\}/g, new Date().toLocaleString())
      .replace(/\{\{testCaseTable\}\}/g, testCaseTable);
  }

  /**
   * Parse test case results from JSON files in testcases/excel folder
   */
  private static parseTestCaseResults(): TestCaseDetail[] {
    const testCases: TestCaseDetail[] = [];
    const jsonDir = this.TESTCASES_JSON_PATH;

    if (!fs.existsSync(jsonDir)) {
      return testCases;
    }

    // Find all JSON test case files in the directory
    const jsonFiles = fs.readdirSync(jsonDir).filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
        const data: TestCaseJsonFormat[] = JSON.parse(content);

        // Extract execution name from file (e.g., "TestPlan.ParallelExecution" -> "Parallel Execution")
        const executionName = this.formatExecutionName(file);

        for (const tc of data) {
          const status = (tc.jira?.status?.toUpperCase() || 'SKIPPED') as 'PASSED' | 'FAILED' | 'SKIPPED';

          testCases.push({
            testCaseId: tc.jira?.key || 'N/A',
            testCaseName: tc.name || tc.jira?.summary || 'Unnamed Test',
            module: tc.module || 'General',
            status,
            executionFile: executionName,
            // comment: status === 'FAILED' ? 'Test execution failed' : '',
          });
        }
      } catch (err) {
        console.warn(`Failed to parse ${file}:`, err);
      }
    }

    return testCases;
  }

  /**
   * Format execution file name into readable execution name
   * E.g., "TestPlanSprint1.SequentialExecution.json" -> "Sequential Execution"
   */
  private static formatExecutionName(filename: string): string {
    // Remove .json extension
    const name = filename.replace('.json', '');

    // Extract the last part after the last dot (e.g., "ParallelExecution" or "SequentialExecution")
    const parts = name.split('.');
    const executionPart = parts[parts.length - 1];

    // Convert camelCase to Title Case with spaces
    // "ParallelExecution" -> "Parallel Execution"
    return executionPart
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .trim()
      .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
  }

  /**
   * Group test cases by execution file and calculate per-execution statistics
   */
  private static groupTestCasesByExecution(testCases: TestCaseDetail[]): ExecutionSummary[] {
    const executionMap = new Map<string, TestCaseDetail[]>();

    // Group test cases by execution file
    for (const tc of testCases) {
      const execName = tc.executionFile || 'Unknown Execution';
      if (!executionMap.has(execName)) {
        executionMap.set(execName, []);
      }
      executionMap.get(execName)!.push(tc);
    }

    // Build execution summaries
    const summaries: ExecutionSummary[] = [];
    for (const [name, cases] of executionMap) {
      const passed = cases.filter((tc) => tc.status === 'PASSED').length;
      const failed = cases.filter((tc) => tc.status === 'FAILED').length;
      const skipped = cases.filter((tc) => tc.status === 'SKIPPED').length;

      summaries.push({
        name,
        total: cases.length,
        passed,
        failed,
        skipped,
        testCases: cases,
      });
    }

    return summaries;
  }

  /**
   * Generate HTML table for test case details with execution grouping
   */
  private static generateTestCaseTable(testCases: TestCaseDetail[]): string {
    if (!testCases.length) {
      return '<p style="color: #666;">No test case details available.</p>';
    }

    const executionSummaries = this.groupTestCasesByExecution(testCases);

    // Generate execution breakdown section
    let executionBreakdown = '';
    if (executionSummaries.length > 1) {
      executionBreakdown = '<h3 style="margin-top:25px;margin-bottom:15px;color:#333;">📊 Execution Breakdown</h3>';
      executionBreakdown += '<div style="display:flex;flex-wrap:wrap;gap:15px;margin-bottom:20px;">';

      for (const exec of executionSummaries) {
        const passRate = exec.total > 0 ? ((exec.passed / exec.total) * 100).toFixed(0) : '0';
        executionBreakdown += `
          <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:15px;min-width:200px;flex:1;">
            <h4 style="margin:0 0 10px 0;color:#3f6ad8;font-size:14px;">${exec.name}</h4>
            <div style="font-size:12px;color:#666;line-height:1.8;">
              <div><strong>Total:</strong> ${exec.total} tests</div>
              <div style="color:#28a745;"><strong>Passed:</strong> ${exec.passed}</div>
              <div style="color:#dc3545;"><strong>Failed:</strong> ${exec.failed}</div>
              <div style="color:#ffc107;"><strong>Skipped:</strong> ${exec.skipped}</div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;"><strong>Pass Rate:</strong> ${passRate}%</div>
            </div>
          </div>`;
      }

      executionBreakdown += '</div>';
    }

    // Generate combined test case table
    let rowIndex = 0;
    const rows = testCases
      .map((tc) => {
        const statusBadge =
          tc.status === 'PASSED'
            ? '<span style="background:#dff7ea;color:#0a6b3a;padding:4px 8px;border-radius:4px;font-weight:600;">PASSED</span>'
            : tc.status === 'FAILED'
              ? '<span style="background:#ffecec;color:#9b1c1c;padding:4px 8px;border-radius:4px;font-weight:600;">FAILED</span>'
              : '<span style="background:#fff3cd;color:#6a4b00;padding:4px 8px;border-radius:4px;font-weight:600;">SKIPPED</span>';

        return `
        <tr style="background:${rowIndex++ % 2 === 0 ? '#fff' : '#f9f9f9'};">
          <td style="padding:10px;border-bottom:1px solid #eee;">${tc.testCaseId}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${tc.testCaseName}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${tc.module}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${tc.executionFile || 'N/A'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${statusBadge}</td>
        </tr>`;
      })
      .join('');

    // Load template and add execution column
    const tableHtml = `
      <h3 style="margin-top:20px;margin-bottom:10px;">📋 All Test Cases (${testCases.length} total)</h3>
      <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #ddd;border-radius:8px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Test Case ID</th>
            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Test Case Name</th>
            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Module</th>
            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Execution</th>
            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>`;

    return executionBreakdown + tableHtml;
  }

  /**
   * Format subject line with variables
   */
  private static formatSubject(template: string, summary: ReportSummary): string {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const status = summary.failed > 0 ? '❌ FAILED' : '✅ PASSED';

    return template
      .replace('${date}', date)
      .replace('${time}', time)
      .replace('${status}', status)
      .replace('${passed}', String(summary.passed))
      .replace('${failed}', String(summary.failed))
      .replace('${total}', String(summary.total));
  }

  /**
   * Generate HTML email body
   */
  private static generateEmailBody(summary: ReportSummary, testCases: TestCaseDetail[]): string {
    const statusColor = '#3f6ad8'; // Default blue
    const statusText = process.env.PROJECT_NAME || 'Test Execution';
    const browsers = this.getBrowsersFromConfig();

    const passRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : '0';

    // Generate pie chart using QuickChart.io (works in all email clients as an image)
    const chartConfig = {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: [summary.passed, summary.failed, summary.skipped],
            backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
          },
        ],
      },
      options: {
        plugins: {
          doughnutlabel: {
            labels: [{ text: `${passRate}%`, font: { size: 20, weight: 'bold' } }],
          },
        },
      },
    };
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=150&h=150&bkg=white`;

    // Load template from external file and replace placeholders
    const template = this.loadTemplate(this.EMAIL_TEMPLATE_PATH);

    return template
      .replace(/\{\{statusColor\}\}/g, statusColor)
      .replace(/\{\{statusText\}\}/g, statusText)
      .replace(/\{\{total\}\}/g, String(summary.total))
      .replace(/\{\{passed\}\}/g, String(summary.passed))
      .replace(/\{\{failed\}\}/g, String(summary.failed))
      .replace(/\{\{skipped\}\}/g, String(summary.skipped))
      .replace(/\{\{passRate\}\}/g, passRate)
      .replace(/\{\{chartUrl\}\}/g, chartUrl)
      .replace(/\{\{duration\}\}/g, summary.duration)
      .replace(/\{\{environment\}\}/g, summary.environment)
      .replace(/\{\{browsers\}\}/g, browsers)
      .replace(/\{\{executionTime\}\}/g, new Date().toLocaleString())
      .replace(/\{\{generatedTime\}\}/g, new Date().toLocaleString())
      .replace(/\{\{testCaseTable\}\}/g, this.generateTestCaseTable(testCases));
  }

  /**
   * Quick send method with minimal config
   */
  static async quickSend(to: string | string[], subject?: string): Promise<boolean> {
    const recipients = Array.isArray(to) ? to : [to];
    return this.sendReport({ recipients, subject });
  }
}

// CLI support - run directly with ts-node
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
📧 Email Reporter CLI

Usage: npx ts-node src/emailReporter/EmailReporter.ts [options]

Environment Variables (required):
  SMTP_HOST       - SMTP server hostname (default: smtp.gmail.com)
  SMTP_PORT       - SMTP port (default: 587)
  SMTP_USER       - SMTP username/email
  SMTP_PASS       - SMTP password (use app password for Gmail)
  EMAIL_FROM      - Sender email address
  EMAIL_RECIPIENTS - Comma-separated list of recipients

Options:
  --help              Show this help message
  --to <emails>       Override recipients (comma-separated)
  --subject <s>       Custom subject line
  --allure            Use Allure results instead of Playwright
  --source <type>     Report source: excel (default) or xray
  --plan-keys <keys>  Xray Test Plan keys (comma-separated, used with --source xray)

Examples:
  npx ts-node src/emailReporter/EmailReporter.ts
  npx ts-node src/emailReporter/EmailReporter.ts --to user@company.com
  npx ts-node src/emailReporter/EmailReporter.ts --source xray --plan-keys TP-123,TP-456
  npx ts-node src/emailReporter/EmailReporter.ts --source excel --to team@company.com
    `);
    process.exit(0);
  }

  const toIndex = args.indexOf('--to');
  const subjectIndex = args.indexOf('--subject');
  const sourceIndex = args.indexOf('--source');
  const planKeysIndex = args.indexOf('--plan-keys');
  const useAllure = args.includes('--allure');

  const options: SendReportOptions = {
    reportType: useAllure ? 'allure' : 'playwright',
  };

  if (toIndex !== -1 && args[toIndex + 1]) {
    options.recipients = args[toIndex + 1].split(',');
  }

  if (subjectIndex !== -1 && args[subjectIndex + 1]) {
    options.subject = args[subjectIndex + 1];
  }

  if (sourceIndex !== -1 && args[sourceIndex + 1]) {
    options.reportSource = args[sourceIndex + 1] as 'excel' | 'xray';
  }

  if (planKeysIndex !== -1 && args[planKeysIndex + 1]) {
    options.planKeys = args[planKeysIndex + 1]
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  EmailReporter.sendReport(options).then((success) => {
    process.exit(success ? 0 : 1);
  });
}
