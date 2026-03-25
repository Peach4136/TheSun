const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--backup-folder" || arg === "-b") {
      result.backupFolder = argv[i + 1] || "";
      i += 1;
    }
  }
  return result;
}

function readConfigValue(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not read ${label}`);
  }
  return match[1];
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row?.[header])).join(","))
  ];
  return lines.join("\r\n");
}

async function fetchTableRows(baseUrl, apiKey, tableName) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = `${baseUrl}/rest/v1/${tableName}?select=*&limit=${pageSize}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "count=exact"
      }
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
    }

    const page = await response.json();
    if (!Array.isArray(page)) {
      throw new Error(`Unexpected response for table ${tableName}`);
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = __dirname;
  const configPath = path.join(projectRoot, "supabase-config.js");
  const secretPath = path.join(projectRoot, "backup-secret.txt");
  const backupRoot = args.backupFolder || path.join(projectRoot, "backups");

  if (!fs.existsSync(configPath)) {
    throw new Error("Cannot find supabase-config.js");
  }
  if (!fs.existsSync(secretPath)) {
    throw new Error("Cannot find backup-secret.txt");
  }

  const configRaw = fs.readFileSync(configPath, "utf8");
  const secretRaw = fs.readFileSync(secretPath, "utf8");

  const supabaseUrl = readConfigValue(configRaw, /url:\s*"([^"]+)"/, "Supabase URL").replace(/\/$/, "");
  const backupKey = readConfigValue(secretRaw, /backupKey\s*=\s*"([^"]+)"/, "backup key");

  const tables = [
    "rooms",
    "user_roles",
    "bookings",
    "payments",
    "utility_readings",
    "other_costs",
    "rental_history",
    "reservations",
    "reservation_rooms",
    "daily_checkins",
    "settings"
  ];

  const timestamp = new Date().toISOString().replace(/:/g, "").replace(/\..+/, "").replace("T", "_");
  const targetDir = path.join(backupRoot, timestamp);
  fs.mkdirSync(targetDir, { recursive: true });

  const manifest = {
    created_at: new Date().toISOString(),
    source_url: supabaseUrl,
    tables: []
  };

  for (const table of tables) {
    const jsonFile = `${table}.json`;
    const csvFile = `${table}.csv`;
    try {
      const rows = await fetchTableRows(supabaseUrl, backupKey, table);
      fs.writeFileSync(path.join(targetDir, jsonFile), JSON.stringify(rows, null, 2), "utf8");
      fs.writeFileSync(path.join(targetDir, csvFile), toCsv(rows), "utf8");

      manifest.tables.push({
        table,
        rows: rows.length,
        json_file: jsonFile,
        csv_file: csvFile,
        status: "ok"
      });

      console.log(`Backed up ${table} (${rows.length} rows)`);
    } catch (error) {
      manifest.tables.push({
        table,
        rows: 0,
        json_file: jsonFile,
        csv_file: csvFile,
        status: "error",
        message: error.message
      });
      console.warn(`Failed to back up ${table}: ${error.message}`);
    }
  }

  fs.writeFileSync(path.join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log("");
  console.log(`Backup finished: ${targetDir}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
