export function createQueue(maxConcurrent) {
  let active = 0;
  /** @type {Array<() => void>} */
  const waiters = [];

  const pump = () => {
    while (active < maxConcurrent && waiters.length > 0) {
      active += 1;
      const next = waiters.shift();
      next?.();
    }
  };

  return {
    get depth() {
      return waiters.length + active;
    },
    get active() {
      return active;
    },
    run(task) {
      return new Promise((resolve, reject) => {
        const runTask = () => {
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              pump();
            });
        };

        if (active < maxConcurrent) {
          active += 1;
          runTask();
        } else {
          waiters.push(runTask);
        }
      });
    },
  };
}
