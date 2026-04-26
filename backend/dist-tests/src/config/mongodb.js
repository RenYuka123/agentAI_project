import { MongoClient } from "mongodb";
import { appConfig } from "./env.js";
/** MongoDB client 單例，避免重複建立連線。 */
let client = null;
/** 已初始化完成的 database 單例。 */
let database = null;
/** 用來避免重複建立索引。 */
let indexesInitialized = false;
/**
 * 建立 MongoDB collection 需要的索引，提升 session 與 message 查詢效率。
 *
 * @param db 已連線的資料庫實例。
 */
const ensureIndexes = async (db) => {
    if (indexesInitialized) {
        return;
    }
    await db.collection("sessions").createIndex({ sessionId: 1 }, { unique: true });
    await db.collection("messages").createIndex({ sessionId: 1, createdAt: 1 });
    indexesInitialized = true;
};
/**
 * 取得 MongoDB database 單例，避免重複建立連線。
 *
 * @returns 已建立完成的 MongoDB database 實例。
 */
export const getDatabase = async () => {
    if (database) {
        return database;
    }
    client = new MongoClient(appConfig.mongodbUri);
    await client.connect();
    database = client.db(appConfig.mongodbDatabaseName);
    await ensureIndexes(database);
    return database;
};
