 // Time utilities for Indian Standard Time (IST - Asia/Kolkata)

function getISTTime(date = new Date()) {
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getISTDate(date = new Date()) {
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getISTDateString(date = new Date()) {
  // Returns YYYY-MM-DD in Asia/Kolkata timezone
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(date));
}

module.exports = {
  getISTTime,
  getISTDate,
  getISTDateString,
};
