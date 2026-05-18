const log = (level, message, metadata = {}) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),

      level,

      message,

      ...metadata,
    }),
  );
};

module.exports = { log };
