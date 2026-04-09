/**
 * Email Reporter Module
 * Export all email reporting utilities.
 */

export { EmailReporter } from './EmailReporter';
export { defaultEmailConfig, teamRecipients } from './emailConfig';
export type { EmailConfig } from './emailConfig';

// Re-export Excel Plan Report Generator for convenience
export { generateExcelPlanReports, buildExcelPlanReportData } from '../reporting/ExcelPlanReportGenerator';
export type { ExcelReportData, ExcelReportSummary, ExcelReportTestRow } from '../reporting/ExcelPlanReportGenerator';
