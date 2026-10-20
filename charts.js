// =====================================================
// グラフのしくみ（Chart.js という道具を使う）
// （records・sites・tasks・getWorkTime・formatTime は script.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const todayTotal = document.getElementById('today-total');   // 今日の合計
const barBox = document.getElementById('bar-box');           // 棒グラフの箱
const barCanvas = document.getElementById('bar-chart');      // 棒グラフをかく板
const barEmpty = document.getElementById('bar-empty');       // 棒グラフの「記録がありません」
const pieBox = document.getElementById('pie-box');           // 円グラフの箱
const pieCanvas = document.getElementById('pie-chart');      // 円グラフをかく板
const pieEmpty = document.getElementById('pie-empty');       // 円グラフの「記録がありません」
const chartPeriod = document.getElementById('chart-period'); // 期間を選ぶ箱
const chartGroup = document.getElementById('chart-group');   // 分け方を選ぶ箱

// ----- 決まった値 -----
const ONE_HOUR = 60 * 60 * 1000; // 1時間をミリ秒にしたもの
const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']; // 曜日

// グラフの色（やさしい色を順番に使う。足りなくなったら最初にもどる）
const CHART_COLORS = [
    '#6b8e7f', '#d9a679', '#8fa9c8', '#d98c8c', '#b39ddb',
    '#a3c48c', '#e0c070', '#7fb8b8', '#c49a6c', '#9e9e9e'
];

// 作ったグラフを入れておく（作り直すとき、前のグラフを消すために使う）
let barChart = null;
let pieChart = null;

// グラフ全体の文字の設定
Chart.defaults.font.family = '"Hiragino Sans", "Noto Sans JP", sans-serif';
Chart.defaults.color = '#555555';

// ----- べんりな関数 -----

// その日の0時0分の時刻を出す
function startOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

// ◯日後（マイナスなら◯日前）の時刻を出す
function addDays(timestamp, days) {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + days);
    return date.getTime();
}

// 日にちを「10/20(火)」の形にする
function formatDay(timestamp) {
    const date = new Date(timestamp);
    return (date.getMonth() + 1) + '/' + date.getDate() + '(' + WEEK_LABELS[date.getDay()] + ')';
}

// 名前ごとに、いつも同じ色を使うしくみ
// （設定のリストの順番で色を決めるので、棒グラフと円グラフで同じサイトは同じ色になる）
function makeColorPicker(baseList) {
    const extra = []; // 設定のリストにない名前（設定から消したものなど）
    return function (name) {
        let index = baseList.indexOf(name);
        if (index === -1) {
            let extraIndex = extra.indexOf(name);
            if (extraIndex === -1) {
                extra.push(name);
                extraIndex = extra.length - 1;
            }
            index = baseList.length + extraIndex;
        }
        return CHART_COLORS[index % CHART_COLORS.length];
    };
}

// グラフか「記録がありません」のどちらかを出す
function showChartOrEmpty(box, empty, hasData) {
    box.hidden = !hasData;
    empty.hidden = hasData;
}

// ----- 今日の合計 -----
function renderTodayTotal() {
    const today = startOfDay(Date.now());
    let total = 0;
    records.forEach(function (record) {
        if (record.startTime >= today) {
            total += getWorkTime(record);
        }
    });
    todayTotal.textContent = '今日の作業時間　' + formatTime(total);
}

// ----- 棒グラフ：この7日間の作業時間（サイトごとに積み上げ） -----
function renderBarChart() {
    // 7日分の日にち（6日前 〜 今日）を用意する
    const today = startOfDay(Date.now());
    const days = [];
    for (let i = 6; i >= 0; i--) {
        days.push(addDays(today, -i));
    }

    // サイトごとに、7日分の時間（時間の単位）を入れる
    // 例：{ ポートフォリオ: [0, 1.5, 2, 0, 0, 3, 1] }
    const bySite = Object.create(null);
    records.forEach(function (record) {
        const dayIndex = days.indexOf(startOfDay(record.startTime)); // 何日目か
        if (dayIndex === -1) return; // 7日間に入っていなければ飛ばす

        if (!bySite[record.site]) {
            bySite[record.site] = [0, 0, 0, 0, 0, 0, 0];
        }
        bySite[record.site][dayIndex] += getWorkTime(record) / ONE_HOUR;
    });

    const siteNames = Object.keys(bySite);
    const pickColor = makeColorPicker(sites);

    // 前のグラフがあれば消す
    if (barChart) {
        barChart.destroy();
        barChart = null;
    }

    showChartOrEmpty(barBox, barEmpty, siteNames.length > 0);
    if (siteNames.length === 0) return;

    barChart = new Chart(barCanvas, {
        type: 'bar', // 棒グラフ
        data: {
            labels: days.map(formatDay), // 下にならぶ日にち
            datasets: siteNames.map(function (site) {
                return {
                    label: site,
                    data: bySite[site],
                    backgroundColor: pickColor(site),
                    borderRadius: 4 // 棒の角を少し丸くする
                };
            })
        },
        options: {
            responsive: true,           // 画面の幅に合わせる
            maintainAspectRatio: false, // 高さは .chart-box に合わせる
            interaction: {
                mode: 'index',    // マウスをのせた日の、全部のサイトの時間を出す
                intersect: false
            },
            scales: {
                x: { stacked: true },     // 積み上げる
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value + '時間'; // 左の目もりに「時間」を付ける
                        }
                    }
                }
            },
            plugins: {
                legend: { position: 'bottom' }, // サイト名の色の説明を下に出す
                tooltip: {
                    // 0時間のサイトは出さない
                    filter: function (item) {
                        return item.parsed.y > 0;
                    },
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + '：' + formatTime(context.parsed.y * ONE_HOUR);
                        },
                        footer: function (items) {
                            const sum = items.reduce(function (total, item) {
                                return total + item.parsed.y;
                            }, 0);
                            return '合計 ' + formatTime(sum * ONE_HOUR);
                        }
                    }
                }
            }
        }
    });
}

// ----- 円グラフ：何に時間を使ったか -----
function renderPieChart() {
    // 期間の始まりを決める
    const today = startOfDay(Date.now());
    let periodStart = -Infinity; // 「すべて」のとき（いちばん昔から）
    if (chartPeriod.value === 'today') periodStart = today;
    if (chartPeriod.value === '7days') periodStart = addDays(today, -6);
    if (chartPeriod.value === '30days') periodStart = addDays(today, -29);

    // 分け方（決まった2つ以外は使わないようにする：安全のため）
    const groupKey = chartGroup.value === 'site' ? 'site' : 'task';

    // 名前ごとに時間を足していく
    const totals = Object.create(null);
    records.forEach(function (record) {
        if (record.startTime < periodStart) return; // 期間より前なら飛ばす
        const name = record[groupKey];
        totals[name] = (totals[name] || 0) + getWorkTime(record);
    });

    const labels = Object.keys(totals).filter(function (name) {
        return totals[name] > 0;
    });
    const values = labels.map(function (name) {
        return totals[name];
    });
    const sum = values.reduce(function (total, value) {
        return total + value;
    }, 0);
    const pickColor = makeColorPicker(groupKey === 'site' ? sites : tasks);

    // 前のグラフがあれば消す
    if (pieChart) {
        pieChart.destroy();
        pieChart = null;
    }

    showChartOrEmpty(pieBox, pieEmpty, labels.length > 0);
    if (labels.length === 0) return;

    pieChart = new Chart(pieCanvas, {
        type: 'pie', // 円グラフ
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map(pickColor),
                borderColor: '#ffffff', // 区切りの線を白にする
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        // マウスをのせたとき「実装：01:30:00（45%）」のように出す
                        label: function (context) {
                            const percent = Math.round(context.parsed / sum * 100);
                            return context.label + '：' + formatTime(context.parsed) + '（' + percent + '%）';
                        }
                    }
                }
            }
        }
    });
}

// ----- グラフを全部作り直す（script.js の renderRecords からも呼ばれる） -----
function renderCharts() {
    renderTodayTotal();
    renderBarChart();
    renderPieChart();
}

// 期間や分け方を選びなおしたら、円グラフを作り直す
chartPeriod.addEventListener('change', renderPieChart);
chartGroup.addEventListener('change', renderPieChart);

// ----- ページを開いたときに最初に動くところ -----
renderCharts();