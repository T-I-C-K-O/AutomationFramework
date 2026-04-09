import path from 'path';
// import os from 'os';

// Get the user's home directory (C:\Users\username)
// const userHome = os.homedir();

// Get the framework root directory (automationframework folder)
const frameworkRoot = path.resolve(__dirname, '../../');

export const config = {
  repositoryPath: path.join(frameworkRoot, 'Automation', 'Test Repository'),
  testPlanPath: path.join(frameworkRoot, 'Automation', 'Test Plan', 'Test Plan -Sprint 1'),
  outputPath: path.join(frameworkRoot, 'testcases/excel'),
};
