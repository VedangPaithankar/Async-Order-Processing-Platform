class RetryableError extends Error {

  constructor(message) {
    super(message);

    this.name = 'RetryableError';
  }
}

module.exports = RetryableError;