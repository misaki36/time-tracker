// =====================================================
// 1. 画面の部品をつかまえる（HTMLのidを使って探す）
// =====================================================
const siteSelect = document.getElementById('site-select');       // サイト名を選ぶ箱
const taskSelect = document.getElementById('task-select');       // 工程を選ぶ箱
const memoInput = document.getElementById('memo-input');         // メモの入力欄
const timerText = document.getElementById('timer');              // 時間の表示
const startStopBtn = document.getElementById('start-stop-btn');  // スタート／ストップボタン
const recordList = document.getElementById('record-list');       // 記録の一覧
const totalList = document.getElementById('total-list');         // サイトごとの合計

// 設定のところの部品
const siteForm = document.getElementById('site-form');                // サイト名を足すフォーム
const siteInput = document.getElementById('site-input');              // サイト名の入力欄
const siteSettingList = document.getElementById('site-setting-list'); // 今あるサイト名の一覧
const taskForm = document.getElementById('task-form');                // 工程を足すフォーム
const taskInput = document.getElementById('task-input');              // 工程の入力欄
const taskSettingList = document.getElementById('task-setting-list'); // 今ある工程の一覧

// ブラウザに保存するときの「名前」（ロッカーの名札のようなもの）
const RECORDS_KEY = 'timeTracker_records'; // 記録の一覧
const RUNNING_KEY = 'timeTracker_running'; // いまはかっている作業
const SITES_KEY = 'timeTracker_sites';     // サイト名のリスト
const TASKS_KEY = 'timeTracker_tasks';     // 工程のリスト

// 最初から入っているサイト名と工程
const DEFAULT_SITES = ['ポートフォリオ', 'Moon Bloom', 'シリウスサイト'];
const DEFAULT_TASKS = ['情報設計', 'ワイヤー', 'デザインカンプ', '実装', '修正', '調べもの'];

// 前のバージョンの名前を、新しい工程の名前に置きかえる表
const OLD_TASK_NAMES = {
    'デザイン': 'デザインカンプ',
    'コーディング': '実装'
};

// 文字の長さの上限（長すぎる文字で画面がくずれないように）
const MAX_NAME_LENGTH = 30;  // サイト名・工程
const MAX_MEMO_LENGTH = 100; // メモ

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
    return record !== null &&
        typeof record === 'object' &&
        typeof record.site === 'string' &&       // サイト名が文字か
        typeof record.task === 'string' &&       // 工程が文字か
        isValidMemo(record.memo) &&              // メモが正しい形か
        Number.isFinite(record.startTime) &&     // 始めた時刻が数字か
        Number.isFinite(record.endTime) &&       // 終わった時刻が数字か
        record.endTime >= record.startTime;      // 終わりが始まりより後か
}

// はかっている途中のデータの形が正しいかチェックする
function isValidRunning(data) {
    return data !== null &&
        typeof data === 'object' &&
        typeof data.site === 'string' &&
        typeof data.task === 'string' &&
        isValidMemo(data.memo) &&
        Number.isFinite(data.startTime) &&
        data.startTime <= Date.now(); // 未来の時刻になっていないか
}

// サイト名・工程のリストを安全に取り出す
// 文字だけ・空っぽでない・長すぎない・同じものがない、を守ったリストにする
function loadNameList(key, defaults) {
    const loaded = loadData(key, null);
    if (!Array.isArray(loaded)) {
        return defaults.slice(); // なければ最初のリストのコピーを使う
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
    // 1つも残らなかったら最初のリストにもどす
    return cleanList.length > 0 ? cleanList : defaults.slice();
}

// =====================================================
// 3. データを用意する
// =====================================================

// 工程のリストがまだ保存されていない ＝ 新しいバージョンを初めて開いた、ということ
const isFirstTimeNewVersion = localStorage.getItem(TASKS_KEY) === null;

// サイト名と工程のリスト
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
    const totalSeconds = Math.floor(ms / 1000);             // 全部で何秒か
    const hours = Math.floor(totalSeconds / 3600);          // 時間
    const minutes = Math.floor((totalSeconds % 3600) / 60); // 分
    const seconds = totalSeconds % 60;                      // 秒

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

// 入力されたメモを、保存してよい形に整える
// （前後の空白を取って、長すぎたら上限で切る）
function cleanMemo(text) {
    return text.trim().slice(0, MAX_MEMO_LENGTH);
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

// 選ぶ箱(select)の中身を、リストから作り直す
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

// 選ぶ箱にその名前がなければ足す（はかっている途中の名前を表示するため）
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

// =====================================================
// 5. スタート／ストップのしくみ
// =====================================================

// スタートしたとき
function start() {
    // いま選んでいるサイト名・工程・メモ・始めた時刻をまとめる
    running = {
        site: siteSelect.value,
        task: taskSelect.value,
        memo: cleanMemo(memoInput.value),
        startTime: Date.now() // いまの時刻
    };
    // はかっている途中の作業もブラウザに保存しておく
    saveData(RUNNING_KEY, running);
    showRunning();
}

// はかっている間の画面にする
function showRunning() {
    // 選んだものを表示して、はかっている間は変えられないようにする
    ensureOption(siteSelect, running.site);
    ensureOption(taskSelect, running.task);
    siteSelect.disabled = true;
    taskSelect.disabled = true;

    // メモを表示する（ブラウザを閉じて開き直したときも、書いていたメモが出る）
    memoInput.value = running.memo || '';

    // ボタンを「ストップ」に変える
    startStopBtn.textContent = '■ ストップ';
    startStopBtn.classList.remove('btn-start');
    startStopBtn.classList.add('btn-stop');

    // すぐに1回表示して、そのあと1秒ごとに表示を更新する
    updateTimer();
    timerId = setInterval(updateTimer, 1000);
}

// 時間の表示を更新する（「いまの時刻 − 始めた時刻」で、たった時間を出す）
function updateTimer() {
    timerText.textContent = formatTime(Date.now() - running.startTime);
}

// ストップしたとき
function stop() {
    // 記録を1つ作って、一覧の一番上に追加する（unshift ＝ 先頭に足す）
    records.unshift({
        site: running.site,
        task: running.task,
        memo: cleanMemo(memoInput.value), // ストップした時点のメモを入れる
        startTime: running.startTime,
        endTime: Date.now() // 終わった時刻
    });
    saveData(RECORDS_KEY, records);

    // はかっている途中のデータを消す
    running = null;
    localStorage.removeItem(RUNNING_KEY);

    // 1秒ごとの更新を止めて、表示を元にもどす
    clearInterval(timerId);
    timerText.textContent = '00:00:00';
    siteSelect.disabled = false;
    taskSelect.disabled = false;
    memoInput.value = ''; // メモ欄を空にもどす

    // ボタンを「スタート」にもどす
    startStopBtn.textContent = '▶ スタート';
    startStopBtn.classList.remove('btn-stop');
    startStopBtn.classList.add('btn-start');

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
// 6. サイト名・工程の設定（追加・削除）
// =====================================================

// 名前を1つ足す（サイト名でも工程でも使える共通の関数）
function addName(list, key, input, label) {
    const name = input.value.trim(); // 前後の空白を取る

    if (name === '') {
        return; // 空っぽなら何もしない
    }
    if (name.length > MAX_NAME_LENGTH) {
        alert(label + 'は' + MAX_NAME_LENGTH + '文字までにしてください。');
        return;
    }
    if (list.includes(name)) {
        alert('「' + name + '」はもうあります。');
        return;
    }

    list.push(name);     // リストに足す
    saveData(key, list); // 保存する
    input.value = '';    // 入力欄を空にもどす
    renderAll();
}

// 名前を1つ消す（サイト名でも工程でも使える共通の関数）
function deleteName(list, key, name, runningName) {
    if (list.length <= 1) {
        alert('1つは残しておいてください。');
        return;
    }
    if (running && runningName === name) {
        alert('はかっている途中なので消せません。ストップしてから消してください。');
        return;
    }
    if (!confirm('「' + name + '」を選ぶリストから消しますか？\n（これまでの記録は消えません）')) {
        return;
    }

    const index = list.indexOf(name);
    list.splice(index, 1); // リストから取りのぞく
    saveData(key, list);
    renderAll();
}

// サイト名のフォームで「追加」が押されたとき
siteForm.addEventListener('submit', function (event) {
    event.preventDefault(); // ページが読みこみ直されないようにする
    addName(sites, SITES_KEY, siteInput, 'サイト名');
});

// 工程のフォームで「追加」が押されたとき
taskForm.addEventListener('submit', function (event) {
    event.preventDefault();
    addName(tasks, TASKS_KEY, taskInput, '工程');
});

// 設定の一覧（丸いラベル）を作る
function renderSettingList(ul, list, onDelete) {
    ul.textContent = '';
    list.forEach(function (name) {
        const li = createElement('li', 'setting-item');
        li.appendChild(createElement('span', '', name));

        // 「×」ボタン（押したらその名前を消す）
        const deleteBtn = createElement('button', 'setting-delete', '×');
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', name + 'を消す'); // 読み上げソフト用の説明
        deleteBtn.addEventListener('click', function () {
            onDelete(name);
        });
        li.appendChild(deleteBtn);

        ul.appendChild(li);
    });
}

// =====================================================
// 7. 画面に表示する
// =====================================================

// 選ぶ箱と設定の一覧を作り直す
function renderSettings() {
    // はかっている途中は、選ぶ箱を作り直さない（表示がずれないように）
    if (!running) {
        fillSelect(siteSelect, sites);
        fillSelect(taskSelect, tasks);
    }

    renderSettingList(siteSettingList, sites, function (name) {
        deleteName(sites, SITES_KEY, name, running ? running.site : null);
    });
    renderSettingList(taskSettingList, tasks, function (name) {
        deleteName(tasks, TASKS_KEY, name, running ? running.task : null);
    });
}

// 記録の一覧と合計を作り直す
function renderRecords() {
    // ----- 記録の一覧 -----
    recordList.textContent = ''; // いったん中身を空にする

    if (records.length === 0) {
        recordList.appendChild(createElement('li', 'empty-text', 'まだ記録がありません'));
    }

    // 記録を1つずつ取り出して、リストの1行(li)を作る
    records.forEach(function (record, index) {
        const li = createElement('li', 'record-item');

        // 左側：サイト名・工程・メモ・日時
        const info = createElement('div', 'record-info');
        info.appendChild(createElement('span', 'record-site', record.site));
        info.appendChild(createElement('span', 'record-task', record.task));
        // メモがあるときだけ表示する
        if (record.memo) {
            info.appendChild(createElement('p', 'record-memo', 'メモ：' + record.memo));
        }
        info.appendChild(createElement('p', 'record-date',
            formatDate(record.startTime) + ' 〜 ' + formatDate(record.endTime)));
        li.appendChild(info);

        // 右側：かかった時間
        li.appendChild(createElement('span', 'record-time',
            formatTime(record.endTime - record.startTime)));

        // 「直す」ボタン（押したら、この記録を直す画面が開く。しくみは edit.js）
        const editBtn = createElement('button', 'edit-btn', '直す');
        editBtn.type = 'button';
        editBtn.addEventListener('click', function () {
            openEditDialog(index);
        });
        li.appendChild(editBtn);
        // 「消す」ボタン（押したら、この記録だけ消す）
        const deleteBtn = createElement('button', 'delete-btn', '消す');
        deleteBtn.type = 'button';
        deleteBtn.addEventListener('click', function () {
            deleteRecord(index);
        });
        li.appendChild(deleteBtn);

        recordList.appendChild(li);
    });

    // ----- サイトごとの合計（その中に工程ごとの合計） -----
    // 例：{ ポートフォリオ: { total: 7200000, tasks: { ワイヤー: 3600000, 実装: 3600000 } } }
    // Object.create(null) は、よけいな中身がない「まっさらな入れ物」を作る（安全のため）
    const totals = Object.create(null);

    records.forEach(function (record) {
        const time = record.endTime - record.startTime;

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
}

// 画面を全部作り直す
function renderAll() {
    renderSettings();
    renderRecords();
    // 工程の説明も更新する（glossary.js が読みこまれてからだけ動く）
    if (typeof updateTaskHint === 'function') {
        updateTaskHint();
    }
}

// =====================================================
// 8. ページを開いたときに最初に動くところ
// =====================================================
renderAll(); // 保存してある設定と記録を表示する

// はかっている途中でブラウザを閉じていたら、続きから再開する
if (running) {
    showRunning();
}