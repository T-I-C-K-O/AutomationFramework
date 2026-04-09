/**
 * Email Reporter Configuration
 * Configure SMTP settings and recipients for test report emails.
 */

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean; // true for 465, false for other ports
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
}

/**
 * Default email configuration.
 * Override these values with environment variables or modify directly.
 */
export const defaultEmailConfig: EmailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '', // App password for Gmail
    },
  },
  from: `Rappit Automation Generation Engine <${process.env.SMTP_USER || 'automation@rappit.io'}>`,
  recipients: (process.env.EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
  cc: (process.env.EMAIL_CC || '').split(',').filter(Boolean),
  bcc: (process.env.EMAIL_BCC || '').split(',').filter(Boolean),
  subject: process.env.EMAIL_SUBJECT || `${process.env.PROJECT_NAME} Test Automation Report - ${new Date().toLocaleDateString()}`,
};

/**
 * Example recipients list - modify this or use environment variables
 */
export const teamRecipients = {
  qa: ['qa-team@company.com'],
  dev: ['dev-team@company.com'],
  management: ['manager@company.com'],
  all: ['qa-team@company.com', 'dev-team@company.com', 'manager@company.com'],
};
