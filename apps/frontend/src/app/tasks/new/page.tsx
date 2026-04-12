import { TaskForm } from "@/components/TaskForm";

export default function NewTaskPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Create New Task</h1>
      <p className="text-gray-500 mb-8">
        Submit a task for the AI agent to process. The agent will evaluate providers, pick the best one, and record its reasoning on-chain.
      </p>
      <TaskForm />
    </div>
  );
}
