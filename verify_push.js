import { pushLocalTasksToBackend } from './src/services/api.js';
import { getTasks, setTasks } from './src/store/state.js';

async function verifyPush() {
    console.log('--- STARTING PUSH VERIFICATION ---');

    // 1. Create a "dirty" local task
    const testTask = {
        id: 'local_test_' + Date.now(),
        title: 'Test Sync Task ' + new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        time: '12:00',
        completed: false,
        dirty: true,
        tags: []
    };

    console.log('1. Created dirty task:', testTask.id);

    // 2. Inject into state
    const current = getTasks() || {};
    const dateKey = testTask.date;
    if (!current[dateKey]) current[dateKey] = [];
    current[dateKey].push(testTask);
    setTasks(current);

    // 3. Trigger Push
    console.log('2. Triggering pushLocalTasksToBackend()...');
    try {
        await pushLocalTasksToBackend();
        console.log('3. Push completed without error.');
    } catch (e) {
        console.error('3. Push FAILED:', e);
    }

    // 4. Verify if it has a serverId now
    const after = getTasks();
    const syncedTask = Object.values(after).flat().find(t => t.id === testTask.id || t.title === testTask.title);

    if (syncedTask) {
        console.log('4. Task status after sync:', syncedTask);
        if (syncedTask.serverId) {
            console.log('SUCCESS: Task has serverId:', syncedTask.serverId);
        } else {
            console.error('FAILURE: Task still has no serverId.');
        }
    } else {
        console.error('FAILURE: Task vanished from state.');
    }
}

// Expose to window for user to run
window.verifyPush = verifyPush;
console.log('Loaded verifyPush. Run window.verifyPush() to test.');
