// =====================================================
// やったことから、工程を自動で入れるしくみ
// （memoInput・taskSelect・running・startStopBtn は script.js のものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const autoTaskNote = document.getElementById('auto-task-note'); // 「◯◯なので△△にしました」

// ----- 言葉と工程の表 -----
// 上から順番に調べて、最初に見つかった工程にする
// （「デザインの修正」→「修正」、「デザインの参考さがし」→「調べもの」になるように、
//   修正・調べものなどを先に調べる）
// 言葉を足したいときは、ここに足せばOK
const AUTO_TASK_RULES = [
    {
        task: '修正',
        words: ['修正', '直し', 'フィードバック', '差し替え', '差替', '戻し', 'バグ', '不具合', '赤字']
    },
    {
        task: 'ヒアリング',
        words: ['ヒアリング', '打ち合わせ', '打合せ', 'うちあわせ', 'ミーティング', 'MTG', '相談',
            '要件', '見積', '提案', 'メール', '連絡', 'やりとり', 'やり取り', '契約', 'お客様', 'クライアント']
    },
    {
        task: '調べもの',
        words: ['調べ', 'リサーチ', '参考', '検索', '勉強', '学習', '調査', '情報収集', 'ググ', 'さがし', '探し']
    },
    {
        // 「入稿データの確認」が「検証」にならないように、検証より先に調べる
        task: '入稿データ',
        words: ['入稿', '印刷用', '印刷データ', '塗り足し', 'ぬりたし', 'トンボ', 'アウトライン', 'CMYK', '納品データ']
    },
    {
        task: '検証',
        words: ['検証', 'テスト', '確認', 'チェック', 'バリデーション', '公開', 'アップロード', 'サーバー', 'ドメイン']
    },
    {
        // 「ロゴのデザイン」が「デザインカンプ」にならないように、デザインカンプより先に調べる
        task: 'ロゴ制作',
        words: ['ロゴ', 'シンボルマーク', 'ロゴマーク']
    },
    {
        task: 'ワイヤー',
        words: ['ワイヤー', 'レイアウト', 'ラフ', '骨組み']
    },
    {
        task: '情報設計',
        words: ['情報設計', 'サイトマップ', '構成', 'キャッチコピー', 'コピーライティング', 'ライティング',
            '原稿', '文章', 'ペルソナ', 'ターゲット', 'コンセプト', '企画', '導線', 'コンテンツ']
    },
    {
        task: '実装',
        words: ['実装', 'コーディング', 'HTML', 'CSS', 'JavaScript', 'JS', 'Sass', 'SCSS', 'WordPress',
            'ワードプレス', 'レスポンシブ', 'アニメーション', 'コード', 'マークアップ', 'jQuery', 'PHP']
    },
    {
        task: 'デザインカンプ',
        words: ['デザイン', 'カンプ', 'Figma', 'フィグマ', '配色', 'カラー', 'フォント', 'バナー', 'チラシ',
            'イラスト', 'アイコン', 'トンマナ', 'モックアップ', '画像', '写真', '地図']
    }
];

// 自分で工程を入れた・選んだかどうか（そうしたら、自動で変えないようにする）
let taskChosenByHand = false;

// 言葉を調べやすい形にそろえる
// NFKC ＝ 全角の英数字を半角にそろえる。toLowerCase ＝ 大文字を小文字にそろえる
// （「ＣＳＳ」「css」「CSS」をどれも同じとして調べられるように）
function normalizeText(text) {
    return text.normalize('NFKC').toLowerCase();
}

// やったことから工程をさがす（見つからなければ null ＝ 何もない）
function guessTask(text) {
    const normalized = normalizeText(text);
    if (normalized.trim() === '') return null;

    for (const rule of AUTO_TASK_RULES) {
        for (const word of rule.words) {
            if (normalized.includes(normalizeText(word))) {
                return { task: rule.task, word: word }; // 見つかった工程と、決め手の言葉
            }
        }
    }
    return null;
}

// 工程を自動で入れる（todo.js からも使う）
function autoChooseTask() {
    if (running) return;          // はかっている途中は工程を変えない
    if (taskChosenByHand) return; // 自分で入れていたら、そのままにする

    const guess = guessTask(memoInput.value);
    if (!guess) {
        autoTaskNote.textContent = ''; // 見つからなければ、今の工程のまま
        return;
    }

    taskSelect.value = guess.task;
    autoTaskNote.textContent = '「' + guess.word + '」なので「' + guess.task + '」にしました（ちがうときは書きかえてOK）';

    // 工程のひとこと説明も変える（glossary.js があるときだけ）
    if (typeof updateTaskHint === 'function') {
        updateTaskHint();
    }
}

// やったことを入力しているとき
memoInput.addEventListener('input', function () {
    // やったことを全部消したら、また自動で入れるようにもどす
    if (memoInput.value.trim() === '') {
        taskChosenByHand = false;
    }
    autoChooseTask();
});

// 工程を自分で入力したとき（1文字打つたびに動く）
taskSelect.addEventListener('input', function () {
    taskChosenByHand = true;
    autoTaskNote.textContent = '';
    if (typeof updateTaskHint === 'function') {
        updateTaskHint();
    }
});

// 工程を ▾ のリストから選んだとき
taskSelect.addEventListener('change', function () {
    taskChosenByHand = true;
    autoTaskNote.textContent = '';
});

// ストップしたら、次の作業はまた自動で入れるようにもどす
// （script.js のほうが先に動くので、押したあとの状態で調べられる）
startStopBtn.addEventListener('click', function () {
    if (!running) {
        taskChosenByHand = false;
        autoTaskNote.textContent = '';
    }
});