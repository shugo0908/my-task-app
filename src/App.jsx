
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- Helper Functions ---
// localStorageから安全にデータを読み込むための関数
const getFromLocalStorage = (key, defaultValue) => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        return defaultValue;
    }
};

// localStorageにデータを保存するための関数
const saveToLocalStorage = (key, value) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error saving to localStorage for key "${key}":`, error);
    }
};


// --- Main App Component ---
export default function App() {
    // --- State Management ---

    //【変更点①】localStorageからデータを読み込むように初期値を設定
    const [tasks, setTasks] = useState(() => getFromLocalStorage('tasks', [
        { id: 1, title: 'レポート作成', color: '#ffec99', position: { x: 100, y: 80 }, status: 'todo' },
        { id: 2, title: 'アプリのUI設計', color: '#a5d4d4', position: { x: -50, y: 120 }, status: 'todo' },
        { id: 3, title: '買い物', color: '#d4a5a5', position: { x: -150, y: -40 }, status: 'done' },
    ]));
    const [axisLabels, setAxisLabels] = useState(() => getFromLocalStorage('axisLabels', {
        posX: '緊急',
        negX: '時間がかかる',
        posY: '重要',
        negY: '重要でない',
    }));
    //【変更点②】タイマー設定用のstateを追加
    const [timerSettings, setTimerSettings] = useState(() => getFromLocalStorage('timerSettings', {
        pomodoro: 25,
        countdown: 10,
    }));

    const [newTask, setNewTask] = useState({ title: '', color: '#ffec99' });
    const [activeTask, setActiveTask] = useState(null);
    const [timer, setTimer] = useState({ mode: 'pomodoro', timeLeft: timerSettings.pomodoro * 60, isRunning: false, intervalId: null });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 設定モーダルの表示状態

    //【変更点①】stateが変更されたらlocalStorageに自動保存するuseEffect
    useEffect(() => {
        saveToLocalStorage('tasks', tasks);
    }, [tasks]);

    useEffect(() => {
        saveToLocalStorage('axisLabels', axisLabels);
    }, [axisLabels]);

    useEffect(() => {
        saveToLocalStorage('timerSettings', timerSettings);
    }, [timerSettings]);

    // --- CRUD Operations ---
    const handleAddTask = () => {
        if (!newTask.title.trim()) return;
        const newTaskObject = {
            id: crypto.randomUUID(),
            title: newTask.title,
            color: newTask.color,
            position: { x: 0, y: 0 },
            status: 'todo',
        };
        setTasks(currentTasks => [...currentTasks, newTaskObject]);
        setNewTask({ title: '', color: '#ffec99' });
    };

    const handleUpdatePosition = useCallback((taskId, position) => {
        setTasks(currentTasks =>
            currentTasks.map(task =>
                task.id === taskId ? { ...task, position } : task
            )
        );
    }, []);

    const handleUpdateStatus = (taskId, status) => {
        setTasks(currentTasks =>
            currentTasks.map(task =>
                task.id === taskId ? { ...task, status } : task
            )
        );
        if (status !== 'doing') {
            setActiveTask(null);
            resetTimer();
        }
    };

    const handleDeleteTask = (taskId) => {
        setTasks(currentTasks => currentTasks.filter(task => task.id !== taskId));
    };

    const handleAxisLabelChange = (axis, value) => {
        setAxisLabels({ ...axisLabels, [axis]: value });
    };

    // --- Timer Logic ---
    useEffect(() => {
        if (timer.isRunning && timer.timeLeft > 0 && timer.mode !== 'countup') {
            const intervalId = setInterval(() => {
                setTimer(t => ({ ...t, timeLeft: t.timeLeft - 1 }));
            }, 1000);
            return () => clearInterval(intervalId);
        } else if (timer.isRunning && timer.mode === 'countup') {
             const intervalId = setInterval(() => {
                setTimer(t => ({ ...t, timeLeft: t.timeLeft + 1 }));
            }, 1000);
            return () => clearInterval(intervalId);
        }
    }, [timer.isRunning, timer.timeLeft, timer.mode]);

    const startTimer = (task, mode) => {
        if (activeTask && activeTask.id !== task.id) {
            handleUpdateStatus(activeTask.id, 'todo');
        }

        handleUpdateStatus(task.id, 'doing');
        setActiveTask(task);

        //【変更点②】ハードコードされた値の代わりに設定値を使用
        let initialTime;
        switch(mode) {
            case 'pomodoro': initialTime = timerSettings.pomodoro * 60; break;
            case 'countdown': initialTime = timerSettings.countdown * 60; break;
            case 'countup': initialTime = 0; break;
            default: initialTime = timerSettings.pomodoro * 60;
        }

        setTimer({ mode, timeLeft: initialTime, isRunning: true });
    };

    const togglePauseTimer = () => {
        setTimer(t => ({ ...t, isRunning: !t.isRunning }));
    };

    const resetTimer = () => {
        setTimer({ mode: 'pomodoro', timeLeft: timerSettings.pomodoro * 60, isRunning: false });
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // --- Derived State ---
    const sortedTasks = useMemo(() => {
        return [...tasks]
            .filter(t => t.status === 'todo' || t.status === 'doing')
            .sort((a, b) => b.position.y - a.position.y);
    }, [tasks]);

    const doneTasks = useMemo(() => {
        return tasks.filter(t => t.status === 'done');
    }, [tasks]);

    // --- Component Render ---
    return (
        <div className="bg-gray-900 text-white font-sans min-h-screen flex flex-col lg:flex-row p-4 gap-4">
            <main className="flex-grow lg:w-2/3 bg-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl">
                <h1 className="text-2xl font-bold text-cyan-400 mb-4">🚀 デカルト平面タスクマネージャー</h1>
                <CartesianPlane
                    tasks={tasks.filter(t => t.status !== 'done')}
                    onUpdatePosition={handleUpdatePosition}
                    axisLabels={axisLabels}
                    onAxisLabelChange={handleAxisLabelChange}
                    setActiveTask={setActiveTask}
                    startTimer={startTimer}
                />
            </main>

            <aside className="w-full lg:w-1/3 bg-gray-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
                {/*【変更点②】設定ボタンを追加*/}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-cyan-400">タスクを追加</h2>
                    <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-cyan-400 text-2xl" title="設定">⚙️</button>
                </div>
                {/*【変更点③】onAddTaskを渡すように変更*/}
                <AddTaskForm newTask={newTask} setNewTask={setNewTask} onAddTask={handleAddTask} />
                <div className="flex-grow flex flex-col min-h-0">
                    <h2 className="text-xl font-semibold text-cyan-400 mb-3">優先度リスト</h2>
                    <div className="overflow-y-auto pr-2 flex-grow">
                        {sortedTasks.map(task => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                onDelete={handleDeleteTask}
                                onUpdateStatus={handleUpdateStatus}
                                onStartTimer={startTimer}
                                isActive={activeTask?.id === task.id}
                            />
                        ))}
                    </div>
                </div>

                {activeTask && (
                    <TimerControl
                        task={activeTask}
                        timer={timer}
                        timerSettings={timerSettings} //【変更点②】設定を渡す
                        formatTime={formatTime}
                        onTogglePause={togglePauseTimer}
                        onComplete={() => handleUpdateStatus(activeTask.id, 'done')}
                    />
                )}

                 <div className="flex-grow flex flex-col min-h-0">
                    <h2 className="text-xl font-semibold text-green-400 mt-4 mb-3">完了済み</h2>
                    <div className="overflow-y-auto pr-2 flex-grow">
                        {doneTasks.map(task => (
                            <TaskItem key={task.id} task={task} onDelete={handleDeleteTask} />
                        ))}
                    </div>
                </div>
            </aside>
            {/*【変更点②】設定モーダルコンポーネント*/}
            {isSettingsOpen && (
                <SettingsModal
                    settings={timerSettings}
                    onSave={setTimerSettings}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}
        </div>
    );
}

// --- Sub-components ---

function CartesianPlane({ tasks, onUpdatePosition, axisLabels, onAxisLabelChange, startTimer }) {
    const planeSize = 500;
    const center = planeSize / 2;

    const handleDragStop = (e, data, taskId) => {
        const newX = data.x - center;
        const newY = -(data.y - center); // Y is inverted in screen coordinates
        onUpdatePosition(taskId, { x: newX, y: newY });
    };

    return (
        <div className="relative w-full h-full flex-grow min-h-[500px] bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
            {/* Grid Lines */}
            <svg width="100%" height="100%" className="absolute top-0 left-0">
                <defs>
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(96, 165, 250, 0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Axes */}
            <div className="absolute top-1/2 left-0 w-full h-px bg-blue-300/30"></div>
            <div className="absolute left-1/2 top-0 h-full w-px bg-blue-300/30"></div>

            {/* Axis Labels */}
            <EditableLabel value={axisLabels.posY} onChange={e => onAxisLabelChange('posY', e.target.value)} className="absolute top-2 left-1/2 -translate-x-1/2 text-center" />
            <EditableLabel value={axisLabels.negY} onChange={e => onAxisLabelChange('negY', e.target.value)} className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center" />
            <EditableLabel value={axisLabels.posX} onChange={e => onAxisLabelChange('posX', e.target.value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-center" />
            <EditableLabel value={axisLabels.negX} onChange={e => onAxisLabelChange('negX', e.target.value)} className="absolute left-2 top-1/2 -translate-y-1/2 text-center" />

            {tasks.map(task => (
                <StickyNote
                    key={task.id}
                    task={task}
                    planeSize={planeSize}
                    onDragStop={handleDragStop}
                    onDoubleClick={() => startTimer(task, 'pomodoro')}
                />
            ))}
        </div>
    );
}

function StickyNote({ task, planeSize, onDragStop, onDoubleClick }) {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({
        x: planeSize / 2 + task.position.x,
        y: planeSize / 2 - task.position.y
    });
    const noteRef = React.useRef(null);

    useEffect(() => {
        setPosition({
            x: planeSize / 2 + task.position.x,
            y: planeSize / 2 - task.position.y
        });
    }, [task.position, planeSize]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !noteRef.current) return;
        const parentRect = noteRef.current.parentElement.getBoundingClientRect();
        let newX = e.clientX - parentRect.left - noteRef.current.offsetWidth / 2;
        let newY = e.clientY - parentRect.top - noteRef.current.offsetHeight / 2;

        newX = Math.max(0, Math.min(newX, parentRect.width - noteRef.current.offsetWidth));
        newY = Math.max(0, Math.min(newY, parentRect.height - noteRef.current.offsetHeight));

        setPosition({ x: newX, y: newY });
    }, [isDragging]);

    const handleMouseUp = useCallback((e) => {
        if (!isDragging) return;
        setIsDragging(false);
        const data = { x: position.x, y: position.y };
        onDragStop(e, data, task.id);
    }, [isDragging, position, onDragStop, task.id]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            ref={noteRef}
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                backgroundColor: task.color,
                transform: 'translate(-50%, -50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: task.status === 'doing' ? 1 : 0.8,
                boxShadow: task.status === 'doing' ? `0 0 15px 5px ${task.color}` : '5px 5px 15px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.3s, opacity 0.3s',
            }}
            className="p-3 w-32 h-32 rounded-lg text-gray-900 font-semibold text-sm flex items-center justify-center text-center break-words select-none"
            onMouseDown={handleMouseDown}
            onDoubleClick={onDoubleClick}
            title="ダブルクリックしてタイマーを開始"
        >
            {task.title}
        </div>
    );
}


function EditableLabel({ value, onChange, className }) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            className={`bg-transparent text-blue-300/70 p-1 text-xs rounded hover:bg-gray-700 focus:bg-gray-600 focus:ring-1 focus:ring-cyan-400 outline-none w-24 ${className}`}
        />
    )
}

//【変更点③】Enterキーでのタスク追加に対応
function AddTaskForm({ newTask, setNewTask, onAddTask }) {
    const colors = ['#ffec99', '#d4a5a5', '#a5d4d4', '#a5b8d4', '#cda5d4'];

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            onAddTask();
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                onKeyPress={handleKeyPress} // Enterキーのイベントを追加
                placeholder="新しいタスク名..."
                className="bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none"
            />
            <div className="flex gap-2">
                {colors.map(color => (
                    <button
                        key={color}
                        onClick={() => setNewTask({ ...newTask, color })}
                        className="w-8 h-8 rounded-full transition-transform transform hover:scale-110"
                        style={{
                            backgroundColor: color,
                            border: newTask.color === color ? '3px solid #22d3ee' : '3px solid transparent'
                        }}
                    />
                ))}
            </div>
            <button
                onClick={onAddTask}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
                追加
            </button>
        </div>
    );
}

function TaskItem({ task, onDelete, onUpdateStatus, onStartTimer, isActive }) {
    return (
        <div className={`p-3 mb-2 rounded-lg flex items-center gap-3 transition-all ${isActive ? 'bg-cyan-900/50' : 'bg-gray-700/50 hover:bg-gray-700'}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div>
            <p className={`flex-grow ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>{task.title}</p>
            {task.status !== 'done' && (
                 <div className="flex gap-1">
                    <button onClick={() => onStartTimer(task, 'pomodoro')} title="ポモドーロ開始" className="text-gray-400 hover:text-cyan-400">🍅</button>
                    <button onClick={() => onUpdateStatus(task.id, 'done')} title="完了" className="text-gray-400 hover:text-green-400">✔️</button>
                 </div>
            )}
            <button onClick={() => onDelete(task.id)} title="削除" className="text-gray-400 hover:text-red-400">🗑️</button>
        </div>
    );
}

//【変更点②】プログレスバーの計算を動的に変更
function TimerControl({ task, timer, timerSettings, formatTime, onTogglePause, onComplete }) {
    const totalDuration = timer.mode === 'pomodoro' ? timerSettings.pomodoro * 60 :
                          timer.mode === 'countdown' ? timerSettings.countdown * 60 : 1; // countupの場合は1

    const progress = totalDuration > 0 ? ((totalDuration - timer.timeLeft) / totalDuration) * 100 : 0;

    return (
        <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-cyan-400">実行中:</p>
            <h3 className="text-lg font-bold mb-2">{task.title}</h3>
            <div className="text-5xl font-mono text-center my-4">{formatTime(timer.timeLeft)}</div>
            {timer.mode !== 'countup' &&
                <div className="w-full bg-gray-600 rounded-full h-2.5 mb-4">
                    <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            }
            <div className="flex justify-center gap-4">
                <button onClick={onTogglePause} className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">{timer.isRunning ? '一時停止' : '再開'}</button>
                <button onClick={onComplete} className="bg-green-500 hover:bg-green-600 font-bold py-2 px-4 rounded-lg">完了</button>
            </div>
        </div>
    );
}

//【変更点②】新しく追加した設定モーダルコンポーネント
function SettingsModal({ settings, onSave, onClose }) {
    const [localSettings, setLocalSettings] = useState(settings);

    const handleSave = () => {
        // 数値であり、0より大きいことを確認
        const pomodoro = Math.max(1, Number(localSettings.pomodoro));
        const countdown = Math.max(1, Number(localSettings.countdown));
        onSave({ pomodoro, countdown });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6">タイマー設定</h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">ポモドーロ (分)</label>
                    <input
                        type="number"
                        min="1"
                        value={localSettings.pomodoro}
                        onChange={(e) => setLocalSettings({ ...localSettings, pomodoro: e.target.value })}
                        className="w-full bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none"
                    />
                </div>

                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-300 mb-2">カウントダウン (分)</label>
                    <input
                        type="number"
                        min="1"
                        value={localSettings.countdown}
                        onChange={(e) => setLocalSettings({ ...localSettings, countdown: e.target.value })}
                        className="w-full bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none"
                    />
                </div>

                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">キャンセル</button>
                    <button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 font-bold py-2 px-4 rounded-lg">保存</button>
                </div>
            </div>
        </div>
    );
}