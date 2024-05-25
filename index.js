//Config
const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const port = 3000;
//notion
const { Client } = require("@notionhq/client");
const NOTION_DATABESE_ID = "xxx";//NotionDatabase-ID
const NOTION_API_TOKEN = "xxx"; // Integration Tokenを設定
const notion = new Client({ auth: NOTION_API_TOKEN });
//line
const config = {
    channelAccessToken: "xxx",
    channelSecret: "xxx",
};
const line = require("@line/bot-sdk");
const client = new line.Client(config);
const MY_LINE_ACCOUNT = "xxx";
//express
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // Reactアプリケーションのオリジンを設定
    res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//日本標準時を取得
const getTimeJST = () => {
    const diffms = 32400000; //現在はバージニア東部時間との時差
    const sysDate = new Date();
    const jstDate = sysDate.setTime(sysDate.getTime() + diffms);
    return jstDate; //timestampを取得
}

//ログメッセージユーティル
const createLogs = (message = "") => {
    const nowTime = new Date(getTimeJST());
    const year = nowTime.getFullYear();
    const month = nowTime.getMonth() + 1;
    const date = nowTime.getDate();
    const time = nowTime.getHours()+ ":" + nowTime.getMinutes();
    const log = "[" + `${year}/${month}/${date} ${time}` + "]" + `${message}`;
    console.log(log);
}

//block_idからblock要素を検索し、最子要素を返す
//FOR NOTION
const getCoreMiningBlocks = async (block_id) => {
    let result = {results : [{"has_children" :true}],};
    while(result.results[0].has_children){
        result = await notion.blocks.children.list({ block_id: block_id });
        block_id = result.results[0].id;
    }
    return result;
}

//page_idとコアミーニングを文章にして返す
const createMessage = async (coreMiningObject) => {
    const paragraphes = coreMiningObject.results;
    let message = [];
    for(let i = 0; i < paragraphes.length; i++){
        message.push(paragraphes[i].paragraph.rich_text[0].text.content);
    }
    return message.join('\n')
}

//メッセージを送信する
const sendMessage = async () => {
    createLogs("メッセージリクエストを確認しました。");
    try {
        //NotionDatabaseから全単語を取得し配列へ格納----------------------------------------------------------------
        let hasmore = true;
        let startCursor = undefined;
        let ids = [];
        while (hasmore) {
            const notionResponse = await notion.databases.query({
            database_id: NOTION_DATABESE_ID,
            start_cursor: startCursor,
            filter: {
                and: [
                {
                    property: "タグ",
                    select: {
                    equals: "実践レベル",
                    },
                },
                ],
            },
            });
            notionResponse.results
            .map((element) => {
                return element.id
            }).forEach((element) => {
                ids.push(element);
            });
            hasmore = notionResponse.has_more;
            startCursor = notionResponse.next_cursor;
        }
        createLogs(ids.length + "の単語を取得しました");

        const rundom_index = Math.floor(Math.random() * ids.length);
        const pageId = ids[rundom_index];
        const CoreMiningBlocks = await getCoreMiningBlocks(pageId);
        const message = await createMessage(CoreMiningBlocks);

        await client.pushMessage(
            MY_LINE_ACCOUNT, 
            {
                type: "text",
                text: pageId,
            },
            true,
        );
        await client.pushMessage(
            MY_LINE_ACCOUNT, 
            {
                type: "text",
                text: message,
            },
        );
        createLogs("メッセージを送信しました");
    } catch (error) {
        console.error("メッセージの送信時に何らかのエラーが発生しました。", error);
    }
}

//6-8時間のうち、ランダムな時間を返す（ms）
const getRandomInterval = () => {
    const fiveMinute = 300000;
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    const twoHourInMs = 7200000;
    const randomInterval = Math.floor(Math.random() * 3600000);
    return twoHourInMs + randomInterval;
}

//am0からam6の間のみtrueを返す
const isMidnight = () => {
    const now = new Date(getTimeJST());
    const hour = now.getHours();
    return hour >= 0 && hour < 6;
}

//初回のみディレイ無しでメッセージ送信し、以降は再帰的にスケジューリングされ実行される。
const scheduleNextExecution = (isFirst = false) => {
    if(isFirst){
        sendMessage();
    }
    const nextInterval = getRandomInterval(); //ランダムな時間
     // 次の実行までの時間をログに出力
    let nextExcutionTime = new Date(getTimeJST() + nextInterval);
    const nextExeHour = nextExcutionTime.getHours();
    const nextExeMinute = nextExcutionTime.getMinutes();
    createLogs(`次の実行までの時間: ${nextInterval / (60 * 1000)} 分`);
    createLogs(`推定時刻は${nextExeHour}:${nextExeMinute}です`);

     // 次の実行をスケジュール
    setTimeout(() => {
        if(!isMidnight()){
            sendMessage();
        }else{
            createLogs("深夜時間のためメッセージは送信されませんでした。");
        }
         scheduleNextExecution(); // 次の実行をスケジュール
    }, nextInterval);
}

//lineエンドポイント
app.post("/query_word", async (req, res) => {
    try{
        const reqMessage = req.body.events[0].message.text; //lineからのメッセージ
        const notionResponse = await notion.pages.retrieve({ page_id: reqMessage });

        const resMessage = notionResponse.properties.名前.title[0].text.content;

        await client.pushMessage(
            MY_LINE_ACCOUNT, 
            {
                type: "text",
                text: resMessage,
            }
        );
    }catch(error){
        createLogs(error)
        await client.pushMessage(
            MY_LINE_ACCOUNT, 
            {
                type: "text",
                text: "何らかのエラーが発生しました。IDが間違っている可能性があります。",
            }
        );
    }
    res.status(200);
});

//アプリケーション実行
// scheduleNextExecution(true);

//テスト用
app.get("/test", async (req, res) => {
    console.log("リクエスト受信");
    res.send("is successfully");
});
//テスト用
app.post("/test", async (req, res) => {
    console.log("リクエスト受信");
    res.send("is successfully");
});

server.listen(port);
