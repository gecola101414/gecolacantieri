const validUnits = 'KG|NR|PZ|ML|MC|M3|M2|MQ|LT|L|QL|Q\\.?LI|Q|SACCHI|BANCALI|MT|M';
const regex1 = new RegExp('^\\s*(?:([0-9]{1,2})\\s+)?(?:([A-Z0-9]{4,15})\\s+)?([A-Za-z0-9\\s\\.\\/\\,\\-\\+\\%\\*\\x]{3,75}?)\\s+\\b(' + validUnits + ')\\b\\s+([0-9]+(?:[.,][0-9]{1,4})?)\\s+([0-9]+(?:[.,][0-9]{1,4})?)(?:\\s+([\\-0-9]+(?:[.,][0-9]+)?))?(?:\\s+([0-9]+(?:[.,][0-9]{1,2})?))?', 'i');

const regex2 = new RegExp('^\\s*(?:([0-9]{1,2})\\s+)?(?:([A-Z0-9\\.\\-\\_]{3,30})\\s+)?(.{3,90}?)\\s+\\b(' + validUnits + ')\\b\\s+([0-9]+(?:[.,][0-9]{1,4})?)\\s+([0-9]+(?:[.,][0-9]{1,4})?)(?:\\s+([\\-0-9]+(?:[.,][0-9]+)?))?(?:\\s+([0-9]+(?:[.,][0-9]{1,2})?))?', 'i');

const testLine = 'VALVS0170321 RACCORDO DIRITTO FEMMINA 20X2 X1/2" NR 2 2,75400 5,51 22';
const testLine2 = 'GEB115.883.JQ.1 SIGMA30,PLACCA COMAN.DOPPIO TASTO SAT./CROMATO/S PZ 1 134,71560 134,72 22';
const testLine3 = 'SNPFF5FS18OR183G1 FS18OR 3G1,5MA CCA-S3,D1,A3 450/750 m 10,00 0,76320 7,63 22';

console.log('REGEX 1 (Old):');
console.log(testLine.match(regex1) !== null);
console.log(testLine2.match(regex1) !== null);
console.log(testLine3.match(regex1) !== null);

console.log('REGEX 2 (New):');
const res = testLine.match(regex2);
console.log(res !== null, res ? [res[2], res[3], res[4]] : null);
const res2 = testLine2.match(regex2);
console.log(res2 !== null, res2 ? [res2[2], res2[3], res2[4]] : null);
const res3 = testLine3.match(regex2);
console.log(res3 !== null, res3 ? [res3[2], res3[3], res3[4]] : null);
