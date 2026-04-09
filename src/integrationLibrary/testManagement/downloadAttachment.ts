// downloadAttachments.ts
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { TestCase } from '../../types/types';

dotenv.config({ quiet: true });

export async function downloadAllAttachments(testcases: TestCase[], downloadFolder: string) {
  for (const testcase of testcases) {
    const caseId = testcase.jira?.key || testcase.id;
    const attachments = testcase.jira?.attachment || [];

    console.log(`Processing test case ${caseId}...`);

    if (!attachments.length) {
      console.log(`No attachments found for test case ${caseId}`);
      continue;
    }

    const caseFolder = path.join(downloadFolder, caseId);
    if (!fs.existsSync(caseFolder)) {
      fs.mkdirSync(caseFolder, { recursive: true });
    }

    for (const attachment of attachments) {
      const url = attachment.content;
      const fileName = `${caseId}-${attachment.filename}`;
      //const fileName = attachment.filename;
      const filePath = path.join(caseFolder, fileName);

      try {
        console.log(`Downloading from ${url}...`);

        const jiraEmail = process.env.JIRA_EMAIL;
        const JiraApiToken = process.env.JIRA_API_TOKEN;
        const jiraAuth = Buffer.from(`${jiraEmail}:${JiraApiToken}`).toString('base64');

        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: { Authorization: `Basic ${jiraAuth}` },
        });

        fs.writeFileSync(filePath, response.data);
        console.log(`Downloaded: ${fileName}`);
      } catch (error) {
        console.error(`Failed to download ${fileName}:`, error);
      }
    }
  }
}
