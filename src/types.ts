export interface Task {
  uniqueKey: string;
  clientName: string;
  plannedDate: string;
  step: string;
  how: string;
  link: string;
  doerEmail: string;
  status: 'pending' | 'completed';
}

export interface User {
  email: string;
  name: string;
}

export interface ProjectGroup {
  uniqueKey: string;
  clientName: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  isFullyCompleted: boolean;
}