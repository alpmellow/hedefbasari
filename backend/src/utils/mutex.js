let lockPromise = Promise.resolve();

function withStateLock(taskFn) {
  const next = lockPromise.then(() => taskFn());
  lockPromise = next.catch(() => {});
  return next;
}

module.exports = { withStateLock };
