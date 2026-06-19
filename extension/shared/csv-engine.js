(function () {
  const maxRows = 100;

  function parseCsv(text) {
    const rows = parseRows(text);
    if (rows.length === 0) {
      return emptyDataset();
    }

    const columns = rows[0].map((column) => column.trim()).filter(Boolean);
    const dataRows = rows
      .slice(1)
      .filter((row) => row.some((value) => String(value).trim() !== ''))
      .slice(0, maxRows)
      .map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ''])));

    return {
      id: `csv-${Date.now()}`,
      name: 'dataset.csv',
      columns,
      rows: dataRows,
      rowCount: dataRows.length,
      truncated: rows.length - 1 > maxRows
    };
  }

  function parseRows(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        value += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        continue;
      }

      value += char;
    }

    row.push(value);
    rows.push(row);
    return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''));
  }

  function emptyDataset() {
    return {
      id: `csv-${Date.now()}`,
      name: 'dataset.csv',
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false
    };
  }

  function applyBindings(actions, bindings, row) {
    return actions.map((action) => {
      const binding = bindings?.[action.id];
      if (!binding || action.type !== 'input') {
        return action;
      }

      const value = row?.[binding.column] ?? '';
      return {
        ...action,
        value,
        description: replaceInputDescription(action, value, binding.column),
        datasetBinding: {
          datasetId: binding.datasetId,
          column: binding.column
        }
      };
    });
  }

  function replaceInputDescription(action, value, column) {
    const baseDescription = action.description || window.FactoryActionNormalizer?.describeAction(action) || 'Input value';
    if (!baseDescription.startsWith('Input "')) {
      return `${baseDescription} using ${column}`;
    }

    return baseDescription.replace(/Input ".*?"/, `Input "${value}"`);
  }

  window.FactoryCsvEngine = {
    applyBindings,
    maxRows,
    parseCsv
  };
})();
