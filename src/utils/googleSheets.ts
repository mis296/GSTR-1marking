import Papa from 'papaparse';
import { Task } from '../types';

export const SHEET_ID = '13yOxJe9Tv7v6dmlZ3pybYTClQjiU3WnvOYonAL5KSBU';

// The task tab has been referred to as DB_Format / DB Format, but the published
// task columns currently resolve under DB. Try all safely and use the first one
// with real task rows for the logged-in email.
const CANDIDATE_SHEETS = ['DB_Format', 'DB Format', 'DB'];

type Row = string[];

const normalize = (value: unknown) => String(value ?? '').trim();

const findColumn = (headers: Row, names: string[], fallback: number) => {
  const index = headers.findIndex(header => {
    const clean = normalize(header).toLowerCase().replace(/\s+/g, ' ');
    return names.some(name => clean.includes(name));
  });

  return index >= 0 ? index : fallback;
};

const getStageNumber = (step: string) => {
  const match = step.match(/\d+/);
  return match ? Number(match[0]) : 999;
};

const parseRowsToTasks = (rows: Row[], email: string) => {
  if (rows.length < 2) return [];

  const headers = rows[0];
  const hasTaskHeaders = headers.some(header => normalize(header).toLowerCase().includes('unique key'))
    && headers.some(header => normalize(header).toLowerCase().includes('step'));

  // Skip master-like sheets that do not have task-format columns.
  if (!hasTaskHeaders && headers.length < 8) return [];

  const keyIndex = findColumn(headers, ['unique key', 'uniquekey'], 0);
  const plannedIndex = findColumn(headers, ['planned', 'planned date'], 1);
  const stepIndex = findColumn(headers, ['step', 'stage'], 2);
  const howIndex = findColumn(headers, ['how', 'instruction'], 3);
  const linkIndex = findColumn(headers, ['link', 'form link'], 5);
  const finalEmailIndex = findColumn(headers, ['final doer email'], -1);
  const doerEmailIndex = findColumn(headers, ['doer email', 'email', 'mail'], 7);
  const actualIndex = findColumn(headers, ['actual date', 'actual', 'completed at', 'status'], -1);
  const clientIndex = findColumn(headers, ['client'], 10);
  const emailToFind = email.toLowerCase().trim();

  const tasks = rows.slice(1).map((row) => {
    const finalEmail = finalEmailIndex >= 0 ? normalize(row[finalEmailIndex]).toLowerCase() : '';
    const doerEmail = doerEmailIndex >= 0 ? normalize(row[doerEmailIndex]).toLowerCase() : '';
    if (finalEmail !== emailToFind && doerEmail !== emailToFind) return null;

    const uniqueKey = normalize(row[keyIndex]);
    const step = normalize(row[stepIndex]);
    if (!uniqueKey || !step) return null;

    const actualValue = actualIndex >= 0 ? normalize(row[actualIndex]).toLowerCase() : '';
    const isCompleted = Boolean(actualValue && actualValue !== 'pending');

    return {
      uniqueKey,
      clientName: normalize(row[clientIndex]) || normalize(row[13]) || 'Untitled Client',
      plannedDate: normalize(row[plannedIndex]),
      step,
      how: normalize(row[howIndex]),
      link: normalize(row[linkIndex]),
      doerEmail: doerEmail || finalEmail,
      status: isCompleted ? 'completed' : 'pending'
    } satisfies Task;
  }).filter((task): task is Task => Boolean(task));

  return tasks.sort((a, b) => {
    const clientCompare = a.clientName.localeCompare(b.clientName);
    if (clientCompare !== 0) return clientCompare;
    return getStageNumber(a.step) - getStageNumber(b.step);
  });
};

const fetchSheetRows = (sheetName: string) => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  return new Promise<Row[]>((resolve, reject) => {
    Papa.parse<string[]>(csvUrl, {
      download: true,
      header: false,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        resolve(results.data as Row[]);
      },
      error: (error: any) => reject(error)
    });
  });
};

export async function fetchGoogleSheetData(email: string): Promise<Task[]> {
  for (const sheetName of CANDIDATE_SHEETS) {
    try {
      const rows = await fetchSheetRows(sheetName);
      const tasks = parseRowsToTasks(rows, email);
      if (tasks.length > 0) return tasks;
    } catch (error) {
      console.warn(`Could not read ${sheetName}`, error);
    }
  }

  return [];
}

export async function emailExistsInTaskSheet(email: string): Promise<boolean> {
  const tasks = await fetchGoogleSheetData(email);
  if (tasks.length > 0) return true;

  const emailToFind = email.toLowerCase().trim();

  for (const sheetName of CANDIDATE_SHEETS) {
    try {
      const rows = await fetchSheetRows(sheetName);
      if (rows.length < 2 || rows[0].length < 8) continue;
      const headers = rows[0];
      const finalEmailIndex = findColumn(headers, ['final doer email'], -1);
      const doerEmailIndex = findColumn(headers, ['doer email', 'email', 'mail'], 7);
      if (rows.slice(1).some(row => {
        const finalEmail = finalEmailIndex >= 0 ? normalize(row[finalEmailIndex]).toLowerCase() : '';
        const doerEmail = doerEmailIndex >= 0 ? normalize(row[doerEmailIndex]).toLowerCase() : '';
        return finalEmail === emailToFind || doerEmail === emailToFind;
      })) {
        return true;
      }
    } catch (error) {
      console.warn(`Could not scan ${sheetName}`, error);
    }
  }

  return false;
}