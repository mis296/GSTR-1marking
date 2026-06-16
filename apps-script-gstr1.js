const SPREADSHEET_ID = '13yOxJe9Tv7v6dmlZ3pybYTClQjiU3WnvOYonAL5KSBU';
const MASTER_SHEETS = ['Master', 'master'];
const DB_SHEETS = ['DB_Format', 'DB Format', 'DB'];
const DATA_SHEET = 'data';
const STEP_WISE_HEADER = 'Step Wise Tracking Applicable';

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '').trim();

    if (action === 'getDB') {
      syncNonStepWiseClients_();
      const dbSheet = getFirstExistingSheet_(DB_SHEETS);
      const trackingMap = getTrackingMap_();
      const data = readSheetObjects(dbSheet).filter(row => isStepWiseApplicableForRow_(row, trackingMap));
      return json({ success: true, data });
    }

    if (action === 'getCompleted') {
      const sheet = getSheet_(DATA_SHEET);
      return json({ success: true, data: sheet ? readSheetObjects(sheet) : [] });
    }

    if (action === 'syncStepWiseTracking') {
      return json({ success: true, result: syncNonStepWiseClients_() });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (payload.action === 'markDone') {
      const actualDate = payload.actualDate ? new Date(payload.actualDate) : new Date();
      appendCompletion_(payload, actualDate);
      updateActualDateInDb_(payload, actualDate);
      SpreadsheetApp.flush();
      return json({ success: true, actualDate: actualDate });
    }

    if (payload.action === 'syncStepWiseTracking') {
      SpreadsheetApp.flush();
      return json({ success: true, result: syncNonStepWiseClients_() });
    }

    if (payload.action === 'setStepWiseTracking') {
      const result = setStepWiseTrackingForClient_(payload);
      SpreadsheetApp.flush();
      return json({ success: true, result });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}

function syncNonStepWiseClients_() {
  const masterSheet = getFirstExistingSheet_(MASTER_SHEETS);
  if (!masterSheet) return { updatedClients: 0, updatedCells: 0, warning: 'Master sheet not found' };

  const values = masterSheet.getDataRange().getValues();
  if (values.length < 2) return { updatedClients: 0, updatedCells: 0, warning: 'Master sheet has no data rows' };

  const headers = values[0].map(String);
  const controlCol = getOrCreateCol_(masterSheet, headers, [STEP_WISE_HEADER]);
  const dateColumns = getPlannedActualColumns_(masterSheet, headers);
  const now = new Date();
  let updatedClients = 0;
  let updatedCells = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const controlValue = normalize_(row[controlCol - 1]).toLowerCase();
    const isNo = ['no', 'n', 'false', '0'].includes(controlValue);
    if (!isNo) continue;

    updatedClients++;
    dateColumns.forEach(col => {
      if (!row[col - 1]) {
        masterSheet.getRange(rowIndex + 1, col).setValue(now);
        updatedCells++;
      }
    });
  }

  return { updatedClients, updatedCells, timezone: Session.getScriptTimeZone() };
}

function setStepWiseTrackingForClient_(payload) {
  const masterSheet = getFirstExistingSheet_(MASTER_SHEETS);
  if (!masterSheet) throw new Error('Master sheet not found');

  const values = masterSheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Master sheet has no data rows');

  const headers = values[0].map(String);
  const controlCol = getOrCreateCol_(masterSheet, headers, [STEP_WISE_HEADER]);
  const keyCol = findCol_(headers, ['Unique Key', 'UNikey', 'Key'], -1);
  const clientCol = findCol_(headers, ['CLIENT', 'Client Name', 'Client'], -1);
  const plannedColumns = getColumnsByHeader_(headers, ['planned', 'planned date']);
  const actualColumns = getColumnsByHeader_(headers, ['actual date', 'actual', 'completed at']);
  const statusColumns = getColumnsByHeader_(headers, ['status']);
  const wantedKey = normalize_(payload.uniqueKey).toLowerCase();
  const wantedClient = normalize_(payload.clientName).toLowerCase();
  const applicableValue = normalize_(payload.applicable || 'Yes').toLowerCase();
  const isNo = ['no', 'n', 'false', '0'].includes(applicableValue);
  const now = payload.actualDate ? new Date(payload.actualDate) : new Date();

  let targetRow = -1;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const rowKey = keyCol > 0 ? normalize_(row[keyCol - 1]).toLowerCase() : '';
    const rowClient = clientCol > 0 ? normalize_(row[clientCol - 1]).toLowerCase() : '';

    if ((wantedKey && rowKey === wantedKey) || (wantedClient && rowClient === wantedClient)) {
      targetRow = rowIndex + 1;
      break;
    }
  }

  if (targetRow < 0) {
    // Fallback: scan the full row content in case the Master sheet has a non-standard header layout.
    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const rowText = values[rowIndex].map(normalize_).join(' ').toLowerCase();
      if ((wantedKey && rowText.includes(wantedKey)) || (wantedClient && rowText.includes(wantedClient))) {
        targetRow = rowIndex + 1;
        break;
      }
    }
  }

  if (targetRow < 0) {
    throw new Error('Client not found in Master sheet by Unique Key or Client Name');
  }

  masterSheet.getRange(targetRow, controlCol).setValue(isNo ? 'No' : 'Yes');

  let updatedCells = 0;
  if (isNo) {
    const rowValues = masterSheet.getRange(targetRow, 1, 1, masterSheet.getLastColumn()).getValues()[0];
    const inferredActualColumns = inferActualColumnsFromRow_(rowValues, statusColumns);
    const actualTargets = uniqueNumbers_(actualColumns.concat(inferredActualColumns));
    const plannedTargets = plannedColumns;

    plannedTargets.forEach(col => {
      const cell = masterSheet.getRange(targetRow, col);
      if (!cell.getValue()) {
        cell.setValue(now);
        updatedCells++;
      }
    });

    actualTargets.forEach(col => {
      const cell = masterSheet.getRange(targetRow, col);
      if (!cell.getValue()) {
        cell.setValue(now);
        updatedCells++;
      }
    });

    if (actualTargets.length === 0) {
      const actualCol = getOrCreateCol_(masterSheet, headers, ['Auto Actual Date']);
      const cell = masterSheet.getRange(targetRow, actualCol);
      if (!cell.getValue()) {
        cell.setValue(now);
        updatedCells++;
      }
    }

    statusColumns.forEach(col => masterSheet.getRange(targetRow, col).setValue('Completed'));

    // If the row has a literal Pending cell but no Status header, update it too.
    rowValues.forEach((value, index) => {
      if (normalize_(value).toLowerCase() === 'pending') {
        masterSheet.getRange(targetRow, index + 1).setValue('Completed');
      }
    });

    appendCompletion_({
      uniqueKey: payload.uniqueKey || '',
      clientName: payload.clientName || '',
      step: 'Step Wise Tracking Not Applicable - Auto Completed',
      doerName: payload.doerName || '',
      doerEmail: payload.doerEmail || '',
      status: 'Completed'
    }, now);
  }

  return {
    row: targetRow,
    stepWiseTrackingApplicable: isNo ? 'No' : 'Yes',
    updatedCells,
    timezone: Session.getScriptTimeZone()
  };
}

function getColumnsByHeader_(headers, names) {
  const cols = [];
  headers.forEach((header, index) => {
    const clean = normalize_(header).toLowerCase();
    if (names.some(name => clean.includes(String(name).toLowerCase()))) {
      cols.push(index + 1);
    }
  });
  return cols;
}

function inferActualColumnsFromRow_(rowValues, statusColumns) {
  const cols = [];

  rowValues.forEach((value, index) => {
    if (isDateLike_(value)) {
      const nextValue = rowValues[index + 1];
      if (index + 2 <= rowValues.length && !nextValue) {
        cols.push(index + 2);
      }
    }
  });

  statusColumns.forEach(statusCol => {
    const beforeStatusCol = statusCol - 1;
    if (beforeStatusCol > 0 && !rowValues[beforeStatusCol - 1]) {
      cols.push(beforeStatusCol);
    }
  });

  rowValues.forEach((value, index) => {
    if (normalize_(value).toLowerCase() === 'pending' && index > 0 && !rowValues[index - 1]) {
      cols.push(index);
    }
  });

  return uniqueNumbers_(cols);
}

function isDateLike_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return true;
  const text = normalize_(value);
  return /^\d{1,2}\/\d{1,2}\/\d{4}/.test(text) || /^\d{4}-\d{2}-\d{2}/.test(text);
}

function uniqueNumbers_(arr) {
  return Array.from(new Set(arr.filter(num => Number(num) > 0))).sort((a, b) => a - b);
}

function getTrackingMap_() {
  const masterSheet = getFirstExistingSheet_(MASTER_SHEETS);
  const map = { byKey: {}, byClient: {} };
  if (!masterSheet) return map;

  const values = masterSheet.getDataRange().getValues();
  if (values.length < 2) return map;

  const headers = values[0].map(String);
  const keyCol = findCol_(headers, ['Unique Key', 'UNikey', 'Key'], -1);
  const clientCol = findCol_(headers, ['CLIENT', 'Client Name', 'Client'], -1);
  const controlCol = getOrCreateCol_(masterSheet, headers, [STEP_WISE_HEADER]);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rawControl = normalize_(row[controlCol - 1]).toLowerCase();
    const applicable = rawControl === '' || ['yes', 'y', 'true', '1'].includes(rawControl);
    const uniqueKey = keyCol > 0 ? normalize_(row[keyCol - 1]) : '';
    const clientName = clientCol > 0 ? normalize_(row[clientCol - 1]) : '';
    if (uniqueKey) map.byKey[uniqueKey.toLowerCase()] = applicable;
    if (clientName) map.byClient[clientName.toLowerCase()] = applicable;
  }

  return map;
}

function isStepWiseApplicableForRow_(row, trackingMap) {
  const uniqueKey = normalize_(row['Unique Key'] || row['UNikey'] || row['Key']).toLowerCase();
  const clientName = normalize_(row['CLIENT'] || row['Client Name'] || row['Client']).toLowerCase();

  if (uniqueKey && Object.prototype.hasOwnProperty.call(trackingMap.byKey, uniqueKey)) {
    return trackingMap.byKey[uniqueKey] !== false;
  }
  if (clientName && Object.prototype.hasOwnProperty.call(trackingMap.byClient, clientName)) {
    return trackingMap.byClient[clientName] !== false;
  }
  return true;
}

function getPlannedActualColumns_(sheet, headers) {
  let cols = [];
  headers.forEach((header, index) => {
    const clean = normalize_(header).toLowerCase();
    if (clean.includes('planned') || clean.includes('actual')) cols.push(index + 1);
  });

  if (cols.length === 0) {
    const plannedCol = headers.length + 1;
    const actualCol = headers.length + 2;
    sheet.getRange(1, plannedCol).setValue('Auto Planned Date');
    sheet.getRange(1, actualCol).setValue('Auto Actual Date');
    headers.push('Auto Planned Date', 'Auto Actual Date');
    cols = [plannedCol, actualCol];
  }
  return cols;
}

function appendCompletion_(payload, actualDate) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DATA_SHEET) || ss.insertSheet(DATA_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Unique Key', 'Client Name', 'Step', 'Doer Name', 'Doer Email', 'Status', 'Actual Date']);
  }
  sheet.appendRow([actualDate, payload.uniqueKey || '', payload.clientName || '', payload.step || '', payload.doerName || '', payload.doerEmail || '', payload.status || 'Completed', actualDate]);
}

function updateActualDateInDb_(payload, actualDate) {
  const sheet = getFirstExistingSheet_(DB_SHEETS);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(String);
  const keyCol = findCol_(headers, ['Unique Key', 'UNikey'], 1);
  const stepCol = findCol_(headers, ['Step'], 3);
  const actualCol = getOrCreateCol_(sheet, headers, ['Actual Date', 'Actual', 'Completed At']);
  const statusCol = getOrCreateCol_(sheet, headers, ['Status']);
  const wantedKey = normalize_(payload.uniqueKey);
  const wantedStep = normalizeStep_(payload.step || '');

  for (let row = 1; row < values.length; row++) {
    const rowKey = normalize_(values[row][keyCol - 1]);
    const rowStep = normalizeStep_(values[row][stepCol - 1] || '');
    if (rowKey === wantedKey && rowStep === wantedStep) {
      sheet.getRange(row + 1, actualCol).setValue(actualDate);
      sheet.getRange(row + 1, statusCol).setValue('Completed');
      return;
    }
  }
}

function readSheetObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  });
}

function getFirstExistingSheet_(names) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  for (const name of names) {
    const sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return null;
}

function getSheet_(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function findCol_(headers, names, fallback) {
  const idx = headers.findIndex(header => {
    const clean = normalize_(header).toLowerCase();
    return names.some(name => clean.includes(String(name).toLowerCase()));
  });
  return idx >= 0 ? idx + 1 : fallback;
}

function getOrCreateCol_(sheet, headers, names) {
  const existing = findCol_(headers, names, -1);
  if (existing > 0) return existing;
  const col = headers.length + 1;
  sheet.getRange(1, col).setValue(names[0]);
  headers.push(names[0]);
  return col;
}

function normalize_(value) {
  return String(value || '').trim();
}

function normalizeStep_(step) {
  return String(step || '').replace(/\s+/g, ' ').replace(/^step[-\s]*/i, 'step-').trim().toLowerCase();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}