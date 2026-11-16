function getIstanbulDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
}

function getTodayDateKey() {
  const d = getIstanbulDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrentWeekMondayKey() {
  const d = getIstanbulDate();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function getRealTodayNameTR() {
  const d = getIstanbulDate();
  const map = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return map[d.getDay()];
}

function getNowTimeTR() {
  return new Date().toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit'
  });
}

module.exports = {
  getTodayDateKey,
  getCurrentWeekMondayKey,
  getRealTodayNameTR,
  getNowTimeTR
};