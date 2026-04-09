import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';

// ✅ Use dynamic import for ESM-only 'open'
const open = async (target: string) => {
  const mod = await import('open');
  return mod.default(target);
};

const app = express();
app.use(cors());

// 📂 Folder where your reports are generated (uses cwd to work from any consuming project)
const REPORT_DIR = path.resolve(process.cwd(), 'testreports');
// console.log(`Using report directory: ${REPORT_DIR}`);

// Serve static HTML files directly
app.use('/testreports', express.static(REPORT_DIR, { index: false }));

// 🧩 API endpoint to get list of reports (recursively scan excel/ and xray/ folders)
app.get('/api/testreports', async (req, res) => {
  try {
    const files = await fs.promises.readdir(REPORT_DIR);
    const htmlReports = files
      .filter((f) => f.toLowerCase().endsWith('.html'))
      .sort((a, b) => fs.statSync(path.join(REPORT_DIR, b)).mtimeMs - fs.statSync(path.join(REPORT_DIR, a)).mtimeMs);
    res.json(htmlReports);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// 🖥️ Main web page
app.get('/', async (req, res) => {
  res.send(await renderReportsList());
});

// Also serve dashboard at /testreports/ and /testreports/index.html
app.get('/testreports/', async (req, res) => {
  res.send(await renderReportsList());
});

app.get('/testreports/index.html', async (req, res) => {
  res.send(await renderReportsList());
});

async function renderReportsList() {
  try {
    const files = await fs.promises.readdir(REPORT_DIR);
    const htmlFiles = files
      .filter((f) => f.endsWith('.html'))
      .sort((a, b) => fs.statSync(path.join(REPORT_DIR, b)).mtimeMs - fs.statSync(path.join(REPORT_DIR, a)).mtimeMs);
    if (htmlFiles.length === 0) {
      return `
        <html><body>
          <h2>No reports found yet</h2>
          <script>setTimeout(()=>location.reload(),5000)</script>
        </body></html>`;
    }

    return `
      <html>
        <head><title>Test Reports</title></head>
        <body>
          <h2>📊 Test Reports</h2>
          <ul>
            ${htmlFiles
              .map((f) => `<li><a href="/testreports/${encodeURIComponent(f)}" target="_blank">${f}</a></li>`)
              .join('')}
          </ul>
          <script>setTimeout(()=>location.reload(),5000)</script>
        </body>
      </html>`;
  } catch {
    return `<p>⚠️ Folder not found: ${REPORT_DIR}</p>`;
  }
}

/**
 * Start the report server
 * @param port - Port number (default: 3030)
 * @param openBrowser - Whether to open browser automatically (default: true)
 */
export async function startReportServer(port: number = 3030, openBrowser: boolean = true) {
  return new Promise<void>((resolve) => {
    app.listen(port, async () => {
      const serverUrl = `http://localhost:${port}`;
      console.log(` Report server running at: ${serverUrl}`);
      console.log(` Watching folder: ${REPORT_DIR}`);

      if (openBrowser) {
        const latest = getLatestReport();
        if (latest) {
          console.log(` Opening latest report: ${latest}`);
          await open(`${serverUrl}/testreports/${encodeURIComponent(latest)}`);
        } else {
          console.log('ℹ No reports found yet. Opening dashboard...');
          await open(serverUrl);
        }
      }

      // 👀 Watch for new reports
      let lastOpened = '';
      fs.watch(REPORT_DIR, (eventType, filename) => {
        if (filename && filename.endsWith('.html')) {
          const filePath = path.join(REPORT_DIR, filename);
          setTimeout(() => {
            if (fs.existsSync(filePath) && filename !== lastOpened) {
              console.log(` New report detected: ${filename}`);
              if (openBrowser) {
                open(`http://localhost:${port}/testreports/${encodeURIComponent(filename)}`);
              }
              lastOpened = filename;
            }
          }, 1500);
        }
      });

      resolve();
    });
  });
}

export function getLatestReport() {
  try {
    const files = fs.readdirSync(REPORT_DIR).filter((f) => f.endsWith('.html'));
    if (files.length === 0) return null;
    files.sort((a, b) => fs.statSync(path.join(REPORT_DIR, b)).mtimeMs - fs.statSync(path.join(REPORT_DIR, a)).mtimeMs);
    return files[0];
  } catch {
    return null;
  }
}

// 🚀 Only start server if this file is run directly (not imported)
// This check works for CommonJS modules
if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3030', 10);
  startReportServer(PORT, true);
}
