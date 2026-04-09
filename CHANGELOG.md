## [1.0.4] - 2026-02-17

### Changed
- Updated publishConfig for npm registry
- Refactored excelTestPlanProcessor.ts
- Replaced processExecutionSheets with generateTestCasesFromExecutionSheets
- Added direct test case generation from execution sheets

## [1.0.5] - 2026-02-18
- Handled the goto / navigate action with the storage state
- Handled the custom function handler scenario

## [1.0.6] - 2026-02-22
- Segregated the auth manager from ps-tests to the ps-test-automation-base

## [1.0.7] - 2026-02-26
- Force true is removed for accordian table clicks to avoid stale element reference errors. If double click fails, it will try single click to activate edit mode
- Added the test step error formatter to get the better understanding on the error details
- Added the timeouts in all the action handlers
- Handled the network idle with the environment variable

## [1.0.8] -2026-03-03
- Updating dropdown by removing the close.dropdown() to make dropdown focused
- Handled the multiple click in single line. 
- Updated the validate action handler into the validate assert action handler
- Handled the both Excel and Xray report with same destination and same format , included Email report using nodemailer (SMTP).

## [1.0.9] -2026-03-12
- Handled the Cookie based authentication in the API handlers

## [1.0.10] -2026-03-12
- Handled the retry analayzer issue fix of the API 

## [1.0.10] -2026-03-17
- Updated Testplanreport handler , accordian dropdown issue ,removing check action handler expected results

## [1.0.10] -2026-03-17
- Updated Testplanreport handler , accordian dropdown issue ,removing check action handler expected results

## [1.0.11] -2026-03-17
Updated Testplanreport handler , accordian dropdown issue ,removing check action handler expected results

## [1.0.12] -2026-03-17
Updated Testplanreport handler , accordian dropdown issue ,removing check action handler expected results

## [1.0.13] -2026-03-17
-Dropdown issues for the Hoyer related dropdowns

## [1.0.14] -2026-03-19
- Provided the fix for the email template issues
- Supported the page object creation using the config ts file
- Supported the test case creation using the config ts file
- Updated the validateAssertActionHandler to handle the multiple elements validation
- Updated the test execution fetching from hardcoded to the dynamic fetching from the test plan directory of the user

## [1.0.15] -2026-03-25
- Provided the fix for the generated test cases
- The Report generation for the test plan in excel and xray in a similar format , Click action hadnelr to handle multiple pages if Pop up is there .
- Provided the fix for the module name in the report page

## [1.0.16] -2026-03-30
- Updated the email template to handle the environment variable and added the environment details in the email report