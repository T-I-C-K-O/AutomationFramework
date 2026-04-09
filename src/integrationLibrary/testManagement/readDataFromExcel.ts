import * as path from 'path';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { TestCase, TestStep } from '../../types/types';

// Extract field name and page name from action
export function extractFieldAndPage(action: string): { field: string; page: string } | null {
  // Support straight quotes (' ") and curly quotes (‘ ’ “ ”)
  const match = action.match(/[‘'’“"]([^‘'’“"]+)[‘'’“"].*?\b(\w+page|\w+\s+page)\b/i);
  if (!match) return null;

  const field = match[1].trim(); // e.g., "Country Code"
  const rawPage = match[2]; // e.g., "CountryDetail Page"

  const page = rawPage.replace(/\s*page/i, '').trim();
  return { field, page };
}

// Main enrichment function
export function enrichTestCaseWithExcel(testCase: TestCase, baseDir: string): TestCase {
  console.log(`\nProcessing TestCase: ${testCase.jira?.key}`);

  const testCaseKey = testCase.jira?.key;
  if (!testCaseKey) {
    console.warn(`Test case key missing for ${testCase.id}`);
    return testCase;
  }

  const pageDrivenSteps: TestStep[] = testCase.steps.filter((s) => s.action && /\b\w+\s*page\b/i.test(s.action));

  if (pageDrivenSteps.length === 0) {
    console.log(`No Page-driven steps found for test case ${testCaseKey}`);
    return testCase;
  }

  const testDataFolder = path.join(baseDir);

  if (!fs.existsSync(testDataFolder)) {
    console.warn(`Test Data folder not found at ${testDataFolder}`);
    return testCase;
  }

  const excelFiles: { file: string; mtime: number }[] = [];
  const possibleFolders = [testDataFolder, path.join(testDataFolder, testCaseKey)];

  for (const folder of possibleFolders) {
    if (fs.existsSync(folder)) {
      const files = fs
        .readdirSync(folder)
        .filter((f) => f.toLowerCase().includes(testCaseKey.toLowerCase()) && f.endsWith('.xlsx'))
        .map((f) => ({
          file: path.join(folder, f),
          mtime: fs.statSync(path.join(folder, f)).mtime.getTime(),
        }));
      excelFiles.push(...files);
    }
  }

  if (excelFiles.length === 0) {
    console.warn(`No Excel files found in testdata/x-ray for test case ${testCaseKey}`);
    return testCase;
  }

  excelFiles.sort((a, b) => b.mtime - a.mtime);
  const filePath = excelFiles[0].file;
  console.log(` Using Excel file for ${testCaseKey}: ${filePath}`);

  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (error) {
    console.warn(`Error reading Excel file ${filePath}: ${error}`);
    return testCase;
  }

  // 🟢 Store iterations by rowNo + page
  const iterationMap: Record<string, any> = {};

  for (const step of pageDrivenSteps) {
    const ref = extractFieldAndPage(step.action!);
    if (!ref) {
      console.warn(`Could not parse field/page from action: ${step.action}`);
      continue;
    }

    const { field, page } = ref;

    const sheetName = workbook.SheetNames.find((s) => s.toLowerCase() === page.toLowerCase());

    if (!sheetName) {
      console.warn(`No sheet named '${page}' found in Excel for ${testCaseKey}`);
      continue;
    }

    let rows: any[];
    try {
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (error) {
      console.warn(`Error reading sheet '${sheetName}' in ${filePath}: ${error}`);
      continue;
    }

    if (rows.length === 0) {
      console.warn(`No data found in sheet '${sheetName}' of ${filePath}`);
      continue;
    }

    if (!rows[0].hasOwnProperty(field)) {
      console.warn(`Field '${field}' not found in sheet '${sheetName}' of ${filePath}`);
      continue;
    }

    rows.forEach((row, idx) => {
      const rowNo = (idx + 1).toString();
      const key = `${sheetName}_${rowNo}`;

      if (!iterationMap[key]) {
        iterationMap[key] = {
          rowNo,
          page: sheetName,
          parameters: [],
        };
      }

      // Add only this field/value pair
      iterationMap[key].parameters.push({
        name: field,
        value: row[field],
      });
    });
  }

  const iterations = Object.values(iterationMap);

  return {
    ...testCase,
    iterations,
  };
}
