const getTaskTimeValue = (task) => {
  const parsed = new Date(task?.created_at || 0).getTime();
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return Number(task?.id || 0);
};

export const collapseTaskLineages = (tasks = []) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const taskById = new Map(tasks.map((task) => [Number(task.id), task]));
  const rootIdCache = new Map();

  const resolveRootId = (task) => {
    const taskId = Number(task?.id || 0);
    if (!taskId) {
      return 0;
    }

    if (rootIdCache.has(taskId)) {
      return rootIdCache.get(taskId);
    }

    const visited = [];
    let current = task;
    let fallbackRootId = taskId;

    while (current) {
      const currentId = Number(current.id || 0);
      const parentId = Number(current.carried_forward_from_id || 0);

      if (rootIdCache.has(currentId)) {
        fallbackRootId = rootIdCache.get(currentId);
        break;
      }

      visited.push(currentId);

      if (!parentId) {
        fallbackRootId = currentId;
        break;
      }

      const parentTask = taskById.get(parentId);
      if (!parentTask) {
        fallbackRootId = parentId;
        break;
      }

      current = parentTask;
      fallbackRootId = Number(parentTask.id || fallbackRootId);
    }

    visited.forEach((visitedId) => {
      rootIdCache.set(visitedId, fallbackRootId);
    });

    return fallbackRootId;
  };

  const latestTaskByRootId = new Map();

  tasks.forEach((task) => {
    const rootId = resolveRootId(task);
    const existing = latestTaskByRootId.get(rootId);

    if (!existing || getTaskTimeValue(task) > getTaskTimeValue(existing)) {
      latestTaskByRootId.set(rootId, task);
    }
  });

  const latestTaskIds = new Set(Array.from(latestTaskByRootId.values()).map((task) => Number(task.id)));

  return tasks.filter((task) => latestTaskIds.has(Number(task.id)));
};
