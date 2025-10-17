import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- Helper Functions ---
const getFromLocalStorage = (key, defaultValue) => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        return defaultValue;
    }
};

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
    const [tasks, setTasks] = useState(() => getFromLocalStorage('tasks', [
        { id: 1, title: 'レポート作成', color: '#ffec99', position: { x: 100, y: 80 }, status: 'todo', dueDate: '2025-10-20' },
        { id: 2, title: 'アプリのUI設計', color: '#a5d4d4', position: { x: -50, y: 120 }, status: 'todo', dueDate: '2025-10-22' },
        { id: 3, title: '買い物', color: '#d4a5a5', position: { x: -150, y: -40 }, status: 'done', dueDate: null },
    ]));
    const [axisLabels, setAxisLabels] = useState(() => getFromLocalStorage('axisLabels', {
        posX: '緊急',
        negX: '時間がかかる',
        posY: '重要',
        negY: '重要でない',
    }));

    const [timerSettings, setTimerSettings] = useState(() => getFromLocalStorage('timerSettings', {
        pomodoroWork: 25,
        pomodoroBreak: 5,
        pomodoroSessions: 4,
    }));

    const [newTask, setNewTask] = useState({ title: '', color: '#ffec99', dueDate: '' });
    const [activeTask, setActiveTask] = useState(null);

    const [timer, setTimer] = useState({
        currentMode: 'pomodoro', // 'pomodoroWork', 'pomodoroBreak' のみ
        timeLeft: timerSettings.pomodoroWork * 60,
        isRunning: false,
        sessionsLeft: timerSettings.pomodoroSessions,
        totalSessions: timerSettings.pomodoroSessions,
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // --- Audio Refs ---
    // ★★★ prepareSound と transitionTimeoutRef を削除 ★★★
    const workSound = useRef(null);
    const breakSound = useRef(null);

    useEffect(() => {
        // ★★★ prepareSound の初期化を削除 ★★★
        workSound.current = new Audio('/work.mp3');
        breakSound.current = new Audio('/break.mp3');
        workSound.current.loop = true;
        breakSound.current.loop = true;
    }, []);

    // --- LocalStorage Persistence ---
    useEffect(() => { saveToLocalStorage('tasks', tasks); }, [tasks]);
    useEffect(() => { saveToLocalStorage('axisLabels', axisLabels); }, [axisLabels]);
    useEffect(() => { saveToLocalStorage('timerSettings', timerSettings); }, [timerSettings]);

    // --- Core Functions ---
    // ★★★ cancelTransition 関数を削除 ★★★

    // ★★★ stopAllSounds から prepareSound と cancelTransition 関連を削除 ★★★
    const stopAllSounds = useCallback(() => {
        // cancelTransition(); // 削除
        if (workSound.current) {
            workSound.current.pause();
            workSound.current.currentTime = 0;
        }
        if (breakSound.current) {
            breakSound.current.pause();
            breakSound.current.currentTime = 0;
        }
    }, []); // ★★★ 依存配列を空に

    const handleUpdateStatus = useCallback((taskId, status) => {
        setTasks(currentTasks =>
            currentTasks.map(task =>
                task.id === taskId ? { ...task, status } : task
            )
        );
        if (status !== 'doing') {
            setActiveTask(null);
        }
    }, []);

    const resetTimer = useCallback(() => {
        stopAllSounds(); // stopAllSounds は cancelTransition を呼ばなくなった
        setTimer({
            currentMode: 'pomodoro',
            timeLeft: timerSettings.pomodoroWork * 60,
            isRunning: false,
            sessionsLeft: timerSettings.pomodoroSessions,
            totalSessions: timerSettings.pomodoroSessions,
        });
        if(activeTask) {
             setTasks(currentTasks =>
                currentTasks.map(task =>
                    task.id === activeTask.id ? { ...task, status: 'todo' } : task
                )
            );
        }
        setActiveTask(null);
    }, [stopAllSounds, timerSettings, activeTask]);

    // --- CRUD Operations ---
    const handleAddTask = () => {
        if (!newTask.title.trim()) return;
        const newTaskObject = {
            id: crypto.randomUUID(), title: newTask.title, color: newTask.color,
            position: { x: 0, y: 0 }, status: 'todo', dueDate: newTask.dueDate || null,
        };
        setTasks(currentTasks => [...currentTasks, newTaskObject]);
        setNewTask({ title: '', color: '#ffec99', dueDate: '' });
    };
    const handleUpdatePosition = useCallback((taskId, position) => {
        setTasks(currentTasks => currentTasks.map(task => task.id === taskId ? { ...task, position } : task));
    }, []);
    const handleDeleteTask = (taskId) => { setTasks(currentTasks => currentTasks.filter(task => task.id !== taskId)); };
    const handleAxisLabelChange = (axis, value) => { setAxisLabels(l => ({ ...l, [axis]: value })); };

    // --- Timer Logic ---

    // ★★★ 修正: タイマーロジックを大幅に簡略化 (アラーム/移行時間なし) ★★★
    useEffect(() => {
        // isRunning でない場合は何もしない
        if (!timer.isRunning) return;

        // 0秒になった時の処理
        if (timer.timeLeft <= 0) {
            stopAllSounds(); // 現在のBGMを止める

            let nextState = null;
            if (timer.currentMode === 'pomodoroWork') {
                const newSessionsLeft = timer.sessionsLeft - 1;
                if (newSessionsLeft > 0) {
                    // 休憩へ即時移行
                    nextState = {
                        currentMode: 'pomodoroBreak',
                        timeLeft: timerSettings.pomodoroBreak * 60,
                        sessionsLeft: newSessionsLeft,
                        isRunning: true,
                    };
                } else {
                    // 全セッション完了 -> リセット
                    console.log('ポモドーロが完了しました！');
                    if (activeTask) handleUpdateStatus(activeTask.id, 'todo');
                    resetTimer();
                    return; // resetTimerが状態を更新するので、ここでは何もしない
                }
            } else if (timer.currentMode === 'pomodoroBreak') {
                // 学習へ即時移行
                nextState = {
                    currentMode: 'pomodoroWork',
                    timeLeft: timerSettings.pomodoroWork * 60,
                    sessionsLeft: timer.sessionsLeft,
                    isRunning: true,
                };
            }

            // 次の状態があれば更新
            if (nextState) {
                setTimer(t => ({ ...t, ...nextState }));
            }

            return; // 1秒タイマーは起動しない
        }

        // 1秒ごとに時間を減らす
        const intervalId = setInterval(() => {
            setTimer(t => ({ ...t, timeLeft: t.timeLeft - 1 }));
        }, 1000);

        return () => clearInterval(intervalId);

    // 依存配列から stopAllSounds を削除 (useEffect内で直接呼ばれるため不要)
    }, [timer.isRunning, timer.timeLeft, timer.currentMode, timer.sessionsLeft, timerSettings, activeTask, handleUpdateStatus, resetTimer]);


    // BGM再生ロジック
    useEffect(() => {
        // isRunning でない場合は止めるだけ
        if (!timer.isRunning) {
            stopAllSounds();
            return;
        }

        // 適切なBGMを再生
        if (timer.currentMode === 'pomodoroWork') {
            stopAllSounds(); // 他の音を止めてから
            if (workSound.current) workSound.current.play().catch(e => console.error("Work sound play failed:", e));
        } else if (timer.currentMode === 'pomodoroBreak') {
            stopAllSounds(); // 他の音を止めてから
            if (breakSound.current) breakSound.current.play().catch(e => console.error("Break sound play failed:", e));
        } else {
             stopAllSounds(); // 念のため (pomodoro モード初期状態など)
        }

        // クリーンアップは不要 (次のレンダリングの useEffect 冒頭で止めるため)
        // return () => { stopAllSounds(); };

    // 依存配列から stopAllSounds を削除
    }, [timer.isRunning, timer.currentMode]);


    // --- Timer Controls ---
    const startTimer = (task, mode) => {
        // cancelTransition(); // 削除

        // 音声アンロック (BGM再生のために必要)
        // ★★★ prepareSound を削除 ★★★
        if (workSound.current) { workSound.current.play().catch(()=>{}); workSound.current.pause(); workSound.current.currentTime = 0; }
        if (breakSound.current) { breakSound.current.play().catch(()=>{}); breakSound.current.pause(); breakSound.current.currentTime = 0; }
        stopAllSounds(); // 明示的に呼ぶ

        if (activeTask && activeTask.id !== task.id) handleUpdateStatus(activeTask.id, 'todo');
        handleUpdateStatus(task.id, 'doing');
        setActiveTask(task);

        let newTimerState = {};
        if (mode === 'pomodoro') {
            newTimerState = {
                currentMode: 'pomodoroWork', timeLeft: timerSettings.pomodoroWork * 60,
                sessionsLeft: timerSettings.pomodoroSessions, totalSessions: timerSettings.pomodoroSessions,
                isRunning: true
            };
        } else { newTimerState = { ...timer, isRunning: true }; }
        setTimer(newTimerState);
    };

    const togglePauseTimer = () => {
        // ★★★ 移行中 (transitionRef) のチェックを削除 ★★★
        // if (transitionTimeoutRef.current) { ... } else { ... } の分岐を削除
        setTimer(t => ({ ...t, isRunning: !t.isRunning }));
        // stopAllSounds(); // BGMの停止はBGM用useEffectに任せる
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60); const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // --- Derived State ---
    const sortedTasks = useMemo(() => tasks.filter(t => t.status === 'todo' || t.status === 'doing').sort((a, b) => b.position.y - a.position.y), [tasks]);
    const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);

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
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-cyan-400">タスクを追加</h2>
                    <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-cyan-400 text-2xl" title="設定">⚙️</button>
                </div>
                <AddTaskForm
                    newTask={newTask}
                    setNewTask={setNewTask}
                    onAddTask={handleAddTask}
                />
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
                        timerSettings={timerSettings}
                        formatTime={formatTime}
                        onTogglePause={togglePauseTimer}
                        // ★★★ onComplete から cancelTransition を削除 ★★★
                        onComplete={() => { handleUpdateStatus(activeTask.id, 'done'); resetTimer(); }}
                        onReset={resetTimer} // resetTimer内で移行キャンセルされる
                        // ★★★ transitionRef プロパティを削除 ★★★
                        // transitionRef={transitionTimeoutRef}
                    />
                )}

                 <div className="flex-grow flex flex-col min-h-0">
                    <h2 className="text-xl font-semibold text-green-400 mt-4 mb-3">完了済み</h2>
                    <div className="overflow-y-auto pr-2 flex-grow">
                        {doneTasks.map(task => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                onDelete={handleDeleteTask}
                                onUpdateStatus={handleUpdateStatus}
                            />
                        ))}
                    </div>
                </div>
            </aside>
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
// (CartesianPlane, StickyNote, EditableLabel, AddTaskForm, TaskItem は変更なし)

function CartesianPlane({ tasks, onUpdatePosition, axisLabels, onAxisLabelChange, startTimer }) { /* ... 実装は変更なし ... */ 
    const planeSize = 500; const center = planeSize / 2;
    const handleDragStop = (e, data, taskId) => { const newX = data.x - center; const newY = -(data.y - center); onUpdatePosition(taskId, { x: newX, y: newY }); };
    return (<div className="relative w-full h-full flex-grow min-h-[500px] bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700"> <svg width="100%" height="100%" className="absolute top-0 left-0"> <defs> <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"> <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(96, 165, 250, 0.1)" strokeWidth="1"/> </pattern> </defs> <rect width="100%" height="100%" fill="url(#grid)" /> </svg> <div className="absolute top-1/2 left-0 w-full h-px bg-blue-300/30"></div> <div className="absolute left-1/2 top-0 h-full w-px bg-blue-300/30"></div> <EditableLabel value={axisLabels.posY} onChange={e => onAxisLabelChange('posY', e.target.value)} className="absolute top-2 left-1/2 -translate-x-1/2 text-center" /> <EditableLabel value={axisLabels.negY} onChange={e => onAxisLabelChange('negY', e.target.value)} className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center" /> <EditableLabel value={axisLabels.posX} onChange={e => onAxisLabelChange('posX', e.target.value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-center" /> <EditableLabel value={axisLabels.negX} onChange={e => onAxisLabelChange('negX', e.target.value)} className="absolute left-2 top-1/2 -translate-y-1/2 text-center" /> {tasks.map(task => ( <StickyNote key={task.id} task={task} planeSize={planeSize} onDragStop={handleDragStop} onDoubleClick={() => startTimer(task, 'pomodoro')} /> ))} </div> );
}
function StickyNote({ task, planeSize, onDragStop, onDoubleClick }) { /* ... 実装は変更なし ... */ 
    const [isDragging, setIsDragging] = useState(false); const [position, setPosition] = useState({ x: planeSize / 2 + task.position.x, y: planeSize / 2 - task.position.y }); const noteRef = React.useRef(null);
    useEffect(() => { setPosition({ x: planeSize / 2 + task.position.x, y: planeSize / 2 - task.position.y }); }, [task.position, planeSize]);
    const handleMouseDown = (e) => { setIsDragging(true); e.preventDefault(); };
    const handleMouseMove = useCallback((e) => { if (!isDragging || !noteRef.current) return; const parentRect = noteRef.current.parentElement.getBoundingClientRect(); let newX = e.clientX - parentRect.left - noteRef.current.offsetWidth / 2; let newY = e.clientY - parentRect.top - noteRef.current.offsetHeight / 2; newX = Math.max(0, Math.min(newX, parentRect.width - noteRef.current.offsetWidth)); newY = Math.max(0, Math.min(newY, parentRect.height - noteRef.current.offsetHeight)); setPosition({ x: newX, y: newY }); }, [isDragging]);
    const handleMouseUp = useCallback((e) => { if (!isDragging) return; setIsDragging(false); const data = { x: position.x, y: position.y }; onDragStop(e, data, task.id); }, [isDragging, position, onDragStop, task.id]);
    const handleTouchStart = (e) => { setIsDragging(true); };
    const handleTouchMove = useCallback((e) => { if (!isDragging || !noteRef.current || e.touches.length === 0) return; e.preventDefault(); const touch = e.touches[0]; const parentRect = noteRef.current.parentElement.getBoundingClientRect(); let newX = touch.clientX - parentRect.left - noteRef.current.offsetWidth / 2; let newY = touch.clientY - parentRect.top - noteRef.current.offsetHeight / 2; newX = Math.max(0, Math.min(newX, parentRect.width - noteRef.current.offsetWidth)); newY = Math.max(0, Math.min(newY, parentRect.height - noteRef.current.offsetHeight)); setPosition({ x: newX, y: newY }); }, [isDragging]);
    const handleTouchEnd = useCallback((e) => { if (!isDragging) return; setIsDragging(false); const data = { x: position.x, y: position.y }; onDragStop(e, data, task.id); }, [isDragging, position, onDragStop, task.id]);
    useEffect(() => { if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); window.addEventListener('touchmove', handleTouchMove, { passive: false }); window.addEventListener('touchend', handleTouchEnd); } else { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleTouchEnd); } return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('touchend', handleTouchEnd); }; }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);
    return ( <div ref={noteRef} style={{ position: 'absolute', left: `${position.x}px`, top: `${position.y}px`, backgroundColor: task.color, transform: 'translate(-50%, -50%)', cursor: isDragging ? 'grabbing' : 'grab', opacity: task.status === 'doing' ? 1 : 0.8, boxShadow: task.status === 'doing' ? `0 0 15px 5px ${task.color}` : '5px 5px 15px rgba(0,0,0,0.3)', transition: 'box-shadow 0.3s, opacity 0.3s', }} className="p-3 w-32 h-32 rounded-lg text-gray-900 font-semibold text-sm flex flex-col items-center justify-center text-center break-words select-none" onMouseDown={handleMouseDown} onDoubleClick={onDoubleClick} onTouchStart={handleTouchStart} title="ダブルクリックしてタイマーを開始" > <span>{task.title}</span> {task.dueDate && ( <span className="text-xs font-normal mt-2 opacity-75"> {task.dueDate} </span> )} </div> );
}
function EditableLabel({ value, onChange, className }) { /* ... 実装は変更なし ... */ 
    return ( <input type="text" value={value} onChange={onChange} className={`bg-transparent text-blue-300/70 p-1 text-xs rounded hover:bg-gray-700 focus:bg-gray-600 focus:ring-1 focus:ring-cyan-400 outline-none w-24 ${className}`} /> )
}
function AddTaskForm({ newTask, setNewTask, onAddTask }) { /* ... 実装は変更なし ... */ 
    const colors = ['#ffec99', '#d4a5a5', '#a5d4d4', '#a5b8d4', '#cda5d4']; const handleKeyPress = (e) => { if (e.key === 'Enter') { onAddTask(); } };
    return ( <div className="flex flex-col gap-3"> <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} onKeyPress={handleKeyPress} placeholder="新しいタスク名..." className="bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none" /> <input type="date" value={newTask.dueDate || ''} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none" /> <div className="flex gap-2"> {colors.map(color => ( <button key={color} onClick={() => setNewTask({ ...newTask, color })} className="w-8 h-8 rounded-full transition-transform transform hover:scale-110" style={{ backgroundColor: color, border: newTask.color === color ? '3px solid #22d3ee' : '3px solid transparent' }} /> ))} </div> <button onClick={onAddTask} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200" > 追加 </button> </div> );
}
function TaskItem({ task, onDelete, onUpdateStatus, onStartTimer, isActive }) { /* ... 実装は変更なし ... */ 
    return ( <div className={`p-3 mb-2 rounded-lg flex items-center gap-3 transition-all ${isActive ? 'bg-cyan-900/50' : 'bg-gray-700/50 hover:bg-gray-700'}`}> <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div> <div className="flex-grow"> <p className={`${task.status === 'done' ? 'line-through text-gray-500' : ''}`}> {task.title} </p> {task.dueDate && task.status !== 'done' && ( <p className="text-xs text-gray-400"> 〆切: {task.dueDate} </p> )} </div> {task.status !== 'done' && ( <div className="flex gap-1"> <button onClick={() => onStartTimer(task, 'pomodoro')} title="ポモドーロ開始" className="text-gray-400 hover:text-cyan-400">🍅</button> <button onClick={() => onUpdateStatus(task.id, 'done')} title="完了" className="text-gray-400 hover:text-green-400">✔️</button> </div> )} {task.status === 'done' && ( <button onClick={() => onUpdateStatus(task.id, 'todo')} title="未完了に戻す" className="text-gray-400 hover:text-yellow-400">↩️</button> )} <button onClick={() => onDelete(task.id)} title="削除" className="text-gray-400 hover:text-red-400">🗑️</button> </div> );
}

// ★★★ 修正: TimerControl から移行時間関連の表示ロジックを削除 ★★★
function TimerControl({ task, timer, timerSettings, formatTime, onTogglePause, onComplete, onReset }) { // ★ transitionRef を削除

    let totalDuration = 1;
    let modeTitle = "実行中";
    let sessionText = "";

    // ★★★ isTransitioning 関連のロジックを削除 ★★★
    // const isTransitioning = transitionRef.current !== null;
    // if (isTransitioning) { ... } else if (...) ...

    if (timer.currentMode === 'pomodoroWork') {
        totalDuration = timerSettings.pomodoroWork * 60;
        modeTitle = "学習中";
        sessionText = `(セッション ${timer.totalSessions - timer.sessionsLeft + 1} / ${timer.totalSessions})`;
    } else if (timer.currentMode === 'pomodoroBreak') {
        totalDuration = timerSettings.pomodoroBreak * 60;
        modeTitle = "休憩中";
        sessionText = `(セッション ${timer.totalSessions - timer.sessionsLeft} / ${timer.totalSessions})`;
    }

    const progress = totalDuration > 0 ? ((totalDuration - timer.timeLeft) / totalDuration) * 100 : 0;

    return (
        <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-cyan-400">{modeTitle} {sessionText}</p>
            <h3 className="text-lg font-bold mb-2">{task.title}</h3>

            {/* ★★★ 時間表示を常に表示するように戻す ★★★ */}
            <div className="text-5xl font-mono text-center my-4">{formatTime(timer.timeLeft)}</div>

            {/* ★★★ プログレスバー表示条件から isTransitioning を削除 ★★★ */}
            {timer.currentMode !== 'countup' && // countup は存在しないが念のため残す
                <div className="w-full bg-gray-600 rounded-full h-2.5 mb-4">
                    <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            }
            <div className="flex justify-center gap-3">
                 {/* ★★★ 一時停止ボタンの disabled 属性を削除 ★★★ */}
                <button onClick={onTogglePause} className={`font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500`}>{timer.isRunning ? '一時停止' : '再開'}</button>
                <button onClick={onComplete} className="bg-green-500 hover:bg-green-600 font-bold py-2 px-4 rounded-lg">完了</button>
                <button onClick={onReset} className="bg-red-500 hover:bg-red-600 font-bold py-2 px-4 rounded-lg">リセット</button>
            </div>
        </div>
    );
}

// (SettingsModal は変更なし)
function SettingsModal({ settings, onSave, onClose }) { /* ... 実装は変更なし ... */ 
    const [localSettings, setLocalSettings] = useState(settings);
    const handleSave = () => { const pomodoroWork = Math.max(1, Number(localSettings.pomodoroWork)); const pomodoroBreak = Math.max(1, Number(localSettings.pomodoroBreak)); const pomodoroSessions = Math.max(1, Number(localSettings.pomodoroSessions)); onSave({ pomodoroWork, pomodoroBreak, pomodoroSessions }); onClose(); };
    return ( <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"> <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md shadow-2xl"> <h2 className="text-2xl font-bold text-cyan-400 mb-6">タイマー設定</h2> <div className="mb-4"> <label className="block text-sm font-medium text-gray-300 mb-2">学習時間 (分)</label> <input type="number" min="1" value={localSettings.pomodoroWork} onChange={(e) => setLocalSettings({ ...localSettings, pomodoroWork: e.target.value })} className="w-full bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none" /> </div> <div className="mb-4"> <label className="block text-sm font-medium text-gray-300 mb-2">休憩時間 (分)</label> <input type="number" min="1" value={localSettings.pomodoroBreak} onChange={(e) => setLocalSettings({ ...localSettings, pomodoroBreak: e.target.value })} className="w-full bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none" /> </div> <div className="mb-8"> <label className="block text-sm font-medium text-gray-300 mb-2">セッション回数 (回)</label> <input type="number" min="1" value={localSettings.pomodoroSessions} onChange={(e) => setLocalSettings({ ...localSettings, pomodoroSessions: e.target.value })} className="w-full bg-gray-700 border-2 border-transparent focus:border-cyan-400 focus:ring-0 rounded-lg px-4 py-2 text-white outline-none" /> </div> <div className="flex justify-end gap-4"> <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">キャンセル</button> <button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 font-bold py-2 px-4 rounded-lg">保存</button> </div> </div> </div> );
}