import { BaseActionHandler } from '../BaseActionHandler';
import { handleAPIAction } from '../../integrationLibrary/api/restServices/apiHandler';
import { logger } from '../../helpers/logger';

/**
 * APIActionHandler
 *
 * Handles API/REST service actions within test cases. Enables making HTTP
 * requests (GET, POST, PUT, DELETE) directly from test steps for API testing
 * or backend data setup/teardown.
 *
 * Supported Keywords: `api`, `get`, `post`, `put`, `delete`
 *
 * Usage Examples:
 * | Action                                              | Data                                                                                                                                    | Expected Result                                                              |
 * |-----------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
 * | Trigger the POST request of create user             | `{"URL": "{{url}}/rest/users", "Method": "POST", "Header": {"Authorization": "Bearer {{token}}"}, "Body": {"name": "John"}}`           | `{"StatusCode": 201, "StoreFields": {"sid": "userSid"}}`                     |
 * | Trigger the GET request of fetch user details       | `{"URL": "{{url}}/rest/users/{{userSid}}", "Method": "GET", "Header": {"Authorization": "Bearer {{token}}"}}`                           | `{"StatusCode": 200, "ValidateFields": {"name": "equals:John"}}`             |
 * | Trigger the PUT request of update user              | `{"URL": "{{url}}/rest/users/{{userSid}}", "Method": "PUT", "Header": {"Authorization": "Bearer {{token}}"}, "Body": {"name": "Jane"}}` | `{"StatusCode": 200}`                                                        |
 * | Trigger the DELETE request of remove user           | `{"URL": "{{url}}/rest/users/{{userSid}}", "Method": "DELETE", "Header": {"Authorization": "Bearer {{token}}"}}`                        | `{"StatusCode": 204}`                                                        |
 *
 * Data Format (Request Configuration):
 * ```json
 * {
 *   "URL": "{{url}}/rest/api/endpoint",
 *   "Method": "POST",
 *   "Header": {
 *     "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
 *     "Content-Type": "application/json"
 *   },
 *   "Body": {
 *     "key": "value"
 *   }
 * }
 * ```
 *
 * Expected Result Format (Validation Configuration):
 * ```json
 * {
 *   "StatusCode": 200,
 *   "ValidateFields": {
 *     "name": "equals:John",
 *     "sid": "notNull",
 *     "status": "string"
 *   },
 *   "StoreFields": {
 *     "sid": "storedSid"
 *   }
 * }
 * ```
 *
 * Supported HTTP Methods:
 * | Method   | Use Case                     | Body Required |
 * |----------|------------------------------|---------------|
 * | GET      | Retrieve data                | No            |
 * | POST     | Create resource / Query data | Yes           |
 * | PUT      | Update entire resource       | Yes           |
 * | PATCH    | Partial update               | Yes           |
 * | DELETE   | Remove resource              | Optional      |
 *
 * Variable Interpolation:
 * - Use `{{variableName}}` for dynamic values
 * - `{{url}}` - Base URL from environment config
 * - `{{token}}` or `{{YOUR_TOKEN_HERE}}` - Authentication token
 * - `{{storedValue}}` - Value stored from previous response
 *
 * Key Features:
 * - RESTful HTTP methods: GET, POST, PUT, DELETE, PATCH
 * - Request configuration via Data field (URL, Method, Header, Body)
 * - Response validation via Expected Result (StatusCode, ValidateFields)
 * - Store response fields for use in subsequent steps (StoreFields)
 * - Delegates to apiHandler for actual HTTP execution
 *
 * Notes:
 * - See docs/API-Test-Design-Guide.md for complete documentation
 * - API calls run within the Playwright page context
 * - Supports variable substitution in URL, headers, and body
 *
 * @see docs/API-Test-Design-Guide.md for complete API testing guide
 * @see handleAPIAction for the underlying HTTP implementation
 * @since 1.0.0
 */
export class APIActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    return /api|get|post|put|delete/i.test(action);
  }

  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    try {
      const handled = await handleAPIAction(this.page, action, data, step);
      return handled;
    } catch (error: any) {
      logger.error(`[APIActionHandler] Error in APIActionHandler: ${error.message}`);
      throw error;
    }
  }
}
