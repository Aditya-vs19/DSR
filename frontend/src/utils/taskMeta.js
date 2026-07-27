export const TASK_DEPARTMENTS = ["Sales", "Logistics", "Operations", "Technical", "Finance", "Human Resources"];

export const getTaskDateText = (task) => String(task?.task_date || task?.created_at || "").slice(0, 10);

export const getTomorrowText = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const getTodayText = (value = new Date()) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
