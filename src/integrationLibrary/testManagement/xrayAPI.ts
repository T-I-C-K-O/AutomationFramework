import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from '../../helpers/logger'; // Assuming logger is defined in utils/logger
import type { TestResult } from '../../types/types';
import { TestPlanResponse } from '../../reporting/TestPlanReportGenerator';

dotenv.config({ quiet: true });

const { XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, XRAY_BASE_URL } = process.env;

// Validate environment variables
if (!XRAY_CLIENT_ID || !XRAY_CLIENT_SECRET || !XRAY_BASE_URL) {
  logger.error('[XrayAPI] Missing required Xray environment variables:');
  logger.error(`[XrayAPI] XRAY_CLIENT_ID: ${XRAY_CLIENT_ID ? 'Set' : 'Missing'}`);
  logger.error(`[XrayAPI] XRAY_CLIENT_SECRET: ${XRAY_CLIENT_SECRET ? 'Set' : 'Missing'}`);
  logger.error(`[XrayAPI] XRAY_BASE_URL: ${XRAY_BASE_URL || 'Missing'}`);
  throw new Error('Missing required Xray API configuration');
}

export async function getXrayAccessToken() {
  try {
    const res = await axios.post('https://xray.cloud.getxray.app/api/v2/authenticate', {
      client_id: XRAY_CLIENT_ID,
      client_secret: XRAY_CLIENT_SECRET,
    });
    return res.data; // returns a token string
  } catch (error) {
    logger.error(`[XrayAPI] Failed to fetch Xray access token: ${error}`);
    throw new Error('Unable to authenticate with Xray API');
  }
}

/**
 * Builds the GraphQL query to retrieve test executions for a given test plan key.
 * @param key Test plan key (e.g., "APS-123")
 * @returns GraphQL query string
 */
export function buildGetTestPlanQuery(key: string): string {
  return `
      query {
        getTestPlans(jql: "key = ${key}", limit: 1) {
          results {
            testExecutions(limit: 50) {
              results {
                jira(fields: ["key", "summary"])
              }
            }
          }
        }
      }`;
}

/**
 * Builds the GraphQL query to retrieve detailed test execution information
 * including test runs, steps and iterations.
 * @param key Jira Test Execution key
 * @param testRunsLimit Max number of test runs to fetch (default 50)
 * @param iterationsLimit Max number of iterations to fetch (default 50)
 * @returns GraphQL query string
 */
export function buildTestExecutionDetailsQuery(key: string, testRunsLimit = 50, iterationsLimit = 50): string {
  return `
      query { 
        getTestExecutions(jql: "key = ${key}", limit: 1) { 
          results { 
            jira(fields: ["key", "summary", "description", "attachment"]) 
            testRuns(limit: ${testRunsLimit}) { 
              results { 
                assigneeId 
                status {name}
                test { 
                  jira(fields: ["key", "summary", "description", "attachment"]) 
                } 
                steps { 
                  id 
                  action 
                  data 
                  result 
                } 
                iterations(limit: ${iterationsLimit}) { 
                  results { 
                    rank 
                    parameters { 
                      name 
                      value 
                    } 
                  } 
                } 
              } 
            } 
          } 
        } 
      }`;
}

export async function getTestCaseSteps(testKey: string) {
  try {
    const token = await getXrayAccessToken();
    const query = `
      query {
        getTests(jql: "key = ${testKey}", limit: 1) {
          results {
            steps {
              id
              action
              data
              result
            }
          }
        }
      }
    `;
    const response = await axios.post(
      'https://xray.cloud.getxray.app/api/v2/graphql',
      { query },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data?.data?.getTests?.results?.[0]?.steps || [];
  } catch (error) {
    logger.error(`[XrayAPI] Failed to fetch test case steps for key ${testKey}: ${error}`);
    throw new Error(`Unable to fetch test case steps for key ${testKey}`);
  }
}

export async function getTestCasesFromTestPlan(testPlanKey: string): Promise<string[]> {
  try {
    const token = await getXrayAccessToken();

    const query = `
      query {
        getTestPlans(jql: "key = ${testPlanKey}", limit: 1) {
          results {
            tests(limit: 100) {
              results {
                jira(fields: ["key" ,"summary" ,"description"])
                steps {
                  action
                  data
                  result
                }
              }
            }
          }
        }
      }`;

    const response = await axios.post(
      `https://xray.cloud.getxray.app/api/v2/graphql`,
      { query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let testCases =
      response.data?.data?.getTestPlans?.results?.[0]?.tests?.results ||
      // ?.map(
      //   (t: any) => t.jira.key)

      [];
    // Clean up step fields (parse if stringified JSON)
    testCases = testCases.map((test: any) => {
      if (Array.isArray(test.steps)) {
        test.steps = test.steps.map((step: any) => {
          const cleanStep: any = { ...step };

          ['action', 'data', 'result'].forEach((field) => {
            if (typeof step[field] === 'string') {
              try {
                // if it's stringified JSON array/object, parse it
                cleanStep[field] = JSON.parse(step[field]);
              } catch {
                // otherwise keep as is
                cleanStep[field] = step[field];
              }
            }
          });

          return cleanStep;
        });
      }
      return test;
    });

    const saveDir = path.join(__dirname, '../testcases');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    const filePath = path.join(saveDir, `${testPlanKey}_testCases.json`);
    fs.writeFileSync(filePath, JSON.stringify(testCases, null, 2), 'utf-8');

    logger.info(`[XrayAPI] Test cases saved to ${filePath}`);

    return testCases;
  } catch (error) {
    logger.error(`[XrayAPI] Failed to fetch test cases from test plan ${testPlanKey}: ${error}`);
    throw new Error(`Unable to fetch test cases from test plan ${testPlanKey}`);
  }
}

export async function getTestCasesFromTestExecution(testExecutionKey: string): Promise<string[]> {
  try {
    const token = await getXrayAccessToken();
    const query = `
      query {
        getTestExecutions(jql: "key = ${testExecutionKey}", limit: 1) {
          results {
            id
            status
            startDate
            endDate
            duration
            tests {
              id
              status
            }
          }
        }
      }
    `;

    const response = await axios.post(
      `https://xray.cloud.getxray.app/api/v2/graphql`,
      { query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let testCases =
      response.data?.data?.getTestPlans?.results?.[0]?.tests?.results ||
      // ?.map(
      //   (t: any) => t.jira.key)
      [];
    // Clean up step fields (parse if stringified JSON)
    testCases = testCases.map((test: any) => {
      if (Array.isArray(test.steps)) {
        test.steps = test.steps.map((step: any) => {
          const cleanStep: any = { ...step };

          ['action', 'data', 'result'].forEach((field) => {
            if (typeof step[field] === 'string') {
              try {
                // if it's stringified JSON array/object, parse it
                cleanStep[field] = JSON.parse(step[field]);
              } catch {
                // otherwise keep as is
                cleanStep[field] = step[field];
              }
            }
          });

          return cleanStep;
        });
      }
      return test;
    });

    const saveDir = path.join(__dirname, '../testcases');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    const filePath = path.join(saveDir, `${testExecutionKey}_testCases.json`);
    fs.writeFileSync(filePath, JSON.stringify(testCases, null, 2), 'utf-8');

    logger.info(`[XrayAPI] Test cases saved to ${filePath}`);

    return testCases;
  } catch (error) {
    logger.error(`[XrayAPI] Failed to fetch test execution for key ${testExecutionKey}: ${error}`);
    throw new Error(`Unable to fetch test execution for key ${testExecutionKey}`);
  }
}

//  Get test cases as classifed file based on the execution
export async function getTestExecutionsFromTestPlan(testPlanKey: string): Promise<void> {
  try {
    const token = await getXrayAccessToken();

    // Step 1: Fetch Test Executions linked to Test Plan
    const queryExecutions = `
      query {
        getTestPlans(jql: "key = ${testPlanKey}", limit: 1) {
          results {
            testExecutions(limit: 50) {
              results {
                jira(fields: ["key", "summary"])
              }
            }
          }
        }
      }`;

    const execResponse = await axios.post(
      `https://xray.cloud.getxray.app/api/v2/graphql`,
      { query: queryExecutions },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const testExecutions = execResponse.data?.data?.getTestPlans?.results?.[0]?.testExecutions?.results || [];

    if (testExecutions.length === 0) {
      logger.warn(`[XrayAPI] No test executions found for test plan ${testPlanKey}`);
      return;
    }

    const saveDir = path.join(__dirname, '../testcases');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Step 2: For each Test Execution, fetch its Test Cases
    for (const exec of testExecutions) {
      const execKey = exec.jira.key;

      const queryTests = `
      query { 
    getTestExecutions(jql: \"key = ${execKey}", limit: 1) { 
      results { 
        jira(fields: [\"key\", \"summary\"]) 
        testRuns(limit: 50) { 
          results { 
            assigneeId 
            test { 
              jira(fields: [\"key\", \"summary\", \"description\"]) 
            } 
            steps { 
              id 
              action 
              data 
              result 
            } 
            iterations(limit: 50) { 
              results { 
                rank 
                parameters { 
                  name 
                  value 
                } 
              } 
            } 
          } 
        } 
      } 
    } 
  }`;

      const testsResponse = await axios.post(
        `https://xray.cloud.getxray.app/api/v2/graphql`,
        { query: queryTests },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const testRuns = testsResponse.data?.data?.getTestExecutions?.results?.[0]?.testRuns?.results || [];

      const testCases = testRuns.map((run: any) => {
        const test = run.test || {};

        // Clean up step fields (parse JSON strings if needed)
        const steps = Array.isArray(run.steps)
          ? run.steps.map((step: any) => {
              const cleanStep: any = { ...step };
              ['action', 'data', 'result'].forEach((field) => {
                if (typeof step[field] === 'string') {
                  let value = step[field].trim();

                  value = value.replace(/^\|+|\|+$/g, '').trim();
                  try {
                    cleanStep[field] = JSON.parse(value);
                  } catch {
                    cleanStep[field] = value;
                  }
                }
              });
              return cleanStep;
            })
          : [];

        return {
          executionStatus: run.status?.name,
          jira: test.jira,
          steps,
          iterations: run.iterations?.results || [],
        };
      });

      // Step 3: Save each Test Execution's test cases to a JSON file
      const filePath = path.join(__dirname, '../testcases', `${execKey}_testCases.json`);
      fs.writeFileSync(filePath, JSON.stringify(testCases, null, 2), 'utf-8');

      logger.info(`[XrayAPI] Test cases for execution ${execKey} saved to ${filePath}`);
    }
  } catch (error) {
    logger.error(`[XrayAPI] Failed to fetch executions/cases from test plan ${testPlanKey}: ${error}`);
    throw new Error(`Unable to fetch executions/cases from test plan ${testPlanKey}`);
  }
}

/**
 * Upload test execution results to Xray Cloud
 * @param testExecutionKey Jira Test Execution key
 * @param results Array of test results
 */
export async function uploadXrayResults(testExecutionKey: string, results: TestResult[]) {
  if (!process.env.XRAY_CLIENT_ID || !process.env.XRAY_CLIENT_SECRET) {
    throw new Error('XRAY_CLIENT_ID and XRAY_CLIENT_SECRET must be set in environment variables');
  }

  // Step 1: Authenticate to Xray Cloud
  const token = await getXrayAccessToken();
  if (!token) throw new Error('Failed to get Xray Cloud token');

  // Step 2: Build the JSON payload (supporting iteration-level results)
  const payload = {
    testExecutionKey,
    // info: {
    //   summary: 'Automated Playwright Execution',
    //   description: 'Imported via Playwright automation',
    //   startDate: new Date().toISOString(),
    //   finishDate: new Date().toISOString(),
    // },
    tests: results.map((r) => {
      if (r.iterations && Array.isArray(r.iterations) && r.iterations.length > 0) {
        return {
          testKey: r.testKey,
          status: r.status,
          comment: r.comment,
          evidences: r.evidences,
          iterations: r.iterations.map((it: any) => ({
            status: it.status,
            steps: it.steps,
            parameters: it.parameters || undefined,
          })),
        };
      } else {
        return {
          testKey: r.testKey,
          status: r.status,
          comment: r.comment,
          evidences: r.evidences || undefined,
          steps: r.steps,
        };
      }
    }),
  };
  // console.log('XRAY PAYLOAD:', JSON.stringify(payload, null, 2));

  // Step 3: Send execution results to Xray
  try {
    const response = await axios.post('https://xray.cloud.getxray.app/api/v2/import/execution', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('Xray import response:', response.data);
  } catch (err: any) {
    console.error('Failed to upload results to Xray Cloud:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Fetches a test plan from Xray using the GraphQL API.
 *
 * @param {string} planKey - The key of the test plan to fetch.
 * @param {string} token - The authentication token for Xray API.
 * @returns {Promise<TestPlanResponse>} - A promise that resolves to the test plan response.
 * @throws {Error} - Throws an error if the API request fails.
 */
export async function fetchTestPlanFromXray(planKey: string, token: string): Promise<TestPlanResponse> {
  const url = 'https://xray.cloud.getxray.app/api/v2/graphql';

  const query = `
    query {
      getTestPlans(jql: "key = ${planKey}", limit: 1) {
        results {
          jira(fields: ["key", "summary"])
          testExecutions(limit: 10) {
            total
            results {
              jira(fields: ["key", "summary"])
              testRuns(limit: 50) {
                total
                results {
                  id
                  status { name }
                  comment
                  test { jira(fields: ["key", "summary"]) }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`❌ Failed to fetch from Xray: ${response.statusText}`);
  }

  return response.json() as Promise<TestPlanResponse>;
}
