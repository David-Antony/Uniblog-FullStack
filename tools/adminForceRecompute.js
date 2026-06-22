require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/blogDB';
const DB_NAME = process.env.DB_NAME || 'blogDB';

async function forceRecompute(db, name) {
    const col = db.collection(name);

    // Build filter: documents where likeCount != size(likedBy) OR likeCount missing/invalid
    const filter = {
        $expr: {
            $ne: [
                { $ifNull: ["$likeCount", null] },
                { $size: { $ifNull: ["$likedBy", []] } }
            ]
        }
    };

    // Update using aggregation pipeline to set likeCount to size(likedBy)
    const update = [
        {
            $set: {
                likedBy: { $ifNull: ["$likedBy", []] },
                likeCount: { $size: { $ifNull: ["$likedBy", []] } }
            }
        }
    ];

    const result = await col.updateMany(filter, update);
    return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function main() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        console.log('Connected to', uri, 'db:', DB_NAME);

        const targets = ['posts', 'designItems', 'staticBlogItems', 'achievers'];
        const summary = {};
        for (const t of targets) {
            console.log('Processing', t);
            const res = await forceRecompute(db, t);
            summary[t] = res;
            console.log(` -> matched=${res.matched}, modified=${res.modified}`);
        }

        console.log('\nForce recompute summary:', JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

if (require.main === module) main();
