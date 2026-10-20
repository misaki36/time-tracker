// =====================================================
// 予定と実際をくらべるしくみ
// （records・sites・tasks・getWorkTime・saveData・loadData・createElement・
//   MAX_NAME_LENGTH は script.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const planSite = document.getElementById('plan-site');       // どのサイトを見るか
const planPrice = document.getElementById('plan-price');     // 受ける金額
const planBody = document.getElementById('plan-body');       // 表の中身
const planFoot = document.getElementById('plan-foot');       // 表の合計の行
const planSummary = document.getElementById('plan-summary'); // 時給などのまとめ

// ----- 決まった値 -----
const PLANS_KEY = 'timeTracker_plans';  // ブラウザに保存するときの名前
const MAX_PLAN_HOURS = 999;             // 予定の上限（999時間）
const MAX_PRICE = 100000000;            // 金額の上限（1億円）
const PLAN_ONE_HOUR = 60 * 60 * 1000;   // 1時間
const MIN_TIME_FOR_WAGE = 60 * 1000;    // 時給を出すのは、実際の時間が1分以上のときだけ

// ----- データの形をチェックする -----

// 予定の時間が正しいか（0より大きく、999時間まで）
function isValidPlanHours(value) {
    return typeof value === 'number' && Number.isFinite(value) &&
        value > 0 && value <= MAX_PLAN_HOURS;
}

// 金額が正しいか（1円以上の整数で、1億円まで）
function isValidPrice(value) {
    return typeof value === 'number' && Number.isInteger(value) &&
        value > 0 && value <= MAX_PRICE;
}

// 保存されていたデータを、正しい形のものだけにする
// 形：{ サイト名: { tasks: { 工程名: 予定の時間 }, price: 金額 または null } }
function cleanPlans(value) {
    const clean = Object.create(null); // よけいな中身がない、まっさらな入れ物（安全のため）
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return clean;
    }
    Object.keys(value).forEach(function (site) {
        if (site.length > MAX_NAME_LENGTH) return; // 長すぎる名前は飛ばす
        const item = value[site];
        if (item === null || typeof item !== 'object') return;

        const entry = { tasks: Object.create(null), price: null };
        if (item.tasks !== null && typeof item.tasks === 'object') {
            Object.keys(item.tasks).forEach(function (task) {
                const hours = item.tasks[task];
                if (task.length <= MAX_NAME_LENGTH && isValidPlanHours(hours)) {
                    entry.tasks[task] = hours;
                }
            });
        }
        if (isValidPrice(item.price)) {
            entry.price = item.price;
        }
        clean[site] = entry;
    });
    return clean;
}

// ----- データを用意する -----
let plans = cleanPlans(loadData(PLANS_KEY, null));

// いま表で見ているサイト
let planSiteValue = '';

// ----- べんりな関数 -----

// 予定を保存する
function savePlans() {
    saveData(PLANS_KEY, plans);
}

// そのサイトの予定の入れ物を取り出す（なければ作る）
function getOrCreatePlanEntry(site) {
    if (!plans[site]) {
        plans[site] = { tasks: Object.create(null), price: null };
    }
    return plans[site];
}

// 予定も金額もなくなったサイトは、入れ物ごと消す（データをすっきりさせるため）
function removeEmptyPlanEntry(site) {
    const entry = plans[site];
    if (entry && Object.keys(entry.tasks).length === 0 && entry.price === null) {
        delete plans[site];
    }
}

// ミリ秒を「1時間30分」の形にする
function formatHM(ms) {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
        return minutes + '分';
    }
    return hours + '時間' + (minutes > 0 ? minutes + '分' : '');
}

// 名前のリストに、まだない名前を足していく
function addMissingNames(list, names) {
    names.forEach(function (name) {
        if (!list.includes(name)) {
            list.push(name);
        }
    });
}

// =====================================================
// 表のマスを作る
// =====================================================

// 「実際」のマス（時間＋ゲージ）
function createActualCell(actualMs, planMs) {
    const td = createElement('td');
    td.appendChild(createElement('div', '', formatHM(actualMs)));

    // 予定があるときだけゲージを出す
    if (planMs > 0) {
        // progress ＝ ゲージを出すタグ。max が満タン、value が今の量
        const progress = document.createElement('progress');
        progress.className = 'plan-progress';
        progress.max = planMs;
        progress.value = Math.min(actualMs, planMs); // 満タンより多くはならないようにする
        if (actualMs > planMs) {
            progress.classList.add('is-over'); // 予定をこえたら赤くする
        }
        td.appendChild(progress);
    }
    return td;
}

// 「差」のマス
function createDiffCell(actualMs, planMs) {
    if (planMs <= 0) {
        return createElement('td', '', '—'); // 予定がなければ「—」
    }
    const diff = planMs - actualMs;
    if (diff >= 0) {
        return createElement('td', 'plan-under', 'あと ' + formatHM(diff));
    }
    return createElement('td', 'plan-over', formatHM(-diff) + ' オーバー');
}

// =====================================================
// 予定・金額が入力されたとき
// =====================================================

// 予定の時間が入力されたとき
function updatePlanHours(site, task, input) {
    const text = input.value.trim();

    // 空っぽにしたら、その予定を消す
    if (text === '') {
        if (plans[site]) {
            delete plans[site].tasks[task];
            removeEmptyPlanEntry(site);
        }
        savePlans();
        renderPlanTable();
        return;
    }

    const hours = Number(text);
    if (!isValidPlanHours(hours)) {
        alert('予定は0より大きく、' + MAX_PLAN_HOURS + '時間までの数字で入れてください。');
        renderPlanTable(); // 入力欄を元にもどす
        return;
    }

    // 小数は2けたまでにする（例：1.333 → 1.33）
    getOrCreatePlanEntry(site).tasks[task] = Math.round(hours * 100) / 100;
    savePlans();
    renderPlanTable();
}

// 金額が入力されたとき
planPrice.addEventListener('change', function () {
    const site = planSiteValue;
    const text = planPrice.value.trim();

    // 空っぽにしたら、金額を消す
    if (text === '') {
        if (plans[site]) {
            plans[site].price = null;
            removeEmptyPlanEntry(site);
        }
        savePlans();
        renderPlanTable();
        return;
    }

    const price = Math.round(Number(text)); // 1円より細かいところは四捨五入
    if (!isValidPrice(price)) {
        alert('金額は1円以上、1億円までの数字で入れてください。');
        renderPlanTable();
        return;
    }

    getOrCreatePlanEntry(site).price = price;
    savePlans();
    renderPlanTable();
});

// =====================================================
// 画面に表示する
// =====================================================

// サイトを選ぶ箱を作り直す
function renderPlanSiteSelect() {
    // 設定のサイト名＋予定があるサイト＋記録があるサイト
    const names = sites.slice();
    addMissingNames(names, Object.keys(plans));
    addMissingNames(names, records.map(function (record) { return record.site; }));

    planSite.textContent = '';
    names.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        planSite.appendChild(option);
    });

    // 前に見ていたサイトがなくなっていたら、一番上のサイトにする
    if (!names.includes(planSiteValue)) {
        planSiteValue = names.length > 0 ? names[0] : '';
    }
    planSite.value = planSiteValue;
}

// 表を作り直す
function renderPlanTable() {
    const site = planSiteValue;
    const entry = plans[site] || null;

    // そのサイトの、工程ごとの実際の時間を足していく
    const actual = Object.create(null);
    records.forEach(function (record) {
        if (record.site !== site) return;
        actual[record.task] = (actual[record.task] || 0) + getWorkTime(record);
    });

    // 表に出す工程：設定の工程＋記録がある工程＋予定がある工程
    const taskNames = tasks.slice();
    addMissingNames(taskNames, Object.keys(actual));
    if (entry) {
        addMissingNames(taskNames, Object.keys(entry.tasks));
    }

    planBody.textContent = '';
    let planTotal = 0;
    let actualTotal = 0;

    // 工程ごとに1行ずつ作る
    taskNames.forEach(function (task) {
        const planHours = entry && entry.tasks[task] ? entry.tasks[task] : 0;
        const planMs = planHours * PLAN_ONE_HOUR;
        const actualMs = actual[task] || 0;
        planTotal += planMs;
        actualTotal += actualMs;

        const tr = document.createElement('tr');

        // 工程の名前
        const th = createElement('th', 'plan-task', task);
        th.scope = 'row';
        tr.appendChild(th);

        // 予定を入れる欄
        const planTd = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'plan-input';
        input.min = '0';
        input.max = String(MAX_PLAN_HOURS);
        input.step = '0.5';
        input.placeholder = '—';
        input.value = planHours > 0 ? String(planHours) : '';
        input.setAttribute('aria-label', task + 'の予定時間（時間）'); // 読み上げソフト用の説明
        // change ＝ 入力が終わったとき（Enterを押す・ほかの場所を押す）に動く
        input.addEventListener('change', function () {
            updatePlanHours(site, task, input);
        });
        planTd.appendChild(input);
        tr.appendChild(planTd);

        // 実際と差
        tr.appendChild(createActualCell(actualMs, planMs));
        tr.appendChild(createDiffCell(actualMs, planMs));

        planBody.appendChild(tr);
    });

    // ----- 合計の行 -----
    planFoot.textContent = '';
    const totalRow = createElement('tr', 'plan-total-row');
    const totalTh = createElement('th', '', '合計');
    totalTh.scope = 'row';
    totalRow.appendChild(totalTh);
    totalRow.appendChild(createElement('td', '', planTotal > 0 ? formatHM(planTotal) : '—'));
    totalRow.appendChild(createActualCell(actualTotal, planTotal));
    totalRow.appendChild(createDiffCell(actualTotal, planTotal));
    planFoot.appendChild(totalRow);

    // ----- 金額の欄 -----
    planPrice.value = entry && entry.price ? String(entry.price) : '';

    // ----- まとめ -----
    const lines = [];
    if (planTotal > 0) {
        const percent = Math.round(actualTotal / planTotal * 100);
        lines.push('予定の時間の ' + percent + '% を使いました');
    }
    if (entry && entry.price) {
        // toLocaleString ＝ 「12345」を「12,345」のように3けたごとに「,」を付ける
        if (actualTotal >= MIN_TIME_FOR_WAGE) {
            const wage = Math.round(entry.price / (actualTotal / PLAN_ONE_HOUR));
            lines.push('いまの時給：約 ' + wage.toLocaleString() + '円');
        }
        if (planTotal > 0) {
            const planWage = Math.round(entry.price / (planTotal / PLAN_ONE_HOUR));
            lines.push('予定どおりに終わったときの時給：約 ' + planWage.toLocaleString() + '円');
        }
    }
    planSummary.textContent = lines.join('\n');
}

// 「予定と実際」を全部作り直す（script.js の renderRecords からも呼ばれる）
function renderPlans() {
    renderPlanSiteSelect();
    renderPlanTable();
}

// サイトを選びなおしたとき
planSite.addEventListener('change', function () {
    planSiteValue = planSite.value;
    renderPlanTable();
});

// =====================================================
// バックアップ用（backup.js から使う）
// =====================================================

// 書き出すときに、予定のデータをわたす
function getPlansForBackup() {
    return plans;
}

// 読みこんだデータで、予定を入れかえる
function setPlansFromBackup(value) {
    const newPlans = cleanPlans(value); // 正しい形のものだけにする
    // 今の中身を全部消してから、新しい中身を入れる
    Object.keys(plans).forEach(function (site) {
        delete plans[site];
    });
    Object.keys(newPlans).forEach(function (site) {
        plans[site] = newPlans[site];
    });
    savePlans();
    renderPlans();
}

// ----- ページを開いたときに最初に動くところ -----
renderPlans();