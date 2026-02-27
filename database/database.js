const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '[]');
  const data = fs.readFileSync(dbPath);
  return JSON.parse(data);
}

function saveUsers(users) {
  fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
}

module.exports = {
  loadUsers,
  saveUsers
};
