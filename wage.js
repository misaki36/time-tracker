// =====================================================
// 記録の時間から、時給を計算するしくみ
// （records・sites・tasks・getWorkTime・saveData・loadData・createElement・
//   MAX_NAME_LENGTH は script.js、
//   plans・getOrCreatePlanEntry・removeEmptyPlanEntry・savePlans・renderPlans・
//   isValidPrice・formatHM・addMissingNames は plan.js のものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const wageSite = document.getElementById('wage-site');       // どのサイトを計算するか
const wageTotal = document.getElementById('wage-total');     // 受け取る金額の合計
const wageBody = document.getElementById('wage-body');       // 表の中身
const wageFoot = document.getElementById('wage-foot');       // 表の合計の行
const wageSummary = document.getElementById('wage-summary'); // まとめ

// ----- 決まった値 -----
const WAGES_KEY = 'timeTracker_wages';  // 工程ごとの金額を保存するときの名前
const WAGE_ONE_HOUR = 60 * 60 * 1000;   // 1時間
const WAGE_MIN_TIME = 60 * 1000;        // 時給を出すのは、時間が1分以上のときだけ（短すぎると時給がとても大きくなるため）

// ----- 保存していたデータを、正しい形のものだけにする（安全のため） -----
// 形：{ サイト名: { 工程名: 金額 } }
// 受け取る金額の合計は、plan.js の予定のデータ（plans）の中にしまう
function cleanWages(value) {
    const clean = Object.create(null); // よけいな中身がない、まっさらな入れ物
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return clean;
    }
    Object.keys(value).forEach(function (site) {
        if (site.length > MAX_NAME_LENGTH) return;
        const item = value[site];
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return;

        const prices = Object.create(null);
        Object.keys(item).forEach(function (task) {
            if (task.length <= MAX_NAME_LENGTH && isValidPrice(item[task])) {
                prices[task] = item[task];
            }
        });
        if (Object.keys(prices).length > 0) {
            clean[site] = prices;
        }
    });
    return clean;
}

// ----- データを用意する -----
let wages = cleanWages(loadData(WAGES_KEY, null));

// いま表で見ているサイト
let wageSiteValue = '';

// ----- べんりな関数 -----

// 工程ごとの金額を保存する
function saveWages() {
    saveData(WAGES_KEY, wages);
}

// 時給を計算する（金額 ÷ 時間）。出せないときは null
function calcWage(price, ms) {
    if (!price || ms < WAGE_MIN_TIME) return null;
    return Math.round(price / (ms / WAGE_ONE_HOUR));
}

// 「12345」を「12,345円」にする（toLocaleString ＝ 3けたごとに「,」を付ける）
function formatYen(number) {
    return number.toLocaleString() + '円';
}

// 時給の文字（出せないときは「—」）
function wageText(price, ms) {
    const wage = calcWage(price, ms);
    return wage === null ? '—' : '約 ' + formatYen(wage);
}

// =====================================================
// 金額が入力されたとき
// =====================================================

// 工程ごとの金額
function updateTaskPrice(site, task, input) {
    const text = input.value.trim();

    // 空っぽにしたら、その金額を消す
    if (text === '') {
        if (wages[site]) {
            delete wages[site][task];
            if (Object.keys(wages[site]).length === 0) {
                delete wages[site];
            }
        }
        saveWages();
        renderWage();
        return;
    }

    const price = Math.round(Number(text)); // 1円より細かいところは四捨五入
    if (!isValidPrice(price)) {
        alert('金額は1円以上、1億円までの数字で入れてください。');
        renderWage(); // 入力欄を元にもどす
        return;
    }

    if (!wages[site]) {
        wages[site] = Object.create(null);
    }
    wages[site][task] = price;
    saveWages();
    renderWage();
}

// 受け取る金額の合計（plan.js の予定のデータにしまう）
wageTotal.addEventListener('change', function () {
    const site = wageSiteValue;
    if (site === '') return;
    const text = wageTotal.value.trim();

    if (text === '') {
        // 空っぽにしたら、合計の金額を消す
        if (plans[site]) {
            plans[site].price = null;
            removeEmptyPlanEntry(site);
        }
    } else {
        const price = Math.round(Number(text));
        if (!isValidPrice(price)) {
            alert('金額は1円以上、1億円までの数字で入れてください。');
            renderWage();
            return;
        }
        getOrCreatePlanEntry(site).price = price;
    }

    savePlans();
    renderPlans();
    renderWage();
});

// =====================================================
// 画面に表示する
// =====================================================

// サイトを選ぶ箱を作り直す
function renderWageSiteSelect() {
    // 設定のサイト名＋記録があるサイト名＋金額を入れたサイト名
    const names = sites.slice();
    addMissingNames(names, records.map(function (record) { return record.site; }));
    addMissingNames(names, Object.keys(wages));

    wageSite.textContent = '';
    names.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        wageSite.appendChild(option);
    });

    // まだ選んでいなければ、最後に記録したサイトにする
    if (!names.includes(wageSiteValue)) {
        if (records.length > 0) {
            wageSiteValue = records[0].site;
        } else {
            wageSiteValue = names.length > 0 ? names[0] : '';
        }
    }
    wageSite.value = wageSiteValue;
}

// 表とまとめを作り直す
function renderWageTable() {
    const site = wageSiteValue;
    wageBody.textContent = '';
    wageFoot.textContent = '';
    wageSummary.textContent = '';
    if (site === '') return;

    // そのサイトの、工程ごとのかかった時間を足していく
    const actual = Object.create(null);
    records.forEach(function (record) {
        if (record.site !== site) return;
        actual[record.task] = (actual[record.task] || 0) + getWorkTime(record);
    });

    const prices = wages[site] || Object.create(null);

    // 表に出す工程：時間がある工程と、金額を入れた工程（工程のリストの順にならべる）
    const taskNames = [];
    tasks.forEach(function (task) {
        if (actual[task] > 0 || prices[task]) {
            taskNames.push(task);
        }
    });
    addMissingNames(taskNames, Object.keys(actual).filter(function (task) { return actual[task] > 0; }));
    addMissingNames(taskNames, Object.keys(prices));

    if (taskNames.length === 0) {
        const tr = document.createElement('tr');
        const td = createElement('td', 'wage-empty', 'このサイトの記録はまだありません');
        td.colSpan = 4; // 4マス分を1つにする
        tr.appendChild(td);
        wageBody.appendChild(tr);
        wageTotal.value = plans[site] && plans[site].price ? String(plans[site].price) : '';
        return;
    }

    let totalTime = 0;   // かかった時間の合計
    let priceSum = 0;    // 工程ごとの金額の合計
    const unpaid = [];   // 金額を入れていない作業

    taskNames.forEach(function (task) {
        const ms = actual[task] || 0;
        const price = prices[task] || 0;
        totalTime += ms;
        priceSum += price;
        if (!price && ms > 0) {
            unpaid.push(task + '（' + formatHM(ms) + '）');
        }

        const tr = document.createElement('tr');

        // 工程の名前
        const th = createElement('th', 'plan-task', task);
        th.scope = 'row';
        tr.appendChild(th);

        // かかった時間
        tr.appendChild(createElement('td', '', formatHM(ms)));

        // 金額を入れる欄
        const priceTd = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'plan-input wage-input';
        input.min = '0';
        input.step = '1000';
        input.placeholder = '—';
        input.value = price > 0 ? String(price) : '';
        input.setAttribute('aria-label', task + 'の金額（円）'); // 読み上げソフト用の説明
        input.addEventListener('change', function () {
            updateTaskPrice(site, task, input);
        });
        priceTd.appendChild(input);
        tr.appendChild(priceTd);

        // 時給
        tr.appendChild(createElement('td', 'wage-value', wageText(price, ms)));

        wageBody.appendChild(tr);
    });

    // ----- 合計の行 -----
    // 受け取る金額の合計を入れていればそれを、なければ工程ごとの金額の合計を使う
    const enteredTotal = plans[site] && plans[site].price ? plans[site].price : 0;
    const totalPrice = enteredTotal || priceSum;
    wageTotal.value = enteredTotal ? String(enteredTotal) : '';

    const totalRow = createElement('tr', 'plan-total-row');
    const totalTh = createElement('th', '', '合計');
    totalTh.scope = 'row';
    totalRow.appendChild(totalTh);
    totalRow.appendChild(createElement('td', '', formatHM(totalTime)));
    totalRow.appendChild(createElement('td', '', totalPrice > 0 ? formatYen(totalPrice) : '—'));
    totalRow.appendChild(createElement('td', 'wage-value', wageText(totalPrice, totalTime)));
    wageFoot.appendChild(totalRow);

    // ----- まとめ -----
    const lines = [];
    const totalWage = calcWage(totalPrice, totalTime);
    if (totalWage !== null) {
        lines.push('全体の時給：約 ' + formatYen(totalWage) + '（' + formatYen(totalPrice) + ' ÷ ' + formatHM(totalTime) + '）');
    } else if (totalTime > 0) {
        lines.push('「受け取る金額の合計」か、工程ごとの金額を入れると、時給が出ます');
    }
    // 工程ごとに金額を入れたのに、入れていない作業があるとき
    if (priceSum > 0 && unpaid.length > 0) {
        lines.push('お金をもらっていない作業：' + unpaid.join('、'));
        lines.push('→ この時間も、全体の時給には入っています。次の見積もりで料金にふくめるか考えてみてください');
    }
    // 工程ごとの金額の合計と、受け取る金額の合計がちがうとき
    if (enteredTotal && priceSum > 0 && priceSum !== enteredTotal) {
        lines.push('工程ごとの金額の合計は ' + formatYen(priceSum) + ' です（割引などで、受け取る金額とちがっています）');
    }
    wageSummary.textContent = lines.join('\n');
}

// 「時給の計算」を全部作り直す（script.js の renderRecords からも呼ばれる）
function renderWage() {
    renderWageSiteSelect();
    renderWageTable();
}

// サイトを選びなおしたとき
wageSite.addEventListener('change', function () {
    wageSiteValue = wageSite.value;
    renderWageTable();
});

// =====================================================
// バックアップ用（backup.js から使う）
// =====================================================
function getWagesForBackup() {
    return wages;
}

function setWagesFromBackup(value) {
    wages = cleanWages(value); // 正しい形のものだけにする
    saveWages();
    renderWage();
}

// ----- ページを開いたときに最初に動くところ -----
renderWage();