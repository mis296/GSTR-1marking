// Google Apps Script Setup Guide for Task Dashboard
// 
// This file contains instructions for connecting your Google Sheet to the dashboard

/*
STEP 1: Open your Google Sheet and go to Extensions > Apps Script

STEP 2: Copy and paste the following code into the script editor:

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DB');
  const values = sheet.getDataRange().getValues();
  
  const headers = values[0];
  const tasks = [];
  
  // Find column indices
  const emailIdx = headers.indexOf('Final Doer Email');
  const nameIdx = headers.indexOf('Final Doer Name');
  const keyIdx = headers.indexOf('Unique Key');
  const clientIdx = headers.indexOf('CLIENT');
  const stepIdx = headers.indexOf('Step');
  const plannedIdx = headers.indexOf('Planned');
  const linkIdx = headers.indexOf('Link');
  const howIdx = headers.indexOf('How');
  const forPCIdx = headers.indexOf('For PC');
  
  const userEmail = e.parameter.email;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    
    // Strict filter by email
    if (userEmail && row[emailIdx] !== userEmail) continue;
    
    // Check for Planned date and Actual date
    const plannedDateVal = row[plannedIdx];
    const statusVal = headers.indexOf('Status') !== -1 ? row[headers.indexOf('Status')] : null;
    const actualDateIdx = headers.indexOf('Actual Date');
    const actualDateVal = actualDateIdx !== -1 ? row[actualDateIdx] : null;

    // RULE: Show only where Planned Date is present, and Actual Date (or Status) is missing/pending
    // If there's no planned date, skip it.
    if (!plannedDateVal) continue;
    
    // If it has an actual date or is marked completed in the sheet, skip it (or treat as completed)
    const isCompletedInSheet = (actualDateVal) || (statusVal === 'completed');
    
    // Calculate stage order and total
    const projectKey = row[keyIdx];
    let totalStages = 0;
    let stageOrder = 0;
    let maxStageOrder = 0;
    
    for (let j = 1; j < values.length; j++) {
      if (values[j][keyIdx] === projectKey) {
        totalStages++;
        if (values[j][stepIdx] === row[stepIdx]) {
          stageOrder = totalStages;
        }
      }
    }
    
    // We only push to the dashboard if it's NOT completed in the sheet
    // If you still want to show completed stages in the dashboard history,
    // remove the `if (!isCompletedInSheet)` wrapper. But per requirements:
    // "show only where is planned date and actual date is missing"
    if (!isCompletedInSheet) {
      tasks.push({
        uniqueKey: projectKey || '',
        clientName: row[clientIdx] || '',
        plannedDate: formatDate(row[plannedIdx]),
        step: row[stepIdx] || '',
        how: row[howIdx] || '',
        doerName: row[nameIdx] || '',
        link: row[linkIdx] || '',
        forPC: row[forPCIdx] || '',
        doerEmail: row[emailIdx] || '',
        finalDoerEmail: row[emailIdx] || '',
        finalDoerName: row[nameIdx] || '',
        stageOrder: stageOrder,
        totalStages: totalStages
      });
    }
  }
  
  const output = { tasks };
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DB');
  const data = JSON.parse(e.postData.contents);
  
  if (data.action === 'markComplete') {
    const headers = sheet.getDataRange().getValues()[0];
    const rows = sheet.getDataRange().getValues();
    
    const keyIdx = headers.indexOf('Unique Key');
    const stepIdx = headers.indexOf('Step');
    const statusIdx = headers.indexOf('Status') !== -1 ? headers.indexOf('Status') : -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][keyIdx] === data.uniqueKey && rows[i][stepIdx] === data.step) {
        if (statusIdx !== -1) {
          sheet.getRange(i + 1, statusIdx + 1).setValue('completed');
        }
        
        // Add completion timestamp if column exists
        const compAtIdx = headers.indexOf('Completed At');
        if (compAtIdx !== -1) {
          sheet.getRange(i + 1, compAtIdx + 1).setValue(new Date());
        }
        
        break;
      }
    }
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
  if (date === null || date === undefined || date === '') return '';
  if (typeof date === 'string') return date;
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(date);
}

STEP 3: Click Deploy > New deployment

STEP 4: Configure deployment:
   - Select type: Web app
   - Description: Task Dashboard API
   - Execute as: Me
   - Who has access: Anyone

STEP 5: Click Deploy and copy the Web App URL

STEP 6: Paste the URL in src/App.tsx as GOOGLE_SCRIPT_URL

STEP 7: Test by opening the dashboard and logging in with your email

*/

export const GOOGLE_SHEETS_SETUP = {
  requiredColumns: [
    'Unique Key',
    'CLIENT', 
    'Final Doer Email',
    'Final Doer Name',
    'Step',
    'Planned',
    'Link',
    'How',
    'For PC'
  ],
  optionalColumns: [
    'Status',
    'Completed At',
    'Doer Email',
    'Doer Name'
  ],
  deploymentSteps: 7
};