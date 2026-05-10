from pathlib import Path

P = Path("src/app/data-matrix/page.tsx")

if not P.exists():
    raise RuntimeError("Missing src/app/data-matrix/page.tsx")

text = P.read_text(encoding="utf-8")

start = text.find("  async function runSqlQuery(queryOverride?: string)")
end = text.find("  function downloadSqlResults()", start)

if start == -1 or end == -1:
    raise RuntimeError("Could not find runSqlQuery block to replace.")

new_block = r'''  function splitSqlSelectList(value: string) {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of value) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;

      if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function stripSqlQuotes(value: string) {
    return String(value || "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }

  function compareSqlValues(left: any, operator: string, rightRaw: string) {
    const right = stripSqlQuotes(rightRaw);
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

    const a = bothNumeric ? leftNumber : String(left ?? "");
    const b = bothNumeric ? rightNumber : String(right ?? "");

    if (operator === "=") return a === b;
    if (operator === "!=" || operator === "<>") return a !== b;
    if (operator === ">") return a > b;
    if (operator === ">=") return a >= b;
    if (operator === "<") return a < b;
    if (operator === "<=") return a <= b;

    if (operator.toLowerCase() === "like") {
      const pattern = String(b).replaceAll("%", "").toLowerCase();
      return String(left ?? "").toLowerCase().includes(pattern);
    }

    return false;
  }

  function applySqlWhere(rows: any[], whereClause: string) {
    if (!whereClause.trim()) return rows;

    const conditions = whereClause
      .split(/\s+and\s+/i)
      .map((item) => item.trim())
      .filter(Boolean);

    return rows.filter((row) =>
      conditions.every((condition) => {
        const match = condition.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<|like)\s*(.+)$/i);
        if (!match) return false;

        const [, column, operator, value] = match;
        return compareSqlValues(row?.[column], operator, value);
      })
    );
  }

  function parseSqlAlias(expression: string) {
    const parts = expression.split(/\s+as\s+/i);
    return {
      body: parts[0].trim(),
      alias: (parts[1] || "").trim(),
    };
  }

  function aggregateSqlRows(rows: any[], selectClause: string, groupByClause: string) {
    const groupColumn = groupByClause.trim().split(/\s+/)[0];
    const expressions = splitSqlSelectList(selectClause);
    const groups = new Map<string, any[]>();

    for (const row of rows) {
      const key = String(row?.[groupColumn] ?? "");
      groups.set(key, [...(groups.get(key) || []), row]);
    }

    return Array.from(groups.entries()).map(([groupValue, groupRows]) => {
      const out: Record<string, any> = {};

      for (const expression of expressions) {
        const { body, alias } = parseSqlAlias(expression);

        if (body === groupColumn) {
          out[alias || groupColumn] = groupValue;
          continue;
        }

        if (/^count\(\*\)$/i.test(body)) {
          out[alias || "rows"] = groupRows.length;
          continue;
        }

        const avgMatch = body.match(/^avg\(([a-zA-Z0-9_]+)\)$/i);
        if (avgMatch) {
          const column = avgMatch[1];
          const values = groupRows.map((row) => Number(row?.[column])).filter(Number.isFinite);
          out[alias || `avg_${column}`] = values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;
          continue;
        }

        const minMatch = body.match(/^min\(([a-zA-Z0-9_]+)\)$/i);
        if (minMatch) {
          const column = minMatch[1];
          const values = groupRows
            .map((row) => row?.[column])
            .filter((value) => value !== undefined && value !== null && value !== "")
            .sort();
          out[alias || `min_${column}`] = values.length ? values[0] : null;
          continue;
        }

        const maxMatch = body.match(/^max\(([a-zA-Z0-9_]+)\)$/i);
        if (maxMatch) {
          const column = maxMatch[1];
          const values = groupRows
            .map((row) => row?.[column])
            .filter((value) => value !== undefined && value !== null && value !== "")
            .sort();
          out[alias || `max_${column}`] = values.length ? values[values.length - 1] : null;
          continue;
        }

        out[alias || body] = groupRows[0]?.[body] ?? null;
      }

      return out;
    });
  }

  function projectSqlRows(rows: any[], selectClause: string) {
    const select = selectClause.trim();

    if (select === "*") return rows.map((row) => ({ ...row }));

    const expressions = splitSqlSelectList(select);

    return rows.map((row) => {
      const out: Record<string, any> = {};

      for (const expression of expressions) {
        const { body, alias } = parseSqlAlias(expression);
        out[alias || body] = row?.[body] ?? null;
      }

      return out;
    });
  }

  function runSqlLite(query: string, rows: any[]) {
    const cleaned = query.trim().replace(/;+\s*$/, "").replace(/\s+/g, " ");
    const lower = cleaned.toLowerCase();

    const selectStart = lower.indexOf("select ");
    const fromIndex = lower.indexOf(" from matrix");

    if (selectStart !== 0 || fromIndex === -1) {
      throw new Error("Use syntax: SELECT ... FROM matrix ...");
    }

    const selectClause = cleaned.slice("select ".length, fromIndex).trim();
    const rest = cleaned.slice(fromIndex + " from matrix".length).trim();
    const restLower = rest.toLowerCase();

    function clause(name: string, nextNames: string[]) {
      const token = `${name} `;
      const startIndex = restLower.indexOf(token);
      if (startIndex === -1) return "";

      const valueStart = startIndex + token.length;
      const nextPositions = nextNames
        .map((next) => restLower.indexOf(`${next} `, valueStart))
        .filter((index) => index >= 0);

      const valueEnd = nextPositions.length ? Math.min(...nextPositions) : rest.length;
      return rest.slice(valueStart, valueEnd).trim();
    }

    const whereClause = clause("where", ["group by", "order by", "limit"]);
    const groupByClause = clause("group by", ["order by", "limit"]);
    const orderByClause = clause("order by", ["limit"]);
    const limitClause = clause("limit", []);

    let resultRows = applySqlWhere(rows.map((row) => ({ ...row })), whereClause);

    if (groupByClause) {
      resultRows = aggregateSqlRows(resultRows, selectClause, groupByClause);
    } else {
      resultRows = projectSqlRows(resultRows, selectClause);
    }

    if (orderByClause) {
      const [column, directionRaw] = orderByClause.split(/\s+/);
      const direction = String(directionRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      resultRows = sortRows(resultRows, column, direction);
    }

    const requestedLimit = Number(limitClause || 1000);
    const safeLimit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(1000, requestedLimit))
      : 1000;

    return resultRows.slice(0, safeLimit);
  }

  async function runSqlQuery(queryOverride?: string) {
    const query = String(queryOverride || sqlQuery || "").trim();

    if (!query) {
      setSqlError("Enter a SQL SELECT query first.");
      return;
    }

    if (!matrixRows.length) {
      setSqlError("Matrix rows are not loaded yet.");
      return;
    }

    const safetyError = isSafeSelectQuery(query);

    if (safetyError) {
      setSqlError(safetyError);
      setSqlRows([]);
      return;
    }

    setSqlBusy(true);
    setSqlError("");

    try {
      const resultRows = runSqlLite(query, matrixRows);
      setSqlRows(resultRows);
      setSqlQuery(query);
    } catch (error) {
      setSqlRows([]);
      setSqlError(error instanceof Error ? error.message : "SQL query failed.");
    } finally {
      setSqlBusy(false);
    }
  }

'''

text = text[:start] + new_block + text[end:]

P.write_text(text, encoding="utf-8")

print("Patched Data Matrix SQL Explorer to avoid importing alasql while keeping alasql installed.")