// =====================================================
// 1. 画面の部品をつかまえる（HTMLのidを使って探す）
// =====================================================
const siteSelect = document.getElementById('site-select');       // サイト名を選ぶ箱
const taskSelect = document.getElementById('task-select');       // 作業の種類を選ぶ箱
const timerText = document.getElementById('timer');              // 時間の表示
const startStopBtn = document.getElementById('start-stop-btn');  // スタート／ストップボタン
const recordList = document.getElementById('record-list');       // 記録の一覧
const totalList = document.getElementById('total-list');         // サイトごとの合計

// ブラウザに保存するときの「名前」（ロッカーの名札のようなもの）
const RECORDS_KEY = 'timeTracker_records'; // 記録の一覧
const RUNNING_KEY = 'timeTracker_running'; // いまはかっている作業

// =====================================================
// 2. データを用意する
// =====================================================
// ブラウザに保存してある記録を取り出す。なければ空っぽの [] にする
let records = JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];

// はかっている途中の作業を取り出す（はかっていなければ null ＝ 何もない）
// ※これがあるので、はかっている途中でブラウザを閉じても続きから再開できる
let running = JSON.parse(localStorage.getItem(RUNNING_KEY));

// 1秒ごとに時間を更新するしくみの番号（止めるときに使う）
let timerId = null;

// =====================================================
// 3. べんりな関数
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

// 日時を「10/19 23:45」の形にする
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1; // 月は0から始まるので+1する
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return month + '/' + day + ' ' + hours + ':' + minutes;
}

// 記録の一覧をブラウザに保存する
function saveRecords() {
  // 保存できるのは文字だけなので、JSON.stringify で文字に変えてから保存する
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

// =====================================================
// 4. スタート／ストップのしくみ
// =====================================================

// スタートしたとき
function start() {
  // いま選んでいるサイト名・作業の種類・始めた時刻をまとめる
  running = {
    site: siteSelect.value,
    task: taskSelect.value,
    startTime: Date.now() // いまの時刻
  };
  // はかっている途中の作業もブラウザに保存しておく
  localStorage.setItem(RUNNING_KEY, JSON.stringify(running));
  showRunning();
}

// はかっている間の画面にする
function showRunning() {
  // 選んだものを表示して、はかっている間は変えられないようにする
  siteSelect.value = running.site;
  taskSelect.value = running.task;
  siteSelect.disabled = true;
  taskSelect.disabled = true;

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
    startTime: running.startTime,
    endTime: Date.now() // 終わった時刻
  });
  saveRecords();

  // はかっている途中のデータを消す
  running = null;
  localStorage.removeItem(RUNNING_KEY);

  // 1秒ごとの更新を止めて、表示を元にもどす
  clearInterval(timerId);
  timerText.textContent = '00:00:00';
  siteSelect.disabled = false;
  taskSelect.disabled = false;

  // ボタンを「スタート」にもどす
  startStopBtn.textContent = '▶ スタート';
  startStopBtn.classList.remove('btn-stop');
  startStopBtn.classList.add('btn-start');

  // 一覧と合計を作り直す
  render();
}

// ボタンが押されたとき：はかっている途中ならストップ、そうでなければスタート
startStopBtn.addEventListener('click', function () {
  if (running) {
    stop();
  } else {
    start();
  }
});

// =====================================================
// 5. 一覧と合計を画面に表示する
// =====================================================
function render() {
  // ----- 記録の一覧 -----
  recordList.innerHTML = ''; // いったん中身を空にする

  if (records.length === 0) {
    recordList.innerHTML = '<li class="empty-text">まだ記録がありません</li>';
  }

  // 記録を1つずつ取り出して、リストの1行(li)を作る
  records.forEach(function (record, index) {
    const li = document.createElement('li');
    li.className = 'record-item';
    li.innerHTML =
      '<div class="record-info">' +
        '<span class="record-site">' + record.site + '</span>' +
        '<span class="record-task">' + record.task + '</span>' +
        '<p class="record-date">' + formatDate(record.startTime) + ' 〜 ' + formatDate(record.endTime) + '</p>' +
      '</div>' +
      '<span class="record-time">' + formatTime(record.endTime - record.startTime) + '</span>' +
      // data-index に「何番目の記録か」を入れておく（消すときに使う）
      '<button class="delete-btn" data-index="' + index + '">消す</button>';
    recordList.appendChild(li);
  });

  // ----- サイトごとの合計 -----
  // 例：{ ポートフォリオ: 3600000, Moon Bloom: 1800000 } のような形で足していく
  const totals = {};
  records.forEach(function (record) {
    const time = record.endTime - record.startTime;
    // まだそのサイトがなければ0から、あればその数に足す
    totals[record.site] = (totals[record.site] || 0) + time;
  });

  totalList.innerHTML = '';

  if (records.length === 0) {
    totalList.innerHTML = '<li class="empty-text">まだ記録がありません</li>';
  }

  // サイト名を1つずつ取り出して、1行ずつ作る
  Object.keys(totals).forEach(function (site) {
    const li = document.createElement('li');
    li.className = 'total-item';
    li.innerHTML =
      '<span>' + site + '</span>' +
      '<span class="total-time">' + formatTime(totals[site]) + '</span>';
    totalList.appendChild(li);
  });
}

// 「消す」ボタンが押されたとき
// （ボタンは後から作られるので、一覧全体で押されたことを受け取る）
recordList.addEventListener('click', function (event) {
  // 押されたのが「消す」ボタンのときだけ動く
  if (event.target.classList.contains('delete-btn')) {
    if (confirm('この記録を消しますか？')) {
      const index = Number(event.target.dataset.index); // 何番目か
      records.splice(index, 1); // その記録を1つ取りのぞく
      saveRecords();
      render();
    }
  }
});

// =====================================================
// 6. ページを開いたときに最初に動くところ
// =====================================================
render(); // 保存してある記録を表示する

// はかっている途中でブラウザを閉じていたら、続きから再開する
if (running) {
  showRunning();
}