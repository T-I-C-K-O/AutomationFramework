/**
 * Test Management Integration Module
 * @module integrationLibrary/testManagement
 */

export { getTestFromExecution } from './TestExecutionProcessor';
export { getTestExecutionsFromTestPlan } from './TestPlanProcessor';
export { generateTestPlanReports } from '../../reporting/TestPlanReportGenerator';
export type { TestPlanResponse } from '../../reporting/TestPlanReportGenerator';
export { downloadAllAttachments } from './downloadAttachment';
export { extractFieldAndPage, enrichTestCaseWithExcel } from './readDataFromExcel';
export * from './xrayAPI';
