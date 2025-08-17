import {
  Task,
  TaskStatus,
  TaskPriority,
  generateId,
} from '@bharat-agents/shared';

// In-memory storage for demo purposes
// In a real application, this would be replaced with a database
const tasks: Map<string, Task> = new Map();

interface TaskFilters {
  page: number;
  limit: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  tags?: string[];
}

interface TaskListResult {
  tasks: Task[];
  total: number;
}

export const taskService = {
  async getTasks(filters: TaskFilters): Promise<TaskListResult> {
    let filteredTasks = Array.from(tasks.values());

    // Apply filters
    if (filters.status) {
      filteredTasks = filteredTasks.filter(
        task => task.status === filters.status
      );
    }

    if (filters.priority) {
      filteredTasks = filteredTasks.filter(
        task => task.priority === filters.priority
      );
    }

    if (filters.assignedTo) {
      filteredTasks = filteredTasks.filter(
        task => task.assignedTo === filters.assignedTo
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    // Sort by creation date (newest first)
    filteredTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = filteredTasks.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    return {
      tasks: paginatedTasks,
      total,
    };
  },

  async getTask(id: string): Promise<Task | null> {
    return tasks.get(id) || null;
  },

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: generateId(),
      title: taskData.title!,
      description: taskData.description,
      status: taskData.status || TaskStatus.TODO,
      priority: taskData.priority || TaskPriority.MEDIUM,
      createdAt: now,
      updatedAt: now,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
      assignedTo: taskData.assignedTo,
      tags: taskData.tags || [],
    };

    tasks.set(task.id, task);
    return task;
  },

  async updateTask(
    id: string,
    updateData: Partial<Task>
  ): Promise<Task | null> {
    const task = tasks.get(id);
    if (!task) {
      return null;
    }

    const updatedTask: Task = {
      ...task,
      ...updateData,
      id, // Ensure ID cannot be changed
      updatedAt: new Date(),
      createdAt: task.createdAt, // Ensure creation date cannot be changed
    };

    // Handle date conversion for dueDate
    if (updateData.dueDate) {
      updatedTask.dueDate = new Date(updateData.dueDate);
    }

    tasks.set(id, updatedTask);
    return updatedTask;
  },

  async deleteTask(id: string): Promise<boolean> {
    return tasks.delete(id);
  },

  // Additional utility methods
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return Array.from(tasks.values()).filter(task => task.status === status);
  },

  async getTasksByPriority(priority: TaskPriority): Promise<Task[]> {
    return Array.from(tasks.values()).filter(
      task => task.priority === priority
    );
  },

  async getTasksByAssignee(assignedTo: string): Promise<Task[]> {
    return Array.from(tasks.values()).filter(
      task => task.assignedTo === assignedTo
    );
  },

  async getOverdueTasks(): Promise<Task[]> {
    const now = new Date();
    return Array.from(tasks.values()).filter(
      task =>
        task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE
    );
  },
};
