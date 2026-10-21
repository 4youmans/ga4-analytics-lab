// Укажите ID своей таблицы между /d/ и /edit в её URL.
const SPREADSHEET_ID = '1VQ40uqpRfwoTX9QAmHVJKt_UVi6M051qoNm8NOQfdMs';
const HEADERS = ['request_id', 'created_at', 'name', 'email', 'direction',
  'utm_source', 'utm_medium', 'utm_campaign', 'status'];

// Запустите один раз в редакторе Apps Script перед публикацией Web app.
// Существующие строки не удаляются; чужая структура не перезаписывается.
function setupLeadsSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('leads');
  if (!sheet) sheet = spreadsheet.insertSheet('leads');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  if (sheet.getRange(1, 1, 1, 9).getValues()[0].join('|') !== HEADERS.join('|')) {
    throw new Error('Лист leads имеет другие заголовки. Проверьте A1:I1; данные не изменены.');
  }
  sheet.setFrozenRows(1);
  sheet.getRange('A1:I1').setBackground('#102f39').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange('B2:B').setNumberFormat('dd.mm.yyyy hh:mm:ss');
  const statuses = ['new', 'in_progress', 'done', 'rejected'];
  sheet.getRange('I2:I').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(statuses, true).setAllowInvalid(false).build());
  const rules = sheet.getConditionalFormatRules();
  const formulas = ['=AND($A2<>"",COUNTIF($A$2:$A,$A2)>1)',
    '=AND($A2<>"",OR($B2="",$C2="",$D2="",$E2="",$F2="",$G2="",$H2="",$I2=""))'];
  formulas.forEach(formula => {
    const exists = rules.some(rule => {
      const condition = rule.getBooleanCondition();
      return condition && condition.getCriteriaValues().includes(formula);
    });
    if (!exists) rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula).setBackground('#fce8e6')
      .setRanges([sheet.getRange('A2:I')]).build());
  });
  sheet.setConditionalFormatRules(rules);
  sheet.autoResizeColumns(1, 9);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const clean = key => String(p[key] || '').trim();
  const missing = ['request_id', 'name', 'email', 'direction'].filter(key => !clean(key));
  if (missing.length) return jsonResponse({ok:false, error:'missing_required', fields:missing});
  const id = clean('request_id');
  if (!/^REQ-[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/i.test(id)) {
    return jsonResponse({ok:false, error:'invalid_request_id'});
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean('email'))) {
    return jsonResponse({ok:false, error:'invalid_email'});
  }
  if (!['frontend','backend','data'].includes(clean('direction'))) {
    return jsonResponse({ok:false, error:'invalid_direction'});
  }
  if (['name','email','utm_source','utm_medium','utm_campaign'].some(key => clean(key).length > 200)) {
    return jsonResponse({ok:false, error:'value_too_long'});
  }
  // Проверка ID и запись выполняются под одной блокировкой.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse({ok:false, error:'busy_retry'});
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('leads');
    if (!sheet || sheet.getRange(1,1,1,9).getValues()[0].join('|') !== HEADERS.join('|')) {
      return jsonResponse({ok:false, error:'invalid_sheet_schema'});
    }
    const duplicate = sheet.getRange('A:A').createTextFinder(id)
      .matchEntireCell(true).matchCase(false).useRegularExpression(false).findNext();
    if (duplicate) return jsonResponse({ok:false, error:'duplicate_request_id'});
    const createdAt = new Date();
    const source = clean('utm_source') || 'direct';
    const medium = clean('utm_medium') || 'none';
    const campaign = clean('utm_campaign') || 'not_set';
    const status = 'new'; // Присланный клиентом status игнорируется.
    sheet.appendRow([id, createdAt, textCell(clean('name')), textCell(clean('email')),
      clean('direction'), textCell(source), textCell(medium), textCell(campaign), status]);
    SpreadsheetApp.flush();
    return jsonResponse({ok:true, request_id:id});
  } catch (error) {
    // Не возвращаем клиенту детали таблицы и содержимое заявки.
    return jsonResponse({ok:false, error:'storage_error'});
  } finally {
    lock.releaseLock();
  }
}

function textCell(value) {
  // Не даём введённому тексту превратиться в формулу Google Sheets.
  return /^[=+@-]/.test(value) ? "'" + value : value;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
