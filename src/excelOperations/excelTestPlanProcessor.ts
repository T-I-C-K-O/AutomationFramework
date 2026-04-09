/**
 * @fileoverview
 * Test Plan & Execution Sheet Processor
 *
 * This script processes Excel-based Test Plans and Execution Sheets,
 * matches the test case IDs from the execution sheets with repository definitions,
 * and generates structured JSON files for downstream automation.
 *
 * Key Features:
 * - Reads all Test Plans and sprint subfolders recursively
 * - Reads execution sheets (*.xlsx) and maps "Test Case ID" to repository definitions
 * - Extracts step-wise Action, Data, Expected Result for each test case
 * - Captures Result/Status column for run mode filtering (PASSED/FAILED/SKIPPED/empty)
 * - Generates JSON output named as <FolderName>.<FileName>.json
 * - Ignores temporary Excel files (~$, copy, or previous JSON files)
 * - Provides a utility function to update results back into Excel sheets
 * - Generates interactive HTML reports from execution sheets
 *
 * Run Mode Filtering:
 * - The "Result" column from execution sheets is captured as `jira.status`
 * - Use EXCEL_RUN_MODE environment variable to filter test cases:
 *   - "all": Run all test cases regardless of status
 *   - "pending": Run only cases with empty Result column (default)
 *   - "failed": Run only failed test cases (for re-runs)
 *   - "skipped": Run only skipped test cases
 *
 * CallTest Feature:
 * - Supports "CallTest" action to reference and inline steps from other test cases
 * - When an action contains "CallTest", parses the Data field as JSON:
 *   {
 *     "Path": "ModuleB/TestApp.xlsx",      // Required: Relative path to Excel file
 *     "Case Id": "OMD-1001",               // Required: Test Case ID to import
 *     "Case Name": "Verify mandatory..."   // Optional: For documentation only
 *   }
 * - Resolves the referenced test case and inserts its steps inline
 * - Supports nested CallTest (CallTest within a called test case)
 * - Detects and prevents circular CallTest references
 * - Field names are case-insensitive (Path, path, PATH all work)
 *
 * DataSet Feature (Data-Driven Testing):
 * - Supports "DataSet" column in repository to specify test data file path
 * - When a test case has a DataSet column with a file path (e.g., "DataSets/credentials.xlsx"):
 *   - Reads the test data Excel file
 *   - Each row becomes an iteration
 *   - Each column becomes a parameter with name (header) and value (cell)
 * - Use ${Parameter Name} in step Data fields to reference iteration parameters
 * - Example DataSet Excel:
 *   | Role       | Email Address         | Password   |
 *   |------------|----------------------|------------|
 *   | Supervisor | supervisor@gmail.com | supervisor |
 *   | Manager    | manager@gmail.com    | manager    |
 *
 * Usage:
 *   # Generate JSON files from Excel
 *   npx ts-node coreLibraries/excelOperations/excelToJson.ts
 *
 *   # Run tests with different modes
 *   EXCEL_RUN_MODE=pending npx playwright test tests/run-excel-case.spec.ts  # Default
 *   EXCEL_RUN_MODE=all npx playwright test tests/run-excel-case.spec.ts
 *   EXCEL_RUN_MODE=failed npx playwright test tests/run-excel-case.spec.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

/**
 * Configuration interface defining essential folder paths
 */
interface TestPlanProcessorConfig {
  repositoryPath: string; // Path where repository Excel files are stored
  testPlanPath: string; // Path where execution plan folders are stored
  outputPath: string; // Path where generated JSON files will be stored
}

/**
 * Represents a single test step
 */
interface TestStep {
  action: string; // Action to perform (from repository Excel)
  data: string | null; // Optional data associated with the step
  result: string | null; // Expected result of the step
}

/**
 * Represents Test Cases metadata for a test case
 */
interface TestCaseMetadata {
  key: string | null; // Jira ID or Test Case ID
  summary: string | null; // Jira summary or test case description
  description: string | null; // Optional detailed description
  attachment: any[]; // Attachments if any
  executionFilePath?: string; // Original execution Excel file path
  status?: string; // Execution status from Result column (PASSED/FAILED/SKIPPED/empty)
}

/**
 * Represents a parameter in an iteration
 */
interface TestParameter {
  name: string; // Parameter name (column header from DataSet Excel)
  value: string; // Parameter value (cell value from DataSet row)
}

/**
 * Represents a single iteration for data-driven testing
 */
interface TestIteration {
  rank: string; // Iteration number (1, 2, 3, ...)
  parameters: TestParameter[]; // Array of name-value pairs
}

/**
 * Represents a single test case with steps and Jira info
 */
interface ProcessedTestCase {
  name: string; // Name of the test case
  module: string; // Module name from execution sheet
  jira: TestCaseMetadata; // Test Case Metadata
  steps: TestStep[]; // Step-wise actions
  iterations: TestIteration[]; // Data-driven test iterations from DataSet
}

/**
 * Helper function to normalize Excel headers to lowercase
 * This ensures we can access columns like "Test Case ID" as "test case id"
 *
 * @param row - Raw row object from Excel sheet
 * @returns Normalized row object with lowercase keys
 */
function normalizeExcelRowKeys(row: any): any {
  const normalized: any = {};
  for (const key of Object.keys(row)) {
    normalized[key.toLowerCase().trim()] = row[key];
  }
  return normalized;
}

/**
 * Interface for CallTest data structure
 */
interface CallTestReference {
  path: string; // Relative path to the Excel file (e.g., "ModuleB/TestApp.xlsx")
  'Case Id': string; // Test Case ID to look up
  'Case Name'?: string; // Optional: Test case name for reference
}

/**
 * Loads iterations from a DataSet Excel file.
 * Each row in the DataSet becomes an iteration, and each column becomes a parameter.
 *
 * NOTE: This function throws an error if the DataSet value is provided but invalid.
 * If DataSet is empty/not provided, the caller should not invoke this function.
 *
 * @param dataSetValue - DataSet value from repository. Can be:
 *                       - Simple path: "DataSets/credentials.xlsx"
 *                       - JSON format: { "Path": "DataSets/credentials.xlsx" }
 * @param repositoryPath - Base path to the repository folder
 * @returns Array of Iteration objects
 * @throws Error if DataSet path is invalid, file not found, or file is empty
 *
 * Example DataSet Excel:
 * | Role       | Email Address         | Password   |
 * |------------|----------------------|------------|
 * | Supervisor | supervisor@gmail.com | supervisor |
 * | Manager    | manager@gmail.com    | manager    |
 *
 * Produces iterations:
 * [
 *   { rank: "1", parameters: [{name: "Role", value: "Supervisor"}, {name: "Email Address", value: "supervisor@gmail.com"}, ...] },
 *   { rank: "2", parameters: [{name: "Role", value: "Manager"}, {name: "Email Address", value: "manager@gmail.com"}, ...] }
 * ]
 */
function loadTestIterationsFromDataSet(dataSetValue: string, repositoryPath: string): TestIteration[] {
  const iterations: TestIteration[] = [];
  let dataSetPath: string;

  // Check if the value is JSON format or simple path
  const trimmedValue = dataSetValue.trim();
  if (trimmedValue.startsWith('{')) {
    // Parse JSON format: { "Path": "DataSets/credentials.xlsx" }
    try {
      const jsonData = JSON.parse(trimmedValue);
      // Normalize keys to handle case variations (Path vs path)
      const normalizedData: Record<string, any> = {};
      for (const key of Object.keys(jsonData)) {
        normalizedData[key.toLowerCase().trim()] = jsonData[key];
      }
      dataSetPath = normalizedData['path'] || '';
      if (!dataSetPath) {
        throw new Error(`DataSet JSON missing "Path" field: ${trimmedValue}`);
      }
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error(`Invalid DataSet JSON format: ${trimmedValue}`);
      }
      throw parseError;
    }
  } else {
    // Simple path format
    dataSetPath = trimmedValue;
  }

  // Build the full file path
  const filePath = path.join(repositoryPath, dataSetPath);

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`DataSet file not found: ${filePath}`);
  }

  console.log(`  📊 Loading DataSet: ${dataSetPath}`);

  // Read the DataSet Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const sheetData = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName], { defval: '' });

  // Validate file has data
  if (sheetData.length === 0) {
    throw new Error(`DataSet file is empty: ${dataSetPath}`);
  }

  // Get column headers (parameter names) from first row
  const headers = Object.keys(sheetData[0]);

  // Convert each row to an iteration
  sheetData.forEach((row, index) => {
    const parameters: TestParameter[] = headers.map((header) => ({
      name: header,
      value: String(row[header] ?? ''),
    }));

    iterations.push({
      rank: String(index + 1),
      parameters,
    });
  });

  console.log(`  ✅ Loaded ${iterations.length} iterations from DataSet`);

  return iterations;
}

/**
 * Resolves a CallTest reference by reading the referenced test case steps
 * from the specified Excel file in the repository.
 *
 * @param callTestData - The CallTest configuration object
 * @param repositoryPath - Base path to the repository folder
 * @param visitedCalls - Set of already visited CallTest references (to prevent infinite loops)
 * @returns Array of Step objects from the referenced test case
 */
function resolveCallTestReference(
  callTestReference: CallTestReference,
  repositoryPath: string,
  visitedCalls: Set<string> = new Set()
): TestStep[] {
  const steps: TestStep[] = [];

  try {
    // Build the full file path
    const filePath = path.join(repositoryPath, callTestReference.path);
    const caseId = callTestReference['Case Id']?.toString().trim().toLowerCase();

    // Create a unique key for this CallTest to detect circular references
    const callKey = `${callTestReference.path}::${caseId}`;

    if (visitedCalls.has(callKey)) {
      console.warn(`  ⚠️ Circular CallTest reference detected: ${callKey}. Skipping.`);
      return steps;
    }
    visitedCalls.add(callKey);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ CallTest file not found: ${filePath}`);
      return steps;
    }

    console.log(`  📎 Resolving CallTest: ${callTestReference.path} -> Case ID: ${callTestReference['Case Id']}`);

    // Read the referenced Excel file
    const workbook = XLSX.readFile(filePath);

    // Iterate through all sheets to find the test case
    for (const sheetName of workbook.SheetNames) {
      const sheetDataRaw = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName], { defval: '' });
      const sheetData = sheetDataRaw.map(normalizeExcelRowKeys);

      let isCapturing = false;

      for (const row of sheetData) {
        const rowCaseId = row['test case id']?.toString().trim().toLowerCase();
        const action = row['action'];
        const data = row['data'];
        const result = row['expected results'];

        // Start capturing when we find the matching case ID
        if (rowCaseId) {
          if (rowCaseId === caseId) {
            isCapturing = true;
            // Don't skip - the first action may be on the same row as the Case ID
          } else if (isCapturing) {
            // We've hit a new test case, stop capturing
            break;
          }
        }

        // Capture steps while in the relevant test case (including the row with Case ID if it has an action)
        if (isCapturing && (action || data || result)) {
          // Check if this step is also a CallTest (nested CallTest)
          if (action && /calltest/i.test(action.toString())) {
            const nestedSteps = handleCallTestAction(action, data, repositoryPath, visitedCalls);
            steps.push(...nestedSteps);
          } else {
            steps.push({
              action: action || '',
              data: data || null,
              result: result || null,
            });
          }
        }
      }

      // If we found and captured the case, no need to check other sheets
      if (steps.length > 0) break;
    }

    if (steps.length === 0) {
      console.warn(`  ⚠️ Case ID "${callTestReference['Case Id']}" not found in ${callTestReference.path}`);
    } else {
      console.log(`  ✅ Resolved ${steps.length} steps from CallTest`);
    }
  } catch (err) {
    console.error(`  ❌ Error resolving CallTest:`, err);
  }

  return steps;
}

/**
 * Handles a CallTest action by parsing the data and resolving the referenced steps
 *
 * @param action - The action string (should contain "CallTest")
 * @param data - The data string containing JSON configuration
 * @param repositoryPath - Base path to the repository folder
 * @param visitedCalls - Set of already visited CallTest references
 * @returns Array of Step objects from the referenced test case
 */
function handleCallTestAction(
  action: string,
  data: string | null,
  repositoryPath: string,
  visitedCalls: Set<string> = new Set()
): TestStep[] {
  if (!data) {
    console.warn(`  ⚠️ CallTest action found but no data provided`);
    return [];
  }

  try {
    //Sanitize common JSON formatiing issues from Excel
    let sanitizedData = data.toString().trim();
    //FIx double commas (",,")
    sanitizedData = sanitizedData.replace(/,\*,/g, ',');
    // Fix trailing commas before closing brace (e.g., ",}" -> "}")
    sanitizedData = sanitizedData.replace(/,\s*}/g, '}');
    // Fix leading commas after opening brace (e.g., "{," -> "{")
    sanitizedData = sanitizedData.replace(/{\s*,/g, '{');
    // Parse the JSON data
    const rawData = JSON.parse(sanitizedData);

    // Normalize keys to handle case variations (Path vs path, Case Id vs case id)
    const normalizedData: Record<string, any> = {};
    for (const key of Object.keys(rawData)) {
      normalizedData[key.toLowerCase().trim()] = rawData[key];
    }

    // Build CallTestData with normalized keys
    const callTestReference: CallTestReference = {
      path: normalizedData['path'] || '',
      'Case Id': normalizedData['case id'] || '',
      'Case Name': normalizedData['case name'] || '',
    };

    // Validate required fields
    if (!callTestReference.path || !callTestReference['Case Id']) {
      console.warn(`  ⚠️ CallTest data missing required fields (path, Case Id):`, data);
      return [];
    }

    // Resolve and return the steps
    return resolveCallTestReference(callTestReference, repositoryPath, visitedCalls);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (parseError) {
    console.error(`  ❌ Failed to parse CallTest data as JSON:`, data);
    return [];
  }
}

/**
 * Main function to generate test cases from all Test Plans and Execution Sheets
 * - Creates output folder if it doesn't exist
 * - Iterates through each plan folder
 * - Handles sprint subfolders if present
 * - Calls `generateTestCasesFromExecutionSheets` for each folder
 *
 * @param config - Configuration object containing folder paths
 */
export async function generateTestCasesFromAllPlans(config: TestPlanProcessorConfig): Promise<void> {
  try {
    // Ensure the output folder exists
    if (!fs.existsSync(config.outputPath)) {
      fs.mkdirSync(config.outputPath, { recursive: true });
    }

    // Read all plan folders under testPlanPath
    const plans = fs
      .readdirSync(config.testPlanPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('~$'))
      .map((d) => d.name);

    // If there are no subfolders, treat the folder name as plan name (not "Root")
    if (plans.length === 0) {
      const folderName = path.basename(config.testPlanPath);
      await generateTestCasesFromExecutionSheets(config, folderName, '', config.testPlanPath);
      return;
    }

    // Iterate over each plan folder
    for (const plan of plans) {
      const planPath = path.join(config.testPlanPath, plan);

      // Check for sprint subfolders inside the plan folder
      const subDirs = fs
        .readdirSync(planPath, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('~$'));

      // If sprint subfolders exist, process each
      if (subDirs.length > 0) {
        for (const sprint of subDirs.map((d) => d.name)) {
          const sprintPath = path.join(planPath, sprint);
          await generateTestCasesFromExecutionSheets(config, plan, sprint, sprintPath);
        }
      }
      // If no sprint subfolders, process plan folder directly
      else {
        await generateTestCasesFromExecutionSheets(config, plan, '', planPath);
      }
    }
  } catch (err) {
    console.error('Error in generateTestCasesFromAllPlans:', err);
  }
}

/**
 * Generates test cases from all execution sheet Excel files in a folder
 * - Reads each execution sheet
 * - Maps test case IDs to repository definitions
 * - Collects step-wise actions and builds TestCase objects
 * - Generates JSON output file named <FolderName>.<FileName>.json
 *
 * @param config - Configuration object
 * @param plan - Plan folder name
 * @param sprint - Sprint folder name (if any)
 * @param folderPath - Absolute path to the folder containing execution sheets
 */
export async function generateTestCasesFromExecutionSheets(
  config: TestPlanProcessorConfig,
  plan: string,
  sprint: string,
  folderPath: string
): Promise<void> {
  // Only include valid Excel files, ignore temporary copies or JSONs
  const execSheets = fs
    .readdirSync(folderPath)
    .filter(
      (f) =>
        f.toLowerCase().endsWith('.xlsx') &&
        !f.startsWith('~$') &&
        !f.toLowerCase().includes('copy') &&
        !f.toLowerCase().includes('.json')
    );

  for (const execFile of execSheets) {
    const execFilePath = path.join(folderPath, execFile);

    // Read execution Excel workbook and first sheet
    const execWb = XLSX.readFile(execFilePath);
    const execSheet = execWb.SheetNames[0];

    const execDataRaw = XLSX.utils.sheet_to_json<any>(execWb.Sheets[execSheet], { defval: '' });
    const execData = execDataRaw.map(normalizeExcelRowKeys); // Normalize headers

    console.log(`Processing execution file: ${execFile} (${execData.length} rows)`);
    const generatedTestCases: ProcessedTestCase[] = [];

    // Iterate over each row in execution sheet
    for (const row of execData) {
      const testCaseId = row['test case id'];
      const module = row['module'];
      const fileName = row['file name'];
      const sheetNameFilter = row['sheet name'];
      // Capture execution result from Result/Results/Status column (case-insensitive)
      const executionResult = row['result'] || row['results'] || row['status'] || '';

      if (!testCaseId || !module) continue; // Skip if mandatory fields missing

      const moduleFolder = path.join(config.repositoryPath, module);
      if (!fs.existsSync(moduleFolder)) {
        console.warn(`Module folder not found: ${moduleFolder}`);
        continue;
      }

      // Determine which repository files to read
      const repoFiles = fileName
        ? [path.join(moduleFolder, fileName)]
        : fs
            .readdirSync(moduleFolder)
            .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
            .map((f) => path.join(moduleFolder, f));

      // Process each repository file
      let testCaseFound = false; // Track if test case was already found in a previous sheet
      for (const repoFile of repoFiles) {
        if (!fs.existsSync(repoFile)) continue;
        if (testCaseFound) break; // Skip remaining files if test case already found

        const repoWb = XLSX.readFile(repoFile);
        for (const sheetName of repoWb.SheetNames) {
          if (sheetNameFilter && sheetName !== sheetNameFilter) continue;
          if (testCaseFound) break; // Skip remaining sheets if test case already found

          const repoDataRaw = XLSX.utils.sheet_to_json<any>(repoWb.Sheets[sheetName], { defval: '' });
          const repoData = repoDataRaw.map(normalizeExcelRowKeys);

          let currentCase: ProcessedTestCase | null = null;
          let isRelevant = false;
          let skipCurrentCase = false; // Flag to skip test case if DataSet is invalid

          // Iterate repository rows and build TestCase objects
          for (const r of repoData) {
            const caseId = r['test case id']?.toString().trim();
            const caseName = r['test case name'];
            const caseSummary = r['test case description'];
            const action = r['action'];
            const data = r['data'];
            const result = r['expected results'];
            const dataSetPath = r['dataset'] || r['data set'] || ''; // DataSet column for data-driven testing

            // Start a new test case when "Test Case ID" is found
            if (caseId) {
              // Push the previous case if it was relevant and not skipped
              if (currentCase && isRelevant && !skipCurrentCase) {
                generatedTestCases.push(currentCase);
                testCaseFound = true; // Mark that we found and processed the test case
              }

              // Reset skip flag for new case
              skipCurrentCase = false;

              // Check if this repository case matches execution sheet FIRST
              isRelevant = caseId.toLowerCase() === testCaseId.toString().trim().toLowerCase();

              // Only load iterations from DataSet if this case is relevant
              let iterations: TestIteration[] = [];
              if (isRelevant && dataSetPath) {
                try {
                  iterations = loadTestIterationsFromDataSet(dataSetPath.toString().trim(), config.repositoryPath);
                } catch (dataSetError: any) {
                  console.error(`  ❌ Error in Test Case "${caseId}": ${dataSetError.message}`);
                  console.error(`     Skipping this test case due to invalid DataSet configuration.`);
                  skipCurrentCase = true;
                }
              }

              currentCase = {
                name: caseName || `TestCase ${caseId}`,
                module: module,
                jira: {
                  key: caseId,
                  summary: caseSummary || caseName || null,
                  executionFilePath: execFilePath,
                  description: null,
                  attachment: [],
                  status: executionResult || '', // Include execution status from Result column
                },
                steps: [],
                iterations: iterations,
              };
            }

            // Add steps if the case is relevant and not skipped (including the row with Case ID if it has an action)
            if (currentCase && isRelevant && !skipCurrentCase && (action || data || result)) {
              // Check if this is a CallTest action
              if (action && /calltest/i.test(action.toString())) {
                // Resolve the CallTest and insert the referenced steps inline
                const callTestSteps = handleCallTestAction(
                  action,
                  data,
                  config.repositoryPath,
                  new Set() // Fresh set for circular reference detection
                );
                currentCase.steps.push(...callTestSteps);
              } else {
                // Regular step - add as-is
                currentCase.steps.push({
                  action: action || '',
                  data: data || null,
                  result: result || null,
                });
              }
            }
          }

          // Push last relevant test case (only if not skipped)
          if (currentCase && isRelevant && !skipCurrentCase) {
            generatedTestCases.push(currentCase);
            testCaseFound = true; // Mark that we found and processed the test case
          }
        }
      }
    }

    // Construct JSON file name: <FolderName>.<FileName>.json
    const folderName = sprint ? `${plan}_${sprint}` : plan;
    const fileBase = path.basename(execFile, '.xlsx');
    const outputFileName = `${folderName}.${fileBase}.json`;

    const outputFilePath = path.join(config.outputPath, outputFileName);

    // Write the generated test cases as JSON
    fs.writeFileSync(outputFilePath, JSON.stringify(generatedTestCases, null, 2), 'utf8');

    console.log(`Created JSON: ${outputFilePath} (${generatedTestCases.length} test cases)`);
  }
}

/**
 * =============================================================================
 * EXECUTION BLOCK - Main Entry Point
 * =============================================================================
 *
 * This section contains the execution logic that runs when this file is executed directly
 * (e.g., via `ts-node excelToJson.ts` or `node excelToJson.js`)
 *
 * The block checks if this file is being run directly (not imported as a module)
 * and then executes the main processing function with configuration settings.
 */

// Check if this file is being executed directly (not imported)
const config_1 = require('./config');
if (require.main === module) {
  (async () => {
    try {
      // Accept CLI args: node excelToJson.js <repositoryPath> <testPlanPath> <outputPath>
      const [, , repositoryPathArg, testPlanPathArg, outputPathArg] = process.argv;
      const path = require('path');
      const config = {
        repositoryPath: repositoryPathArg || config_1.config.repositoryPath,
        testPlanPath: testPlanPathArg || config_1.config.testPlanPath,
        outputPath: path.resolve(process.cwd(), outputPathArg || 'testcases/excel'),
      };
      console.log(' Starting Test Case Generation...');
      console.log(' Configuration:');
      console.log(`   Repository Path: ${config.repositoryPath}`);
      console.log(`   Test Plan Path: ${config.testPlanPath}`);
      console.log(`   Output Path: ${config.outputPath}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await generateTestCasesFromAllPlans(config);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(' Test Case Generation completed successfully!');
    } catch (err) {
      console.error(' Error during processing:', err);
      process.exit(1);
    }
  })();
}
