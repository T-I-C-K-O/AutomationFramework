/**
 * @fileoverview Playwright MCP Client
 *
 * Provides integration with Playwright MCP (Model Context Protocol) server
 * for AI-powered browser automation capabilities.
 *
 * Security Configuration:
 * - Uses "type": "stdio" for process-to-process communication (no network exposure)
 * - Restricts hosts via --allowed-hosts (default: localhost only)
 * - Restricts origins via --allowed-origins (configured via MCP_ALLOWED_ORIGINS env var)
 *
 * Features:
 * - Self-healing locators via accessibility snapshots
 * - Natural language browser interactions
 * - Visual validation and screenshot analysis
 * - Failure root cause analysis
 *
 * Environment Variables:
 * - MCP_ALLOWED_ORIGINS: Comma-separated list of allowed origins (required)
 * - MCP_ALLOWED_HOSTS: Comma-separated list of allowed hosts (default: localhost)
 * - MCP_DEBUG: Set to 'true' to enable debug logging
 *
 * @since 1.0.0
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../helpers/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface McpClientConfig {
  /** Allowed origins for browser automation (e.g., 'https://myapp.example.com') */
  allowedOrigins: string[];
  /** Allowed hosts for network connections (default: ['localhost']) */
  allowedHosts?: string[];
}

export interface McpClickParams {
  element: string; // Human-readable description
  ref: string; // Element reference from snapshot
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
}

export interface McpTypeParams {
  element: string;
  ref: string;
  text: string;
  submit?: boolean;
  slowly?: boolean;
}

export interface McpFillFormField {
  name: string;
  ref: string;
  type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
  value: string;
}

export interface McpNavigateParams {
  url: string;
}

export interface McpScreenshotParams {
  type?: 'png' | 'jpeg';
  fullPage?: boolean;
  element?: string;
  ref?: string;
  filename?: string;
}

export interface McpToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============================================================================
// MCP Client Class
// ============================================================================

/**
 * Client for interacting with Playwright MCP server.
 * Provides methods for AI-powered browser automation.
 *
 * Security: Uses stdio transport with restricted hosts and origins.
 */
export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private connecting = false;
  private config: McpClientConfig;

  constructor(config?: Partial<McpClientConfig>) {
    // Load configuration from environment variables or provided config
    this.config = {
      allowedOrigins: config?.allowedOrigins || this.parseEnvList('MCP_ALLOWED_ORIGINS'),
      allowedHosts: config?.allowedHosts || this.parseEnvList('MCP_ALLOWED_HOSTS', ['localhost']),
    };
  }

  /**
   * Parses a comma-separated environment variable into an array.
   */
  private parseEnvList(envVar: string, defaultValue: string[] = []): string[] {
    const value = process.env[envVar];
    if (!value) return defaultValue;
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Builds MCP server arguments with security restrictions.
   *
   * Configuration follows organization security requirements:
   * - --allowed-hosts: Restricts network connections (default: localhost only)
   * - --allowed-origins: Restricts which origins can be automated
   */
  private buildMcpArgs(): string[] {
    const args: string[] = ['@playwright/mcp@latest'];

    // Add allowed hosts (network-level restriction)
    const allowedHosts = this.config.allowedHosts || ['localhost'];
    for (const host of allowedHosts) {
      args.push('--allowed-hosts', host);
    }

    // Add allowed origins (browser-level restriction)
    for (const origin of this.config.allowedOrigins) {
      args.push('--allowed-origins', origin);
    }

    return args;
  }

  /**
   * Validates that required security configuration is present.
   */
  private validateConfig(): void {
    if (this.config.allowedOrigins.length === 0) {
      throw new Error(
        '[MCP] Security Error: MCP_ALLOWED_ORIGINS must be configured. ' +
          'Set the environment variable with your product URL(s). ' +
          'Example: MCP_ALLOWED_ORIGINS=https://myapp.example.com'
      );
    }

    logger.info('[MCPClient] Security configuration:');
    logger.info(`[MCPClient]   - Allowed hosts: ${(this.config.allowedHosts || ['localhost']).join(', ')}`);
    logger.info(`[MCPClient]   - Allowed origins: ${this.config.allowedOrigins.join(', ')}`);
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connects to the Playwright MCP server.
   * Automatically starts the MCP server process with security restrictions.
   *
   * Security:
   * - Uses stdio transport (no network exposure)
   * - Restricts allowed hosts and origins
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.info('[MCP] Already connected');
      return;
    }

    if (this.connecting) {
      logger.info('[MCP] Connection in progress, waiting...');
      while (this.connecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.connecting = true;

    try {
      // Validate security configuration before connecting
      this.validateConfig();

      logger.info('[MCP] Connecting to Playwright MCP server (stdio transport)...');

      // Build secure MCP arguments
      const mcpArgs = this.buildMcpArgs();
      logger.info(`[MCP] Server args: npx ${mcpArgs.join(' ')}`);

      // Create transport using stdio (no network exposure)
      // This ensures:
      // - No TCP ports are opened
      // - No network socket is exposed
      // - Communication is process-to-process only
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: mcpArgs,
        env: Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string')) as Record<
          string,
          string
        >,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'automation-framework',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect client to transport
      await this.client.connect(this.transport);

      this.connected = true;
      logger.info('[MCP] ✓ Connected to Playwright MCP server (secure mode)');

      // List available tools (for debugging)
      if (process.env.MCP_DEBUG === 'true') {
        const tools = await this.client.listTools();
        logger.info(`[MCP] Available tools: ${tools.tools.map((t) => t.name).join(', ')}`);
      }
    } catch (error) {
      logger.error(`[MCP] Failed to connect: ${error}`);
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Disconnects from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      // Close browser first
      await this.closeBrowser();

      // Close transport
      if (this.transport) {
        await this.transport.close();
      }

      this.connected = false;
      this.client = null;
      this.transport = null;

      logger.info('[MCP] ✓ Disconnected from Playwright MCP server');
    } catch (error) {
      logger.warn(`[MCP] Error during disconnect: ${error}`);
    }
  }

  /**
   * Checks if client is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // Tool Invocation
  // ============================================================================

  /**
   * Calls an MCP tool with the given parameters.
   */
  private async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    try {
      logger.info(`[MCP] Calling tool: ${name}`);

      const result = await this.client!.callTool({
        name: name,
        arguments: args,
      });

      if (result.isError) {
        const errorText = result.content?.[0]?.text || 'Unknown error';
        throw new Error(`MCP tool error: ${errorText}`);
      }

      return result as McpToolResult;
    } catch (error) {
      logger.error(`[MCP] Tool call failed: ${name} - ${error}`);
      throw error;
    }
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  /**
   * Navigates to a URL.
   */
  async navigate(url: string): Promise<void> {
    await this.callTool('browser_navigate', { url });
    logger.info(`[MCP] Navigated to: ${url}`);
  }

  /**
   * Navigates back to the previous page.
   */
  async navigateBack(): Promise<void> {
    await this.callTool('browser_navigate_back', {});
    logger.info('[MCP] Navigated back');
  }

  // ============================================================================
  // Page Snapshot & Analysis
  // ============================================================================

  /**
   * Gets the accessibility snapshot of the current page.
   * This is the primary way to understand page structure for AI analysis.
   */
  async getSnapshot(): Promise<string> {
    const result = await this.callTool('browser_snapshot', {});
    const snapshot = result.content?.[0]?.text || '';
    logger.info('[MCP] Got page snapshot');
    return snapshot;
  }

  /**
   * Gets console messages from the page.
   * Useful for error analysis.
   */
  async getConsoleMessages(): Promise<string> {
    const result = await this.callTool('browser_console_messages', {});
    return result.content?.[0]?.text || '';
  }

  /**
   * Gets network requests from the page.
   */
  async getNetworkRequests(): Promise<string> {
    const result = await this.callTool('browser_network_requests', {});
    return result.content?.[0]?.text || '';
  }

  // ============================================================================
  // Element Interactions
  // ============================================================================

  /**
   * Clicks an element identified by ref from snapshot.
   */
  async click(params: McpClickParams): Promise<void> {
    await this.callTool('browser_click', {
      element: params.element,
      ref: params.ref,
      button: params.button,
      doubleClick: params.doubleClick,
    });
    logger.info(`[MCP] Clicked: ${params.element}`);
  }

  /**
   * Hovers over an element.
   */
  async hover(element: string, ref: string): Promise<void> {
    await this.callTool('browser_hover', { element, ref });
    logger.info(`[MCP] Hovered: ${element}`);
  }

  /**
   * Types text into an element.
   */
  async type(params: McpTypeParams): Promise<void> {
    await this.callTool('browser_type', {
      element: params.element,
      ref: params.ref,
      text: params.text,
      submit: params.submit,
      slowly: params.slowly,
    });
    logger.info(`[MCP] Typed into: ${params.element}`);
  }

  /**
   * Fills multiple form fields at once.
   */
  async fillForm(fields: McpFillFormField[]): Promise<void> {
    await this.callTool('browser_fill_form', { fields });
    logger.info(`[MCP] Filled form with ${fields.length} fields`);
  }

  /**
   * Selects an option in a dropdown.
   */
  async selectOption(element: string, ref: string, values: string[]): Promise<void> {
    await this.callTool('browser_select_option', { element, ref, values });
    logger.info(`[MCP] Selected: ${values.join(', ')} in ${element}`);
  }

  /**
   * Presses a key on the keyboard.
   */
  async pressKey(key: string): Promise<void> {
    await this.callTool('browser_press_key', { key });
    logger.info(`[MCP] Pressed key: ${key}`);
  }

  /**
   * Drags from one element to another.
   */
  async drag(startElement: string, startRef: string, endElement: string, endRef: string): Promise<void> {
    await this.callTool('browser_drag', {
      startElement,
      startRef,
      endElement,
      endRef,
    });
    logger.info(`[MCP] Dragged from ${startElement} to ${endElement}`);
  }

  // ============================================================================
  // Screenshots & Visual
  // ============================================================================

  /**
   * Takes a screenshot of the current page or element.
   */
  async takeScreenshot(params: McpScreenshotParams = {}): Promise<string> {
    const result = await this.callTool('browser_take_screenshot', {
      type: params.type || 'png',
      fullPage: params.fullPage,
      element: params.element,
      ref: params.ref,
      filename: params.filename,
    });

    // Return base64 image data or filename
    const content = result.content?.[0];
    if (content?.data) {
      logger.info('[MCP] Screenshot captured (base64)');
      return content.data;
    }
    if (content?.text) {
      logger.info(`[MCP] Screenshot saved: ${content.text}`);
      return content.text;
    }

    return '';
  }

  // ============================================================================
  // Waiting
  // ============================================================================

  /**
   * Waits for text to appear on the page.
   */
  async waitForText(text: string): Promise<void> {
    await this.callTool('browser_wait_for', { text });
    logger.info(`[MCP] Found text: ${text}`);
  }

  /**
   * Waits for text to disappear from the page.
   */
  async waitForTextGone(text: string): Promise<void> {
    await this.callTool('browser_wait_for', { textGone: text });
    logger.info(`[MCP] Text disappeared: ${text}`);
  }

  /**
   * Waits for a specified time in seconds.
   */
  async wait(seconds: number): Promise<void> {
    await this.callTool('browser_wait_for', { time: seconds });
    logger.info(`[MCP] Waited ${seconds} seconds`);
  }

  // ============================================================================
  // Tab Management
  // ============================================================================

  /**
   * Lists all browser tabs.
   */
  async listTabs(): Promise<string> {
    const result = await this.callTool('browser_tabs', { action: 'list' });
    return result.content?.[0]?.text || '';
  }

  /**
   * Creates a new tab.
   */
  async newTab(): Promise<void> {
    await this.callTool('browser_tabs', { action: 'new' });
    logger.info('[MCP] New tab created');
  }

  /**
   * Closes a tab by index.
   */
  async closeTab(index?: number): Promise<void> {
    await this.callTool('browser_tabs', { action: 'close', index });
    logger.info('[MCP] Tab closed');
  }

  /**
   * Selects a tab by index.
   */
  async selectTab(index: number): Promise<void> {
    await this.callTool('browser_tabs', { action: 'select', index });
    logger.info(`[MCP] Selected tab ${index}`);
  }

  // ============================================================================
  // File Upload & Dialog Handling
  // ============================================================================

  /**
   * Uploads files.
   */
  async uploadFiles(paths: string[]): Promise<void> {
    await this.callTool('browser_file_upload', { paths });
    logger.info(`[MCP] Uploaded ${paths.length} file(s)`);
  }

  /**
   * Handles a dialog (alert, confirm, prompt).
   */
  async handleDialog(accept: boolean, promptText?: string): Promise<void> {
    await this.callTool('browser_handle_dialog', { accept, promptText });
    logger.info(`[MCP] Dialog ${accept ? 'accepted' : 'dismissed'}`);
  }

  // ============================================================================
  // Browser Control
  // ============================================================================

  /**
   * Resizes the browser window.
   */
  async resize(width: number, height: number): Promise<void> {
    await this.callTool('browser_resize', { width, height });
    logger.info(`[MCP] Resized browser to ${width}x${height}`);
  }

  /**
   * Closes the browser.
   */
  async closeBrowser(): Promise<void> {
    try {
      await this.callTool('browser_close', {});
      logger.info('[MCP] Browser closed');
    } catch {
      // Browser may already be closed
    }
  }

  /**
   * Evaluates JavaScript on the page.
   */
  async evaluate(fn: string, element?: string, ref?: string): Promise<string> {
    const result = await this.callTool('browser_evaluate', {
      function: fn,
      element,
      ref,
    });
    return result.content?.[0]?.text || '';
  }

  // ============================================================================
  // AI-Powered Features
  // ============================================================================

  /**
   * Finds an element by description using the accessibility snapshot.
   * Returns the element reference that can be used in other commands.
   */
  async findElementByDescription(description: string): Promise<string | null> {
    const snapshot = await this.getSnapshot();

    // Parse snapshot to find matching element
    // The snapshot contains lines like: "- button "Login" [ref=button[1]]"
    const lines = snapshot.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const lowerDesc = description.toLowerCase();

      // Check if line contains the description
      if (lowerLine.includes(lowerDesc)) {
        // Extract ref from line, e.g., [ref=button[1]]
        const refMatch = line.match(/\[ref=([^\]]+)\]/);
        if (refMatch) {
          logger.info(`[MCP] Found element "${description}" → ref: ${refMatch[1]}`);
          return refMatch[1];
        }
      }
    }

    logger.warn(`[MCP] Element not found by description: ${description}`);
    return null;
  }

  /**
   * Performs an action described in natural language.
   * Uses snapshot to find element and execute action.
   */
  async performNaturalLanguageAction(instruction: string): Promise<boolean> {
    // const snapshot = await this.getSnapshot();

    // Parse instruction to determine action type
    const lowerInstruction = instruction.toLowerCase();

    if (lowerInstruction.includes('click')) {
      // Extract what to click
      const clickMatch = instruction.match(/click\s+(?:on\s+)?(?:the\s+)?(.+)/i);
      if (clickMatch) {
        const target = clickMatch[1].trim();
        const ref = await this.findElementByDescription(target);
        if (ref) {
          await this.click({ element: target, ref });
          return true;
        }
      }
    }

    if (lowerInstruction.includes('type') || lowerInstruction.includes('enter') || lowerInstruction.includes('fill')) {
      // Extract field and value
      const typeMatch = instruction.match(/(?:type|enter|fill)\s+["']?([^"']+)["']?\s+(?:in|into)\s+(?:the\s+)?(.+)/i);
      if (typeMatch) {
        const text = typeMatch[1].trim();
        const target = typeMatch[2].trim();
        const ref = await this.findElementByDescription(target);
        if (ref) {
          await this.type({ element: target, ref, text });
          return true;
        }
      }
    }

    logger.warn(`[MCP] Could not interpret instruction: ${instruction}`);
    return false;
  }

  /**
   * Analyzes page state for debugging.
   * Returns structured information about the current page.
   */
  async analyzePageState(): Promise<{
    snapshot: string;
    consoleMessages: string;
    networkRequests: string;
  }> {
    const [snapshot, consoleMessages, networkRequests] = await Promise.all([
      this.getSnapshot(),
      this.getConsoleMessages(),
      this.getNetworkRequests(),
    ]);

    return { snapshot, consoleMessages, networkRequests };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton MCP client instance.
 * Use this for all MCP operations.
 */
export const mcpClient = new McpClient();

export default mcpClient;
