// =====================================================
// 記録を直す・手で足すしくみ
// （records・sites・tasks・saveData などは script.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const editDialog = document.getElementById('edit-dialog');        // 直す画面（まど）
const editForm = document.getElementById('edit-form');            // 直す画面のフォーム
const editTitle = document.getElementById('edit-title');          // 見出し
const editSite = document.getElementById('edit-site');            // サイト名
const editTask = document.getElementById('edit-task');            // 工程
const editMemo = document.getElementById('edit-memo');            // メモ
const editStart = document.getElementById('edit-start');          // 始めた時刻
const editEnd = document.getElementById('edit-end');              // 終わった時刻
const editBreak = document.getElementById('edit-break');          // 休けい（分）
const editError = document.getElementById('edit-error');          // まちがいのお知らせ
const editCancelBtn = document.getElementById('edit-cancel-btn'); // 「やめる」ボタン
const addRecordBtn = document.getElementById('add-record-btn');   // 「＋ 記録を手で足す」ボタン

// いま何番目の記録を直しているか（null ＝ 直すのではなく、新しく足している）
let editingIndex = null;

// 長すぎる記録のめやす（これより長いと「本当にいい？」と聞く）
const LONG_RECORD_TIME = 12 * 60 * 60 * 1000; // 12時間

// 1分をミリ秒にしたもの
const ONE_MINUTE = 60 * 1000;

// ----- べんりな関数 -----

// 時刻(数字)を、入力欄に入れられる形「2026-10-20T13:37」にする
function toInputValue(timestamp) {
    const date = new Date(timestamp);
    const pad = function (number) {
        return String(number).padStart(2, '0'); // 2けたにそろえる
    };
    return date.getFullYear() + '-' +
        pad(date.getMonth() + 1) + '-' +
        pad(date.getDate()) + 'T' +
        pad(date.getHours()) + ':' +
        pad(date.getMinutes());
}

// 入力欄の値「2026-10-20T13:37」を、時刻(数字)にもどす
// （空っぽのときは NaN ＝「数字じゃない」になる）
function fromInputValue(value) {
    if (!value) {
        return NaN;
    }
    return new Date(value).getTime();
}

// 休けい時間(ミリ秒)を「分」にする（入力欄に入れるため）
function toBreakMinutes(breakTime) {
    return Math.round((breakTime || 0) / ONE_MINUTE);
}

// まちがいのお知らせを出す
function showEditError(message) {
    editError.textContent = message;
}

// ----- 直す画面を開く -----
// index に数字が入っていれば「その記録を直す」、null なら「新しく足す」
function openEditDialog(index) {
    editingIndex = index;
    showEditError(''); // 前のお知らせを消す

    // サイト名・工程の選ぶ箱を、設定のリストから作る
    fillSelect(editSite, sites);
    fillSelect(editTask, tasks);

    if (index === null) {
        // ----- 新しく足すとき -----
        editTitle.textContent = '記録を手で足す';
        // 上の「いまの作業」で選んでいるものを、最初から選んでおく
        // 「いまの作業」のサイト名を最初から選んでおく（空っぽなら、リストの一番上のまま）
        if (siteSelect.value.trim() !== '') {
            ensureOption(editSite, siteSelect.value.trim());
        }
        ensureOption(editTask, taskSelect.value);
        editMemo.value = '';
        // 時刻は「1時間前 〜 いま」を最初に入れておく
        const now = Date.now();
        editStart.value = toInputValue(now - 60 * ONE_MINUTE);
        editEnd.value = toInputValue(now);
        editBreak.value = 0;
    } else {
        // ----- 直すとき：今の記録の内容を入れておく -----
        const record = records[index];
        editTitle.textContent = '記録を直す';
        // 設定から消したサイト名・工程でも表示できるように ensureOption を使う
        ensureOption(editSite, record.site);
        ensureOption(editTask, record.task);
        editMemo.value = record.memo || '';
        editStart.value = toInputValue(record.startTime);
        editEnd.value = toInputValue(record.endTime);
        editBreak.value = toBreakMinutes(record.breakTime);
    }

    editDialog.showModal(); // 画面の上に重ねて開く
}

// ----- 「保存」が押されたとき -----
editForm.addEventListener('submit', function (event) {
    event.preventDefault(); // ページが読みこみ直されないようにする

    // 直す前の記録（新しく足すときは null）
    const original = editingIndex === null ? null : records[editingIndex];

    let startTime = fromInputValue(editStart.value);
    let endTime = fromInputValue(editEnd.value);
    const breakMinutes = Number(editBreak.value || 0); // 空っぽなら0分
    let breakTime = breakMinutes * ONE_MINUTE;

    // さわっていないところは、元の値（秒まで入っている）をそのまま使う
    // （入力欄は「分」までなので、そのままだと秒が消えてしまうため）
    if (original) {
        if (editStart.value === toInputValue(original.startTime)) {
            startTime = original.startTime;
        }
        if (editEnd.value === toInputValue(original.endTime)) {
            endTime = original.endTime;
        }
        if (breakMinutes === toBreakMinutes(original.breakTime)) {
            breakTime = original.breakTime || 0;
        }
    }

    // ----- まちがった入力をチェックする -----
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        showEditError('始めた時刻と終わった時刻を入れてください。');
        return;
    }
    if (endTime <= startTime) {
        showEditError('終わった時刻は、始めた時刻より後にしてください。');
        return;
    }
    if (endTime > Date.now() + ONE_MINUTE) {
        showEditError('まだ来ていない時刻は入れられません。');
        return;
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
        showEditError('休けいは0分以上の数字で入れてください。');
        return;
    }
    if (breakTime >= endTime - startTime) {
        showEditError('休けいが、始めてから終わるまでの時間より長くなっています。');
        return;
    }
    if (endTime - startTime > LONG_RECORD_TIME) {
        if (!confirm('12時間より長い記録です。このまま保存しますか？')) {
            return;
        }
    }

    // 新しい記録の形にまとめる
    const newRecord = {
        site: editSite.value,
        task: editTask.value,
        memo: cleanMemo(editMemo.value),
        startTime: startTime,
        endTime: endTime,
        breakTime: breakTime
    };

    // 最後に、script.js と同じチェックもしておく（安全のため）
    if (!isValidRecord(newRecord)) {
        showEditError('入力した内容を確かめてください。');
        return;
    }

    if (editingIndex === null) {
        records.push(newRecord);              // 新しく足す
    } else {
        records[editingIndex] = newRecord;    // 直した記録に入れかえる
    }

    // 時刻を直すと順番がずれるので、新しい順（始めた時刻が新しいものが上）に並べ直す
    records.sort(function (a, b) {
        return b.startTime - a.startTime;
    });

    saveData(RECORDS_KEY, records);
    editDialog.close(); // 直す画面を閉じる
    renderRecords();    // 一覧と合計を作り直す
});

// 「やめる」が押されたら、何もせずに閉じる
editCancelBtn.addEventListener('click', function () {
    editDialog.close();
});

// 「＋ 記録を手で足す」が押されたら、新しく足す画面を開く
addRecordBtn.addEventListener('click', function () {
    openEditDialog(null);
});