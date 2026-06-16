import { ProjectGroup, Task } from '../types';

interface Props {
  group: ProjectGroup;
  onMarkDone: (task: Task) => void;
  submittingTaskId: string | null;
  getTaskId: (task: Task) => string;
}

export default function ProjectCard({
  group,
  onMarkDone,
  submittingTaskId,
  getTaskId
}: Props) {
  const progressPercent = Math.round((group.completedCount / group.totalCount) * 100);
  const pendingTasks = group.tasks.filter(task => task.status === 'pending');
  const twelfthStage = group.tasks.find((task, index) => index === 11 || /(^|\D)12(\D|$)/.test(task.step));
  const fallbackFinalStage = group.tasks[group.tasks.length - 1];
  const submitStage = twelfthStage || fallbackFinalStage;
  const canSubmitTwelfth = submitStage && submitStage.status === 'pending';

  return (
    <div className="card-3d glass-panel rounded-3xl p-6 mb-8 overflow-hidden relative">
      {/* Decorative gradient background blob */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[80px] pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-slate-700/50 pb-6 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-sm">
              {group.clientName}
            </h2>
            <span className="bg-slate-800/80 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/30 shadow-inner">
              {group.uniqueKey}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-400">
            <span className="rounded-md border border-cyan-500/20 bg-slate-900/50 px-3 py-1.5 text-cyan-300">
              {group.completedCount} of {group.totalCount} stages completed
            </span>
            <span className="rounded-md border border-amber-500/20 bg-slate-900/50 px-3 py-1.5 text-amber-300">
              {pendingTasks.length} pending
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-64">
          {canSubmitTwelfth && (
            <button
              onClick={() => onMarkDone(submitStage)}
              disabled={submittingTaskId === getTaskId(submitStage)}
              className="rounded-xl border border-amber-300/40 bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_22px_rgba(251,191,36,0.25)] transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              title="Use this if previous stages are not applicable. It marks the 12th/final stage done directly."
            >
              {submittingTaskId === getTaskId(submitStage) ? 'Submitting...' : 'Not Applicable? Submit 12th Stage'}
            </button>
          )}

          {/* Progress Bar */}
          <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 shadow-inner">
            <div className="flex justify-between text-xs font-black tracking-wider mb-2">
              <span className={group.isFullyCompleted ? 'text-emerald-400' : 'text-indigo-400'}>
                {group.isFullyCompleted ? 'ALL DONE!' : 'PROJECT PROGRESS'}
              </span>
              <span className="text-slate-300">{progressPercent}%</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
              <div 
                className={`h-full transition-all duration-1000 ease-out rounded-full relative overflow-hidden ${
                  group.isFullyCompleted 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                    : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12 translate-x-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stages List */}
      <div className="space-y-4 relative z-10">
        {group.tasks.map((task, index) => {
          const isCompleted = task.status === 'completed';
          const taskId = getTaskId(task);
          const isSubmitting = submittingTaskId === taskId;
          
          return (
            <div 
              key={task.step + index} 
              className={`stage-card flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl ${
                isCompleted ? 'bg-slate-900/40 border-emerald-500/20 opacity-75 hover:opacity-100' : ''
              }`}
            >
              {/* Stage Info */}
              <div className="flex gap-4 flex-1">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black shadow-inner border ${
                  isCompleted 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white border-white/10 shadow-indigo-500/30 shadow-lg'
                }`}>
                  {isCompleted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div>
                  <h4 className={`font-bold text-lg mb-1 tracking-wide ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    {task.step}
                  </h4>
                  <div className="text-sm flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-bold text-indigo-300">
                      Planned: <span className="text-slate-300 font-medium">{task.plannedDate || 'Not Scheduled'}</span>
                    </span>
                    {task.how && (
                      <>
                        <span className="hidden sm:inline text-slate-600">•</span>
                        <span className="italic text-slate-400">{task.how}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 md:pl-6 md:border-l border-slate-700/50">
                {isCompleted ? (
                  <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-black tracking-widest border border-emerald-500/20 w-full justify-center md:w-auto">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    DONE
                  </span>
                ) : (
                  <>
                    {task.link && (
                      <a 
                        href={task.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 text-indigo-400 hover:text-white bg-slate-800 hover:bg-indigo-600 rounded-xl transition-all duration-300 border border-slate-700 hover:border-indigo-500 shadow-md"
                        title="Open Form / Link"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </a>
                    )}
                    
                    <button
                      onClick={() => onMarkDone(task)}
                      disabled={isSubmitting}
                      className="flex-1 md:flex-none bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-emerald-200/50"
                    >
                      {isSubmitting ? (
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4v-8z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isSubmitting ? 'SAVING...' : 'Tick Mark'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}