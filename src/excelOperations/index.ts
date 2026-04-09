/**
 * Excel Operations Module - Excel file handling
 *
 * @module excelOperations
 */

export * from './config';
export { generateTestCasesFromAllPlans, generateTestCasesFromExecutionSheets } from './excelTestPlanProcessor';
export { getLatestReport , startReportServer } from '../reporting/reportServer';
export {
  readExecutionSheet,
  generateHtmlReportFromExcel,
  updateExcelResult,
  markCasesAsSkipped,
} from '../reporting/resultUpdater';
export type { ReportOptions } from '../reporting/resultUpdater';
