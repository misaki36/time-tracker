// =====================================================
// 1. 画面の部品をつかまえる（HTMLのidを使って探す）
// =====================================================
const siteSelect = document.getElementById('site-select');       // サイト名の入力欄
const taskSelect = document.getElementById('task-select');       // 工程の入力欄
const memoInput = document.getElementById('memo-input');         // やったこと（メモ）の入力欄
const timerText = document.getElementById('timer');              // 作業時間の表示
const breakStatus = document.getElementById('break-status');     // 休けい時間の表示
const startStopBtn = document.getElementById('start-stop-btn');  // スタート／ストップボタン
const breakBtn = document.getElementById('break-btn');           // 休けいボタン
const recordList = document.getElementById('record-list');       // 記録の一覧
const totalList = document.getElementById('total-list');         // サイトごとの合計

// ブラウザに保存するときの「名前」（ロッカーの名札のようなもの）
const RECORDS_KEY = 'timeTracker_records'; // 記録の一覧
const RUNNING_KEY = 'timeTracker_running'; // いまはかっている作業
const SITES_KEY = 'timeTracker_sites';     // 今まで入れたサイト名のリスト
const TASKS_KEY = 'timeTracker_tasks';     // 今まで入れた工程のリスト

// 最初から入っているサイト名と工程
const DEFAULT_SITES = ['ポートフォリオ', 'Moon Bloom', 'シリウスサイト'];
const DEFAULT_TASKS = ['ヒアリング', '情報設計', 'ワイヤー', 'デザインカンプ', '実装', '検証', '修正', '調べもの'];

// 前のバージョンの名前を、新しい工程の名前に置きかえる表
const OLD_TASK_NAMES = {
    'デザイン': 'デザインカンプ',
    'コーディング': '実装'
};

// 文字の長さの上限（長すぎる文字で画面がくずれないように）
const MAX_NAME_LENGTH = 30;  // サイト名・工程
const MAX_MEMO_LENGTH = 100; // やったこと（メモ）

// =====================================================
// 2. 保存・読みこみのしくみ（安全対策つき）
// =====================================================

// ブラウザから安全にデータを取り出す
// もしデータがこわれていても、アプリが止まらないように「予備の値」を返す
function loadData(key, fallback) {
    try {
        const text = localStorage.getItem(key);
        if (text === null) {
            return fallback; // まだ何も保存されていない
        }
        return JSON.parse(text); // 文字をデータの形にもどす
    } catch (error) {
        return fallback; // こわれていたら予備の値を使う
    }
}

// ブラウザに安全にデータを保存する
function saveData(key, value) {
    try {
        // 保存できるのは文字だけなので、JSON.stringify で文字に変えてから保存する
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // 保存できる量がいっぱい、などで失敗したとき
        alert('記録を保存できませんでした。ブラウザの設定を確かめてください。');
    }
}

// メモの形が正しいかチェックする
// （前のバージョンの記録にはメモがないので、「ない」もOKにする）
function isValidMemo(memo) {
    return memo === undefined ||
        (typeof memo === 'string' && memo.length <= MAX_MEMO_LENGTH);
}

// 記録の形が正しいかチェックする（おかしなデータを読みこまないため）
function isValidRecord(record) {
    if (record === null || typeof record !== 'object') return false;
    if (typeof record.site !== 'string' || record.site === '') return false; // サイト名が文字で、空っぽでないか
    if (typeof record.task !== 'string' || record.task === '') return false; // 工程が文字で、空っぽでないか
    if (!isValidMemo(record.memo)) return false;              // メモが正しい形か
    if (!Number.isFinite(record.startTime)) return false;     // 始めた時刻が数字か
    if (!Number.isFinite(record.endTime)) return false;       // 終わった時刻が数字か
    if (record.endTime < record.startTime) return false;      // 終わりが始まりより後か

    // 休けい時間（前のバージョンの記録にはないので、「ない」もOK）
    if (record.breakTime !== undefined) {
        if (!Number.isFinite(record.breakTime)) return false;   // 数字か
        if (record.breakTime < 0) return false;                 // マイナスでないか
        if (record.breakTime > record.endTime - record.startTime) return false; // 全体より長くないか
    }
    return true;
}

// はかっている途中のデータの形が正しいかチェックする
function isValidRunning(data) {
    const now = Date.now();
    if (data === null || typeof data !== 'object') return false;
    if (typeof data.site !== 'string') return false;
    if (typeof data.task !== 'string') return false;
    if (!isValidMemo(data.memo)) return false;
    if (!Number.isFinite(data.startTime)) return false;
    if (data.startTime > now) return false; // 未来の時刻になっていないか

    // 休けいの合計（なくてもOK）
    if (data.breakTotal !== undefined) {
        if (!Number.isFinite(data.breakTotal) || data.breakTotal < 0) return false;
    }
    // 休けいを始めた時刻（休けい中でなければ null）
    if (data.breakStart !== undefined && data.breakStart !== null) {
        if (!Number.isFinite(data.breakStart)) return false;
        if (data.breakStart < data.startTime || data.breakStart > now) return false;
    }
    return true;
}

// サイト名・工程のリストを安全に取り出す
// 文字だけ・空っぽでない・長すぎない・同じものがない、を守ったリストにする
// （全部消して空っぽにしたときは、空っぽのままにする）
function loadNameList(key, defaults) {
    const loaded = loadData(key, null);
    if (!Array.isArray(loaded)) {
        return defaults.slice(); // まだ保存されていなければ、最初のリストのコピーを使う
    }
    const cleanList = [];
    loaded.forEach(function (name) {
        if (typeof name !== 'string') return;              // 文字でなければ飛ばす
        const trimmed = name.trim();                       // 前後の空白を取る
        if (trimmed === '') return;                        // 空っぽなら飛ばす
        if (trimmed.length > MAX_NAME_LENGTH) return;      // 長すぎたら飛ばす
        if (cleanList.includes(trimmed)) return;           // 同じものがあれば飛ばす
        cleanList.push(trimmed);
    });
    return cleanList;
}

// =====================================================
// 3. データを用意する
// =====================================================

// 工程のリストがまだ保存されていない ＝ 新しいバージョンを初めて開いた、ということ
const isFirstTimeNewVersion = localStorage.getItem(TASKS_KEY) === null;

// 今まで入れたサイト名と工程のリスト
let sites = loadNameList(SITES_KEY, DEFAULT_SITES);
let tasks = loadNameList(TASKS_KEY, DEFAULT_TASKS);

// 保存してある記録を取り出して、正しい形のものだけ使う
const loadedRecords = loadData(RECORDS_KEY, []);
let records = Array.isArray(loadedRecords) ? loadedRecords.filter(isValidRecord) : [];

// はかっている途中の作業を取り出す（正しくなければ null ＝ 何もない）
const loadedRunning = loadData(RUNNING_KEY, null);
let running = isValidRunning(loadedRunning) ? loadedRunning : null;

// 新しいバージョンを初めて開いたときだけ、前の工程の名前を新しい名前に置きかえる
// 例：「デザイン」→「デザインカンプ」、「コーディング」→「実装」
if (isFirstTimeNewVersion) {
    records.forEach(function (record) {
        if (OLD_TASK_NAMES[record.task]) {
            record.task = OLD_TASK_NAMES[record.task];
        }
    });
    if (running && OLD_TASK_NAMES[running.task]) {
        running.task = OLD_TASK_NAMES[running.task];
        saveData(RUNNING_KEY, running);
    }
    saveData(RECORDS_KEY, records);
    saveData(SITES_KEY, sites);
    saveData(TASKS_KEY, tasks);
}

// 1秒ごとに時間を更新するしくみの番号（止めるときに使う）
let timerId = null;

// =====================================================
// 4. べんりな関数
// =====================================================

// ミリ秒（1000分の1秒）を「00:00:00」の形にする
function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000)); // 全部で何秒か（マイナスにならないように）
    const hours = Math.floor(totalSeconds / 3600);           // 時間
    const minutes = Math.floor((totalSeconds % 3600) / 60);  // 分
    const seconds = totalSeconds % 60;                       // 秒

    // padStart(2, '0') は「2けたにならなければ前に0をつける」（5 → 05）
    return String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
}

// 日時を「10/20 13:37」の形にする
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1; // 月は0から始まるので+1する
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return month + '/' + day + ' ' + hours + ':' + minutes;
}

// 記録の「作業時間」を出す（終わり − 始まり − 休けい）
function getWorkTime(record) {
    return record.endTime - record.startTime - (record.breakTime || 0);
}

// 入力されたメモを、保存してよい形に整える
// （前後の空白を取って、長すぎたら上限で切る）
function cleanMemo(text) {
    return text.trim().slice(0, MAX_MEMO_LENGTH);
}

// 入力されたサイト名・工程を、保存してよい形に整える
function cleanName(text) {
    return text.trim().slice(0, MAX_NAME_LENGTH);
}

// タグを作って、クラス名と文字を入れる
// textContent を使うので、文字の中に <script> などがあっても「ただの文字」として表示される（安全）
function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

// 選ぶ箱(select)の中身を、リストから作り直す（edit.js などで使う）
function fillSelect(select, list) {
    const current = select.value; // 今選んでいるものを覚えておく
    select.textContent = '';      // いったん中身を空にする
    list.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    // 前に選んでいたものがまだリストにあれば、それを選んだままにする
    if (list.includes(current)) {
        select.value = current;
    }
}

// 選ぶ箱にその名前がなければ足す（リストにない名前も表示できるように）
function ensureOption(select, name) {
    const exists = Array.from(select.options).some(function (option) {
        return option.value === name;
    });
    if (!exists) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
    select.value = name;
}

// 名前がリストになければ足して保存する（サイト名・工程の共通）
function addNameIfNew(list, key, name) {
    if (!list.includes(name)) {
        list.push(name);
        saveData(key, list);
    }
}

// =====================================================
// 5. スタート／ストップ／休けいのしくみ
// =====================================================

// スタートしたとき
function start() {
    // サイト名と工程をチェックする
    const site = cleanName(siteSelect.value);
    const task = cleanName(taskSelect.value);
    if (site === '') {
        alert('サイト名を入れてください。');
        siteSelect.focus(); // 入力欄にカーソルを置く
        return;
    }
    if (task === '') {
        alert('工程を入れてください（やったことを入れると、自動で入ります）。');
        taskSelect.focus();
        return;
    }
    // 初めての名前なら、今まで入れたもののリストに足す
    addNameIfNew(sites, SITES_KEY, site);
    addNameIfNew(tasks, TASKS_KEY, task);

    // いまのサイト名・工程・メモ・始めた時刻をまとめる
    running = {
        site: site,
        task: task,
        memo: cleanMemo(memoInput.value),
        startTime: Date.now(), // いまの時刻
        breakTotal: 0,         // 休けいした時間の合計
        breakStart: null       // 休けいを始めた時刻（休けい中でなければ null）
    };
    // はかっている途中の作業もブラウザに保存しておく
    saveData(RUNNING_KEY, running);
    showRunning();
    renderAll(); // 新しい名前が、ToDoなどの選ぶ箱にも出るように
}

// はかっている間の画面にする
function showRunning() {
    // サイト名と工程を表示して、はかっている間は変えられないようにする
    siteSelect.value = running.site;
    taskSelect.value = running.task;
    siteSelect.disabled = true;
    taskSelect.disabled = true;

    // メモを表示する（ブラウザを閉じて開き直したときも、書いていたメモが出る）
    memoInput.value = running.memo || '';

    // ボタンを「ストップ」に変える
    startStopBtn.textContent = '■ ストップ';
    startStopBtn.classList.remove('btn-start');
    startStopBtn.classList.add('btn-stop');

    // 休けいボタンを出す
    breakBtn.hidden = false;
    updateBreakView();

    // すぐに1回表示して、そのあと1秒ごとに表示を更新する
    updateTimer();
    clearInterval(timerId); // 念のため、前の更新が動いていたら止める
    timerId = setInterval(updateTimer, 1000);
}

// いままでの休けいの合計時間を出す（休けい中なら、今の休けいもふくめる）
function getRunningBreakTime(now) {
    let total = running.breakTotal || 0;
    if (running.breakStart) {
        total += now - running.breakStart;
    }
    return total;
}

// 時間の表示を更新する
function updateTimer() {
    const now = Date.now();
    // 作業時間 ＝ いま − 始めた時刻 − 休けいの時間
    const workTime = now - running.startTime - getRunningBreakTime(now);
    timerText.textContent = formatTime(workTime);

    // 休けいの表示
    if (running.breakStart) {
        breakStatus.textContent = '休けい中 ' + formatTime(now - running.breakStart);
    } else if (running.breakTotal > 0) {
        breakStatus.textContent = '休けい 合計 ' + formatTime(running.breakTotal);
    } else {
        breakStatus.textContent = '';
    }
}

// 休けいボタンの見た目を、休けい中かどうかで変える
function updateBreakView() {
    if (running && running.breakStart) {
        // 休けい中
        breakBtn.textContent = '▶ 作業にもどる';
        breakBtn.classList.remove('btn-break');
        breakBtn.classList.add('btn-resume');
        timerText.classList.add('is-break');
    } else {
        // 作業中
        breakBtn.textContent = '☕ 休けい';
        breakBtn.classList.remove('btn-resume');
        breakBtn.classList.add('btn-break');
        timerText.classList.remove('is-break');
    }
}

// 休けいボタンが押されたとき
breakBtn.addEventListener('click', function () {
    if (!running) return; // はかっていないときは何もしない

    const now = Date.now();
    if (running.breakStart) {
        // 休けい中 → 作業にもどる：今回の休けいを合計に足す
        running.breakTotal = (running.breakTotal || 0) + (now - running.breakStart);
        running.breakStart = null;
    } else {
        // 作業中 → 休けいを始める
        running.breakStart = now;
    }
    saveData(RUNNING_KEY, running);
    updateBreakView();
    updateTimer();
});

// ストップしたとき
function stop() {
    // 休けい中にストップしたら、「休けいを始めたところで作業が終わった」ことにする
    const endTime = running.breakStart ? running.breakStart : Date.now();

    // 記録を1つ作って、一覧の一番上に追加する（unshift ＝ 先頭に足す）
    records.unshift({
        site: running.site,
        task: running.task,
        memo: cleanMemo(memoInput.value), // ストップした時点のメモを入れる
        startTime: running.startTime,
        endTime: endTime,
        breakTime: running.breakTotal || 0 // 休けいした時間の合計
    });
    saveData(RECORDS_KEY, records);

    // はかっている途中のデータを消す
    running = null;
    localStorage.removeItem(RUNNING_KEY);

    // 1秒ごとの更新を止めて、表示を元にもどす
    clearInterval(timerId);
    timerText.textContent = '00:00:00';
    breakStatus.textContent = '';
    siteSelect.disabled = false; // サイト名と工程は残しておく（続けて同じ作業をすることが多いので）
    taskSelect.disabled = false;
    memoInput.value = '';        // メモ欄は空にもどす

    // ボタンを「スタート」にもどして、休けいボタンをかくす
    startStopBtn.textContent = '▶ スタート';
    startStopBtn.classList.remove('btn-stop');
    startStopBtn.classList.add('btn-start');
    breakBtn.hidden = true;
    updateBreakView();

    // 画面を全部作り直す
    renderAll();
}

// ボタンが押されたとき：はかっている途中ならストップ、そうでなければスタート
startStopBtn.addEventListener('click', function () {
    if (running) {
        stop();
    } else {
        start();
    }
});

// はかっている途中にメモを書いたら、そのたびに保存する
// （途中でブラウザを閉じても、メモが消えないように）
memoInput.addEventListener('input', function () {
    if (running) {
        running.memo = cleanMemo(memoInput.value);
        saveData(RUNNING_KEY, running);
    }
});

// 記録を1つ消す
function deleteRecord(index) {
    if (confirm('この記録を消しますか？')) {
        records.splice(index, 1); // index番目の記録を1つ取りのぞく
        saveData(RECORDS_KEY, records);
        renderRecords();
    }
}

// =====================================================
// 6. 画面に表示する
// =====================================================

// 記録の一覧と合計を作り直す
function renderRecords() {
    // ----- 記録の一覧（日ごとにまとめて表示する。しくみは record-list.js） -----
    if (typeof renderRecordList === 'function') {
        renderRecordList();
    }

    // ----- サイトごとの合計（その中に工程ごとの合計） -----
    // 例：{ ポートフォリオ: { total: 7200000, tasks: { ワイヤー: 3600000, 実装: 3600000 } } }
    // Object.create(null) は、よけいな中身がない「まっさらな入れ物」を作る（安全のため）
    const totals = Object.create(null);

    records.forEach(function (record) {
        const time = getWorkTime(record); // 休けいをのぞいた作業時間

        // まだそのサイトの入れ物がなければ作る
        if (!totals[record.site]) {
            totals[record.site] = { total: 0, tasks: Object.create(null) };
        }
        const siteTotal = totals[record.site];

        siteTotal.total += time; // サイトの合計に足す
        // 工程ごとの合計に足す（まだなければ0から）
        siteTotal.tasks[record.task] = (siteTotal.tasks[record.task] || 0) + time;
    });

    totalList.textContent = '';

    if (records.length === 0) {
        totalList.appendChild(createElement('li', 'empty-text', 'まだ記録がありません'));
    }

    // サイト名を1つずつ取り出して、表示を作る
    Object.keys(totals).forEach(function (site) {
        const li = createElement('li', 'total-item');

        // 上の行：サイト名と合計時間
        const head = createElement('div', 'total-head');
        head.appendChild(createElement('span', '', site));
        head.appendChild(createElement('span', 'total-time', formatTime(totals[site].total)));
        li.appendChild(head);

        // 下のリスト：工程ごとの時間
        const subList = createElement('ul', 'total-sub');
        Object.keys(totals[site].tasks).forEach(function (task) {
            const subItem = createElement('li', 'total-sub-item');
            subItem.appendChild(createElement('span', '', task));
            subItem.appendChild(createElement('span', '', formatTime(totals[site].tasks[task])));
            subList.appendChild(subItem);
        });
        li.appendChild(subList);

        totalList.appendChild(li);
    });

    // グラフも作り直す（charts.js が読みこまれてからだけ動く）
    if (typeof renderCharts === 'function') {
        renderCharts();
    }

    // 予定と実際も作り直す（plan.js が読みこまれてからだけ動く）
    if (typeof renderPlans === 'function') {
        renderPlans();
    }
}

// 画面を全部作り直す
function renderAll() {
    renderRecords();
    // 工程の説明も更新する（glossary.js が読みこまれてからだけ動く）
    if (typeof updateTaskHint === 'function') {
        updateTaskHint();
    }
    // ToDoのサイト名も更新する（todo.js が読みこまれてからだけ動く）
    if (typeof renderTodos === 'function') {
        renderTodos();
    }
}

// =====================================================
// 7. ページを開いたときに最初に動くところ
// =====================================================
renderAll(); // 保存してある記録などを表示する

if (running) {
    // はかっている途中でブラウザを閉じていたら、続きから再開する
    // （休けい中に閉じていたら、休けい中のまま再開する）
    showRunning();
} else if (records.length > 0) {
    // はかっていなければ、最後に記録したサイト名と工程を最初から入れておく
    siteSelect.value = records[0].site;
    taskSelect.value = records[0].task;
}