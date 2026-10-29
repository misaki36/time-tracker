// =====================================================
// 用語集のデータ
// （ここに足せば、用語集にも工程の説明にも出てくる）
//   term   ：言葉（工程の名前と同じにすると、工程を選んだときに説明が出る）
//   aka    ：ほかの呼び方（なければ書かなくてOK）
//   isTask ：このアプリの最初の工程なら true（ラベルが付く）
//   short  ：ひとことで言うと
//   detail ：くわしい説明
// =====================================================
const GLOSSARY = [
  {
    term: 'ヒアリング',
    short: 'お客さんに話を聞くこと',
    detail: 'サイトを作る目的、だれに見てほしいか、どんな雰囲気にしたいか、いつまでに作るかなどを聞いて確かめます。ここがずれると、あとの作業が全部ずれてしまう大事な最初の一歩です。'
  },
  {
    term: '要件定義',
    aka: 'ようけんていぎ',
    short: '「何を作るか」を決めて書き出すこと',
    detail: 'ヒアリングで聞いたことをもとに、ページの数、入れる機能（お問い合わせフォームなど）、スケジュールなどを決めて、お客さんと約束します。'
  },
  {
    term: '情報設計',
    isTask: true,
    short: 'どんな情報を、どこに、どの順番で置くか決めること',
    detail: '見た目はまだ考えません。「トップページには何をのせる？」「メニューは何個？」「この情報はどのページに入れる？」などを整理します。サイトマップを作るのもこの工程です。'
  },
  {
    term: 'サイトマップ',
    short: 'サイト全体のページのつながりを表した図',
    detail: '「トップ → 会社案内・商品一覧・お問い合わせ」のように、どんなページがあって、どうつながっているかを木の形で表します。情報設計の中で作ります。'
  },
  {
    term: 'ワイヤー',
    aka: 'ワイヤーフレーム',
    isTask: true,
    short: 'ページの骨組みの設計図',
    detail: '1ページの中で「どこに何を置くか」を、線と四角だけで描いたものです。色や写真はまだ入れず、場所と大きさを決めます。家でいうと「間取り図」のようなものです。'
  },
  {
    term: 'デザインカンプ',
    isTask: true,
    short: '完成見本のデザイン',
    detail: 'ワイヤーをもとに、色・文字の形・写真・かざりまで入れた、本番そっくりのデザインです。Figmaなどで作り、お客さんに「この見た目でいいですか？」と確認してもらいます。'
  },

  {
    term: 'ロゴ制作',
    isTask: true,
    short: 'お店や会社のマーク・名前の形を作ること',
    detail: 'お客さんの話から、お店らしさが伝わるマークや文字の形を考えます。何案か出して選んでもらい、名刺やチラシ、ホームページなど、大きくても小さくても見やすいかも確かめます。'
  },
  {
    term: '入稿データ',
    aka: 'にゅうこうデータ',
    isTask: true,
    short: '印刷屋さんにわたすための、印刷用のデータ',
    detail: '印刷できる形にデータを整えることです。紙を切るときのズレにそなえて「塗り足し」を付けたり、色を印刷用（CMYK）にしたり、文字の形をくずれないようにしたりします。'
  },
  
  {
    term: '実装',
    aka: 'じっそう',
    isTask: true,
    short: 'デザインをもとに、コードを書いて動く形にすること',
    detail: 'HTML・CSS・JavaScriptでコードを書いて、ブラウザで見られるサイトにします。Web制作では「コーディング」とほとんど同じ意味で使われます。'
  },
  {
    term: 'コーディング',
    short: 'コードを書くこと',
    detail: 'HTMLやCSSなどのコードを書く作業のことです。このアプリでは「実装」の工程に入れています。'
  },
  {
    term: 'レスポンシブ',
    short: '画面の大きさに合わせて、並び方が変わるつくり',
    detail: 'パソコンでは横に3つ並んでいるものが、スマホではたてに1つずつ並ぶ、のように画面の幅に合わせて見やすく変わるようにすることです。実装の中でやります。'
  },
  {
    term: '修正',
    isTask: true,
    short: '確認してもらって出た「直し」をすること',
    detail: 'お客さんや講師に見てもらって「ここの色を変えたい」「文字を大きく」など言われたところを直す作業です。デザインの修正も、コードの修正もここに入れてOKです。'
  },
  {
    term: '検証',
    aka: 'けんしょう・テスト',
    short: 'ちゃんと見えるか・動くか確かめること',
    detail: 'Chrome・Safariなどいろいろなブラウザや、スマホで開いて、表示がくずれていないか、リンクやボタンが正しく動くかを確かめます。'
  },
  {
    term: '調べもの',
    isTask: true,
    short: '参考を探したり、やり方を調べたりすること',
    detail: 'デザインの参考サイトを探す、コードの書き方を調べる、使う写真や素材を探す、などの時間です。'
  }
];

// =====================================================
// 画面の部品をつかまえる
// （taskSelect は script.js で用意したものをそのまま使う）
// =====================================================
const glossaryList = document.getElementById('glossary-list'); // 用語集のリスト
const taskHint = document.getElementById('task-hint');         // 工程の下のひとこと説明

// 言葉から、用語集のデータを探す（見つからなければ null ＝ 何もない）
function findGlossary(name) {
  return GLOSSARY.find(function (item) {
    return item.term === name;
  }) || null;
}

// =====================================================
// 用語集を画面に表示する
// （textContent を使うので安全）
// =====================================================
function renderGlossary() {
  glossaryList.textContent = ''; // いったん中身を空にする

  GLOSSARY.forEach(function (item) {
    const li = document.createElement('li');
    li.className = 'glossary-item';

    // details ＝ 押すと開いたり閉じたりするタグ
    const details = document.createElement('details');

    // summary ＝ details の中で、いつも見えている部分（押すところ）
    const summary = document.createElement('summary');
    summary.className = 'glossary-term';
    // ほかの呼び方があれば「ワイヤー（ワイヤーフレーム）」のように出す
    summary.textContent = item.aka ? item.term + '（' + item.aka + '）' : item.term;

    // このアプリの工程なら、小さなラベルを付ける
    if (item.isTask) {
      const tag = document.createElement('span');
      tag.className = 'glossary-tag';
      tag.textContent = '工程';
      summary.appendChild(tag);
    }
    details.appendChild(summary);

    // 開いたときに出る説明
    const shortText = document.createElement('p');
    shortText.className = 'glossary-short';
    shortText.textContent = item.short;
    details.appendChild(shortText);

    const detailText = document.createElement('p');
    detailText.className = 'glossary-detail';
    detailText.textContent = item.detail;
    details.appendChild(detailText);

    li.appendChild(details);
    glossaryList.appendChild(li);
  });
}

// =====================================================
// 工程の下のひとこと説明を更新する
// （自分で足した工程など、用語集にない言葉のときは何も出さない）
// =====================================================
function updateTaskHint() {
  const item = findGlossary(taskSelect.value);
  taskHint.textContent = item ? item.short : '';
}

// 工程を選びなおしたら、説明も変える
taskSelect.addEventListener('change', updateTaskHint);

// =====================================================
// ページを開いたときに最初に動くところ
// =====================================================
renderGlossary();
updateTaskHint();