import { TaskList } from "../components/TaskList";

export const TasksPage = () => {
  return (
    <div className="flex flex-col min-h-screen grow p-6">
      <div className="max-w-4xl mx-auto w-full">
        <TaskList />
      </div>
    </div>
  );
};
