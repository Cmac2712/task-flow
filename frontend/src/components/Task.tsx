import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import { Plus, X, Calendar, User, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { CreateTaskData, User as UserType } from "../types";
import api from "../services/api";
import { Modal, useModal } from "./Modal";

interface AddTaskProps {
  users?: UserType[];
  onSuccess?: () => void;
}

interface TaskFormData extends CreateTaskData {
  dueDate?: string;
}

export const AddTask: React.FC<AddTaskProps> = ({ users = [], onSuccess }) => {
  //onst [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isOpen, openModal, closeModal } = useModal();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>();

  const createTaskMutation = useMutation(
    (taskData: CreateTaskData) => api.tasks.create(taskData),
    {
      onSuccess: (response) => {
        toast.success("Task created successfully!");
        queryClient.invalidateQueries("tasks");
        reset();
        closeModal();
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || "Failed to create task");
      },
    }
  );

  const onSubmit = (data: TaskFormData) => {
    const taskData: CreateTaskData = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      assigneeId: data.assigneeId || undefined,
      dueDate: data.dueDate || undefined,
    };
    createTaskMutation.mutate(taskData);
  };

  const handleCancel = () => {
    reset();
    closeModal();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => openModal()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </button>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Create New Task">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              {...register("title", { required: "Title is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              {...register("description")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Enter task description (optional)"
            />
          </div>

          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Priority *
            </label>
            <select
              id="priority"
              {...register("priority", { required: "Priority is required" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.priority.message}
              </p>
            )}
          </div>

          {users.length > 0 && (
            <div>
              <label
                htmlFor="assigneeId"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <User className="w-4 h-4 inline mr-1" />
                Assignee
              </label>
              <select
                id="assigneeId"
                {...register("assigneeId")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Due Date Field */}
          <div>
            <label
              htmlFor="dueDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Due Date
            </label>
            <input
              id="dueDate"
              type="datetime-local"
              {...register("dueDate")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
