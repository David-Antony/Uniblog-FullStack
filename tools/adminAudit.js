require('dotenv').config();

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/blogDB';
const DB_NAME = process.env.DB_NAME || 'blogDB';

async function recomputeLikeCountsForCollections(db, collectionNames) {
    const summary = {};
    for (const name of collectionNames) {
        const col = db.collection(name);
        const cursor = col.find();
        let matched = 0, modified = 0, anomalies = 0;
        const bulk = col.initializeUnorderedBulkOp();

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const likedBy = Array.isArray(doc.likedBy) ? doc.likedBy : [];
            const desired = likedBy.length;
            const current = (typeof doc.likeCount === 'number' && Number.isFinite(doc.likeCount)) ? doc.likeCount : null;

            const isAnomaly = current !== desired || current === null || current < 0 || !Number.isInteger(current) || Math.abs(current) > 1e12;
            if (isAnomaly) {
                anomalies++;
                matched++;
                bulk.find({ _id: doc._id }).updateOne({ $set: { likedBy: likedBy, likeCount: desired } });
            }
        }

        if (matched > 0) {
            const result = await bulk.execute();
            modified = result.nModified || result.nModified === undefined ? (result.nModified || Object.values(result).reduce((s, v) => s + (v.nModified || 0), 0)) : result.nModified;
        }

        summary[name] = { checked: true, matched, modified, anomalies };
    }
    return summary;
}

async function auditIndexes(db) {
    const info = {};
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
        try {
            const idx = await db.collection(c.name).indexes();
            info[c.name] = idx;
        } catch (err) {
            info[c.name] = { error: err.message };
        }
    }
    return info;
}

async function main() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        console.log('Connected to', uri, 'db:', DB_NAME);

        const targets = ['posts', 'designItems', 'staticBlogItems', 'achievers'];
        console.log('Recomputing like counts for:', targets.join(', '));
        const recompute = await recomputeLikeCountsForCollections(db, targets);
        console.log('Recompute result:', JSON.stringify(recompute, null, 2));

        console.log('\nAuditing indexes...');
        const idx = await auditIndexes(db);
        console.log('Indexes summary:', JSON.stringify(idx, null, 2));

    } catch (err) {
        console.error('Error running admin audit:', err);
    } finally {
        await client.close();
    }
}

if (require.main === module) main();
