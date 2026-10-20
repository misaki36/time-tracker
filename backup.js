// =====================================================
// バックアップ（書き出し・読みこみ）のしくみ
// （records・sites・tasks・todos・isValidRecord・isValidTodo などは
//   script.js と todo.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const exportJsonBtn = document.getElementById('export-json-btn'); // バックアップを書き出すボタン
const exportCsvBtn = document.getElementById('export-csv-btn');   // CSVを書き出すボタン
const importInput = document.getElementById('import-input');      // ファイルを選ぶ入力欄
const backupStatus = document.getElementById('backup-status');    // お知らせ

// ----- 決まった値 -----
const BACKUP_APP_NAME = 'time-tracker'; // このアプリのファイルかどうかを見分ける名札
const BACKUP_VERSION = 1;               // ファイルの形のバージョン
const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 読みこめるファイルの大きさの上限（5MB）

// ----- べんりな関数 -----

// 2けたにそろえる（5 → 05）
function pad2(number) {
    return String(number).padStart(2, '0');
}

// ファイル名用の今日の日にち「20261020」
function todayForFileName() {
    const date = new Date();
    return date.getFullYear() + pad2(date.getMonth() + 1) + pad2(date.getDate());
}

// 日にちを「2026/10/20」の形にする
function formatFullDate(timestamp) {
    const date = new Date(timestamp);
    return date.getFullYear() + '/' + pad2(date.getMonth() + 1) + '/' + pad2(date.getDate());
}

// 時刻を「13:37」の形にする
function formatClock(timestamp) {
    const date = new Date(timestamp);
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

// お知らせを出す（isError が true なら赤い文字）
function showBackupStatus(message, isError) {
    backupStatus.textContent = message;
    backupStatus.classList.toggle('is-error', Boolean(isError));
}

// 文字をファイルにしてダウンロードする
function downloadFile(content, fileName, type) {
    // Blob ＝ ファイルの中身のかたまり
    const blob = new Blob([content], { type: type });
    // そのかたまりを、一時的なURLにする
    const url = URL.createObjectURL(blob);

    // 見えないリンクを作って、押したことにする → ダウンロードが始まる
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // 少したったら一時的なURLを消す（メモリをむだに使わないため）
    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

// サイト名・工程のリストを安全な形に整える（script.js の loadNameList と同じルール）
function cleanNameList(value, defaults) {
    if (!Array.isArray(value)) {
        return defaults.slice();
    }
    const cleanList = [];
    value.forEach(function (name) {
        if (typeof name !== 'string') return;
        const trimmed = name.trim();
        if (trimmed === '') return;
        if (trimmed.length > MAX_NAME_LENGTH) return;
        if (cleanList.includes(trimmed)) return;
        cleanList.push(trimmed);
    });
    return cleanList.length > 0 ? cleanList : defaults.slice();
}

// 配列の中身を、新しい中身に入れかえる
// （ほかのファイルも同じ配列を使っているので、新しく作り直さずに中身だけ入れかえる）
function replaceArray(array, newItems) {
    array.splice(0, array.length);
    newItems.forEach(function (item) {
        array.push(item);
    });
}

// =====================================================
// 1. バックアップを書き出す（JSONファイル）
// =====================================================
exportJsonBtn.addEventListener('click', function () {
    const data = {
        app: BACKUP_APP_NAME,
        version: BACKUP_VERSION,
        exportedAt: Date.now(), // 書き出した時刻
        records: records,
        sites: sites,
        tasks: tasks,
        todos: todos,
        // 予定と金額（plan.js があるときだけ）
        plans: typeof getPlansForBackup === 'function' ? getPlansForBackup() : {}
    };

    // JSON.stringify の「null, 2」は、人が読んでも分かりやすいように字下げする設定
    const content = JSON.stringify(data, null, 2);
    downloadFile(content, 'time-tracker-backup-' + todayForFileName() + '.json', 'application/json');
    showBackupStatus('バックアップを書き出しました（記録 ' + records.length + '件）', false);
});

// =====================================================
// 2. Excel用に書き出す（CSVファイル）
// =====================================================

// CSVの1マス分の文字を、安全な形にする
function csvCell(value) {
    let text = String(value);
    // 「=」「+」「-」「@」などで始まると、Excelが計算式として動かしてしまうことがある
    // → 先頭に「'」を付けて、ただの文字として出すようにする（安全のため）
    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }
    // 全体を「"」でかこみ、中の「"」は「""」にする（CSVのルール）
    return '"' + text.replace(/"/g, '""') + '"';
}

exportCsvBtn.addEventListener('click', function () {
    if (records.length === 0) {
        showBackupStatus('書き出す記録がまだありません', true);
        return;
    }

    // 1行目：見出し
    const rows = [[
        '日付', 'サイト名', '工程', 'メモ',
        '始めた時刻', '終わった時刻', '休けい（分）', '作業時間（分）', '作業時間'
    ]];

    // 古い順にならべて、1件ずつ1行にする（records 自体の順番は変えないようにコピーしてならべる）
    const sorted = records.slice().sort(function (a, b) {
        return a.startTime - b.startTime;
    });
    sorted.forEach(function (record) {
        const workTime = getWorkTime(record);
        rows.push([
            formatFullDate(record.startTime),
            record.site,
            record.task,
            record.memo || '',
            formatClock(record.startTime),
            formatClock(record.endTime),
            Math.round((record.breakTime || 0) / 60000),
            Math.round(workTime / 60000),
            formatTime(workTime)
        ]);
    });

    // マスを「,」でつなぎ、行を改行でつなぐ
    // 先頭の \uFEFF は「BOM」という目じるしで、これがないとExcelで日本語が文字化けする
    const content = '\uFEFF' + rows.map(function (row) {
        return row.map(csvCell).join(',');
    }).join('\r\n');

    downloadFile(content, 'time-tracker-' + todayForFileName() + '.csv', 'text/csv;charset=utf-8');
    showBackupStatus('CSVを書き出しました（記録 ' + records.length + '件）', false);
});

// =====================================================
// 3. バックアップを読みこむ
// =====================================================
importInput.addEventListener('change', function () {
    const file = importInput.files[0];
    importInput.value = ''; // 同じファイルをもう一度選べるように、選んだものを空にもどす

    if (!file) {
        return; // ファイルが選ばれなかった
    }
    if (running) {
        showBackupStatus('はかっている途中は読みこめません。ストップしてからにしてください。', true);
        return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
        showBackupStatus('ファイルが大きすぎます（5MBまで）', true);
        return;
    }

    // ファイルの中身を文字として読む
    file.text().then(function (text) {
        // 文字をデータの形にもどす（こわれていたらエラーになる）
        let data;
        try {
            data = JSON.parse(text);
        } catch (error) {
            showBackupStatus('ファイルの中身がこわれているようです', true);
            return;
        }

        // このアプリのバックアップファイルかチェックする
        if (data === null || typeof data !== 'object' ||
            data.app !== BACKUP_APP_NAME || !Array.isArray(data.records)) {
            showBackupStatus('このアプリのバックアップファイルではないようです', true);
            return;
        }

        // 中身を1つずつチェックして、正しい形のものだけ使う
        const newRecords = data.records.filter(isValidRecord);
        const newSites = cleanNameList(data.sites, DEFAULT_SITES);
        const newTasks = cleanNameList(data.tasks, DEFAULT_TASKS);
        const newTodos = Array.isArray(data.todos) ? data.todos.filter(isValidTodo) : [];
        const skipped = data.records.length - newRecords.length; // 読みこめなかった記録の数

        // 本当に入れかえていいか聞く
        const ok = confirm(
            '今の記録・設定・ToDoは、バックアップの内容に全部入れかわります。\n' +
            '（バックアップの記録：' + newRecords.length + '件）\n' +
            'よろしいですか？'
        );
        if (!ok) {
            return;
        }

        // 中身を入れかえる
        newRecords.sort(function (a, b) {
            return b.startTime - a.startTime; // 新しい順
        });
        replaceArray(records, newRecords);
        replaceArray(sites, newSites);
        replaceArray(tasks, newTasks);
        replaceArray(todos, newTodos);

        // 予定と金額も入れかえる（plan.js があるときだけ）
        if (typeof setPlansFromBackup === 'function') {
            setPlansFromBackup(data.plans);
        }

        // ブラウザに保存する
        saveData(RECORDS_KEY, records);
        saveData(SITES_KEY, sites);
        saveData(TASKS_KEY, tasks);
        saveData(TODOS_KEY, todos);

        // 画面を全部作り直す
        renderAll();

        let message = '読みこみました（記録 ' + newRecords.length + '件）';
        if (skipped > 0) {
            message += '　※こわれていて読みこめなかった記録：' + skipped + '件';
        }
        showBackupStatus(message, false);
    }).catch(function () {
        showBackupStatus('ファイルを読みこめませんでした', true);
    });
});