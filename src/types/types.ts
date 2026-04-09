export type Evidence = {
  data: string;
  filename: string;
  contentType: string;
};

export type Iteration = {
  name: string;
  status: string;
  steps: {
    status: string;
    comment: string;
  }[]; // ✅ array, not tuple
  parameters: {
    name: string;
    value: string;
  }[]; // ✅ array, not tuple
};

export type ExcelIteration = {
  name: string;
  status: 'PASSED' | 'FAILED';
  iterationName?: string;
  failedAction?: string;
  errorMessage?: string;
  comment?: string;
  parameters?: {
    name: string;
    value: string;
  }[];
};

export type StepResult = {
  status: 'PASSED' | 'FAILED';
  comment?: string;
};

export type TestResult = {
  testKey: string;
  status: 'PASSED' | 'FAILED';
  comment: string;
  evidences?: Evidence[];
  iterations?: Iteration[];
  excelIterations?: ExcelIteration[];
  steps?: StepResult[]; // ✅ Added for step-wise reporting
};

//adding test cases= interfaces - 8/9/2025

export interface Attachment {
  content: string;
  filename: string;
  [key: string]: any;
}

export interface TestStep {
  id: string;
  action: string;
  data?: string | null;
  result?: string;
  testData?: Record<string, any>;
}

export interface JiraFields {
  key?: string;
  summary?: string;
  attachment?: Attachment[];
  [key: string]: any;
}

export interface TestCase {
  id: string;
  name?: string;
  executionStatus?: string;
  jira?: JiraFields;
  steps: TestStep[];
  iterations: any[];
  [key: string]: any;
}
