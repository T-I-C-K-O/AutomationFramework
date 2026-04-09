import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../helpers/logger';

export interface ExtractionResult {
  /** Auto-derived export name, e.g. "sample_detail_page" */
  exportName: string;
  /** label → elementId mapping */
  entries: Record<string, string>;
  /** Absolute path of the source config file */
  sourceFile: string;
}

/**
 * Extracts `elementId` → label mappings from Angular *-base.config.ts files.
 *
 * Can be used programmatically or run directly via:
 *   node ./node_modules/@rappit/ps-test-automation-base/dist/utils/ElementIdExtractor.js <folder-path> [output-dir]
 *
 * Usage:
 * ```ts
 * const extractor = new ElementIdExtractor();
 *
 * // Single file
 * const result = extractor.extract('/path/to/sample-detail-base.config.ts');
 *
 * // Scan a folder recursively for all *-base.config.ts files
 * const results = extractor.extractFromDirectory(
 *   './src/app/features',
 *   './generated-page-maps'
 * );
 * ```
 */
export class ElementIdExtractor {
  /**
   * Recursively find all *-base.config.ts files under a directory.
   */
  findBaseConfigs(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.findBaseConfigs(fullPath));
      } else if (entry.name.endsWith('-base.config.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Scan a directory recursively for all *-base.config.ts files,
   * extract elementId→label mappings, and write output .ts files.
   *
   * @param inputDir  - Root folder to scan recursively.
   * @param outputDir - Directory where generated .ts files are written.
   */
  extractFromDirectory(inputDir: string, outputDir: string): ExtractionResult[] {
    const resolvedInput = path.resolve(inputDir);
    const configFiles = this.findBaseConfigs(resolvedInput);

    if (configFiles.length === 0) {
      logger.info(`[ElementIdExtractor] No *-base.config.ts files found under ${resolvedInput}`);
      return [];
    }

    logger.info(`[ElementIdExtractor] Found ${configFiles.length} base config file(s) under ${resolvedInput}`);
    return this.extractAndWrite(configFiles, outputDir);
  }

  /**
   * Extract elementId→label mappings from one or more config files.
   *
   * @param filePaths - A single file path or an array of file paths.
   * @returns A single ExtractionResult for a string input,
   *          or an array of ExtractionResult for an array input.
   */
  extract(filePaths: string): ExtractionResult;
  extract(filePaths: string[]): ExtractionResult[];
  extract(filePaths: string | string[]): ExtractionResult | ExtractionResult[] {
    if (typeof filePaths === 'string') {
      return this.extractFromFile(filePaths);
    }
    return filePaths.map((fp) => this.extractFromFile(fp));
  }

  /**
   * Extract and write the output .ts files to a directory.
   *
   * @param filePaths - One or more config file paths.
   * @param outputDir - Directory where generated .ts files are written.
   */
  extractAndWrite(filePaths: string | string[], outputDir: string): ExtractionResult[] {
    const paths = typeof filePaths === 'string' ? [filePaths] : filePaths;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results: ExtractionResult[] = [];

    for (const fp of paths) {
      const result = this.extractFromFile(fp);
      const content = this.generateOutput(result.exportName, result.entries);
      const outFile = path.join(outputDir, `${result.exportName}.ts`);

      fs.writeFileSync(outFile, content, 'utf-8');
      logger.info(
        `[ElementIdExtractor] ${path.basename(fp)} → ${outFile} (${Object.keys(result.entries).length} elements)`
      );
      results.push(result);
    }

    return results;
  }

  // ── Core extraction ──────────────────────────────────────────────

  private extractFromFile(configFilePath: string): ExtractionResult {
    const resolved = path.resolve(configFilePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const dir = path.dirname(resolved);

    // Resolve the field-config import for label lookups
    const fieldConfigPath = this.resolveFieldConfigPath(content, dir);
    const fieldLabels = fieldConfigPath ? this.parseFieldConfig(fieldConfigPath) : new Map<string, string>();

    const entries: Record<string, string> = {};
    const elementIdRe = /elementId\s*:\s*['"`]([^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;

    while ((match = elementIdRe.exec(content)) !== null) {
      const elementId = match[1];
      const block = this.findContainingBlock(content, match.index);

      let label = this.extractProp(block, '\\blabel');
      if (!label) label = this.extractProp(block, 'pageTitle');

      // Resolve via fieldConfig spread reference
      if (!label) {
        const spreadMatch = block.match(/\.\.\.fieldConfig\[\s*['"`]([^'"`]+)['"`]\s*\]/);
        if (spreadMatch) {
          label = fieldLabels.get(spreadMatch[1]) ?? null;
        }
      }

      // Direct elementId → fieldConfig name match
      if (!label && fieldLabels.has(elementId)) {
        label = fieldLabels.get(elementId)!;
      }

      // Fallback: use elementId as label
      if (!label) label = elementId;

      entries[label] = elementId;
    }

    const exportName = this.deriveExportName(path.basename(resolved));
    return { exportName, entries, sourceFile: resolved };
  }

  // ── Private helpers ──────────────────────────────────────────────

  private resolveFieldConfigPath(baseConfigContent: string, baseConfigDir: string): string | null {
    const m = baseConfigContent.match(/import\s*\{[^}]*fieldConfig[^}]*\}\s*from\s*['"`]([^'"`]+)['"`]/);
    if (!m) return null;

    let importPath = m[1];
    if (!importPath.endsWith('.ts')) importPath += '.ts';
    const resolved = path.resolve(baseConfigDir, importPath);
    return fs.existsSync(resolved) ? resolved : null;
  }

  private parseFieldConfig(filePath: string): Map<string, string> {
    const labelMap = new Map<string, string>();
    const content = fs.readFileSync(filePath, 'utf-8');
    const nameRe = /name\s*:\s*['"`]([^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;

    while ((match = nameRe.exec(content)) !== null) {
      const block = this.findContainingBlock(content, match.index);
      const label = this.extractProp(block, 'label');
      if (label) labelMap.set(match[1], label);
    }

    return labelMap;
  }

  private findContainingBlock(content: string, position: number): string {
    let depth = 0;
    let start = position;

    for (let i = position; i >= 0; i--) {
      if (content[i] === '}') depth++;
      if (content[i] === '{') {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }

    depth = 0;
    let end = position;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    return content.substring(start, end + 1);
  }

  private extractProp(block: string, propName: string): string | null {
    const re = new RegExp(`${propName}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
    const m = block.match(re);
    return m ? m[1] : null;
  }

  private deriveExportName(configFileName: string): string {
    return configFileName.replace(/-base\.config\.ts$/, '').replace(/-/g, '_') + '_page';
  }

  private generateOutput(exportName: string, mapping: Record<string, string>): string {
    const entries = Object.entries(mapping)
      .map(([label, elementId]) => `  '${label}': '${elementId}'`)
      .join(',\n');

    return `export const ${exportName} = {\n${entries}\n};\n`;
  }
}

// ── CLI Entrypoint (only executes when run directly) ───────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputDir = args[0];
  const outputDir = args[1] || './page-objects/generated-objects';

  if (!inputDir) {
    console.log('');
    console.log('Usage:');
    console.log('  node ElementIdExtractor.js <folder-path> [output-dir]');
    console.log('');
    console.log('Arguments:');
    console.log('  folder-path   Root folder to scan recursively for *-base.config.ts files');
    console.log('  output-dir    Directory for generated .ts files (default: ./page-objects/base-objects)');
    console.log('');
    console.log('Examples:');
    process.exit(1);
  }

  const extractor = new ElementIdExtractor();
  const results = extractor.extractFromDirectory(inputDir, outputDir);

  if (results.length === 0) {
    console.log(`No *-base.config.ts files found under: ${path.resolve(inputDir)}`);
  } else {
    console.log(`\nProcessed ${results.length} config file(s):\n`);
    for (const result of results) {
      console.log(`  ✅ ${path.basename(result.sourceFile)}`);
      console.log(`     Export : ${result.exportName}`);
      console.log(`     Elements: ${Object.keys(result.entries).length}`);
      for (const [label, id] of Object.entries(result.entries)) {
        console.log(`       '${label}': '${id}'`);
      }
      console.log();
    }
    console.log(`Output directory: ${path.resolve(outputDir)}`);
  }
}
