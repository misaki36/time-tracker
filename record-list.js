// =====================================================
// 記録の一覧を、日ごとにまとめて表示するしくみ
// （records・sites・recordList・getWorkTime・formatTime・createElement・
//   deleteRecord は script.js、openEditDialog は edit.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const recordPeriod = document.getElementById('record-period');          // 期間を選ぶ箱
const recordSiteFilter = document.getElementById('record-site-filter'); // サイトを選ぶ箱
const recordSummary = document.getElementById('record-summary');        // まとめ

// ----- 決まった値 -----
const LIST_WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const LIST_OPEN_DAYS = 3; // 新しい3日分は、最初から開いておく

// いまサイトで「しぼって」いるもの（'' ＝ すべてのサイト）
let recordSiteFilterValue = '';

// ----- べんりな関数（ほかのファイルと名前がかぶらないように「list」を付けています） -----

// その日の0時0分の時刻を出す
function listStartOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

// ◯日後（マイナスなら◯日前）の時刻を出す
function listAddDays(timestamp, days) {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + days);
    return date.getTime();
}

// 時刻を「16:20」の形にする
function listClock(timestamp) {
    const date = new Date(timestamp);
    return String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0');
}

// 日にちの見出しを「10/20(火)　今日」の形にする
function formatDayHeading(dayStart) {
    const today = listStartOfDay(Date.now());
    const date = new Date(dayStart);
    let text = (date.getMonth() + 1) + '/' + date.getDate() +
        '(' + LIST_WEEK_LABELS[date.getDay()] + ')';
    if (dayStart === today) {
        text += '　今日';
    } else if (dayStart === listAddDays(today, -1)) {
        text += '　昨日';
    }
    return text;
}

// 選んだ期間の始まりの時刻を出す
function getListPeriodStart() {
    const today = listStartOfDay(Date.now());
    if (recordPeriod.value === 'today') return today;
    if (recordPeriod.value === '7days') return listAddDays(today, -6);
    if (recordPeriod.value === '30days') return listAddDays(today, -29);
    return -Infinity; // 「すべて」（いちばん昔から）
}

// ----- サイトを選ぶ箱を作り直す -----
function renderRecordSiteFilter() {
    // 設定のサイト名＋記録があるサイト名
    const names = sites.slice();
    records.forEach(function (record) {
        if (!names.includes(record.site)) {
            names.push(record.site);
        }
    });

    recordSiteFilter.textContent = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'すべてのサイト';
    recordSiteFilter.appendChild(allOption);

    names.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        recordSiteFilter.appendChild(option);
    });

    // 前に選んでいたサイトがなくなっていたら「すべて」にもどす
    if (recordSiteFilterValue !== '' && !names.includes(recordSiteFilterValue)) {
        recordSiteFilterValue = '';
    }
    recordSiteFilter.value = recordSiteFilterValue;
}

// ----- 記録1件分の行を作る -----
// index は records の中で何番目か（「直す」「消す」で使う）
function createRecordItem(record, index) {
    const li = createElement('li', 'record-item');

    // 左側：サイト名・工程・メモ・時刻・休けい
    const info = createElement('div', 'record-info');
    info.appendChild(createElement('span', 'record-site', record.site));
    info.appendChild(createElement('span', 'record-task', record.task));
    if (record.memo) {
        info.appendChild(createElement('p', 'record-memo', 'メモ：' + record.memo));
    }

    // 時刻（日をまたいだときは、終わりの日にちも出す）
    let timeText = listClock(record.startTime) + ' 〜 ';
    if (listStartOfDay(record.endTime) !== listStartOfDay(record.startTime)) {
        const end = new Date(record.endTime);
        timeText += (end.getMonth() + 1) + '/' + end.getDate() + ' ';
    }
    timeText += listClock(record.endTime);
    info.appendChild(createElement('p', 'record-date', timeText));

    if (record.breakTime > 0) {
        info.appendChild(createElement('p', 'record-break', '休けい ' + formatTime(record.breakTime)));
    }
    li.appendChild(info);

    // 右側：作業時間（休けいをのぞいた時間）
    li.appendChild(createElement('span', 'record-time', formatTime(getWorkTime(record))));

    // 「直す」ボタン
    const editBtn = createElement('button', 'edit-btn', '直す');
    editBtn.type = 'button';
    editBtn.addEventListener('click', function () {
        openEditDialog(index);
    });
    li.appendChild(editBtn);

    // 「消す」ボタン
    const deleteBtn = createElement('button', 'delete-btn', '消す');
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', function () {
        deleteRecord(index);
    });
    li.appendChild(deleteBtn);

    return li;
}

// =====================================================
// 記録の一覧を作り直す（script.js の renderRecords からも呼ばれる）
// =====================================================
function renderRecordList() {
    renderRecordSiteFilter();
    recordList.textContent = ''; // いったん中身を空にする

    const periodStart = getListPeriodStart();

    // 日ごとのかたまりを作る
    // Map ＝ 「日にち → その日のかたまり」を覚えておく入れ物
    const groupMap = new Map();
    let count = 0; // この期間の件数
    let total = 0; // この期間の合計時間

    records.forEach(function (record, index) {
        if (record.startTime < periodStart) return; // 期間より前は飛ばす
        if (recordSiteFilterValue !== '' && record.site !== recordSiteFilterValue) return; // ちがうサイトは飛ばす

        const day = listStartOfDay(record.startTime); // 始めた日に入れる
        if (!groupMap.has(day)) {
            groupMap.set(day, { day: day, items: [], total: 0 });
        }
        const group = groupMap.get(day);
        group.items.push({ record: record, index: index });
        group.total += getWorkTime(record);

        count += 1;
        total += getWorkTime(record);
    });

    // まとめ
    if (count === 0) {
        recordSummary.textContent = 'この期間の記録はありません';
        return;
    }
    recordSummary.textContent = 'この期間：' + count + '件・合計 ' + formatTime(total);

    // 新しい日が上になるようにならべる
    const groups = Array.from(groupMap.values()).sort(function (a, b) {
        return b.day - a.day;
    });

    groups.forEach(function (group, groupIndex) {
        const li = createElement('li', 'record-day');

        // details ＝ 押すと開いたり閉じたりするタグ（新しい3日分は最初から開いておく）
        const details = document.createElement('details');
        details.open = groupIndex < LIST_OPEN_DAYS;

        // 見出し：日にちと、その日の合計
        const summary = createElement('summary', 'record-day-head');
        summary.appendChild(createElement('span', 'record-day-date', formatDayHeading(group.day)));
        summary.appendChild(createElement('span', 'record-day-total', formatTime(group.total)));
        details.appendChild(summary);

        // その日の記録（新しい順）
        const dayList = createElement('ul', 'record-day-list');
        group.items.sort(function (a, b) {
            return b.record.startTime - a.record.startTime;
        });
        group.items.forEach(function (item) {
            dayList.appendChild(createRecordItem(item.record, item.index));
        });
        details.appendChild(dayList);

        li.appendChild(details);
        recordList.appendChild(li);
    });
}

// ----- 期間やサイトを選びなおしたとき -----
recordPeriod.addEventListener('change', renderRecordList);

recordSiteFilter.addEventListener('change', function () {
    recordSiteFilterValue = recordSiteFilter.value;
    renderRecordList();
});

// ----- ページを開いたときに最初に動くところ -----
renderRecordList();