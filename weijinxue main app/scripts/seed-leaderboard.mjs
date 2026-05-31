import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'),
)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const SEED_ENTRIES = [
  { uid: 'seed_001', displayName: 'LingLing', score: 8240, streak: 18, cpm: 112, accuracy: 0.97 },
  { uid: 'seed_002', displayName: 'HanMei', score: 6890, streak: 14, cpm: 98, accuracy: 0.95 },
  { uid: 'seed_003', displayName: 'ZhaoWei', score: 5730, streak: 11, cpm: 87, accuracy: 0.93 },
  { uid: 'seed_004', displayName: 'XiaoLu', score: 4420, streak: 9, cpm: 74, accuracy: 0.91 },
  { uid: 'seed_005', displayName: 'TigerMom88', score: 3980, streak: 8, cpm: 68, accuracy: 0.89 },
  { uid: 'seed_006', displayName: 'PandaTypist', score: 3210, streak: 6, cpm: 61, accuracy: 0.87 },
  { uid: 'seed_007', displayName: 'BeijingBob', score: 2760, streak: 5, cpm: 55, accuracy: 0.85 },
  { uid: 'seed_008', displayName: 'NoodlePro', score: 2190, streak: 4, cpm: 48, accuracy: 0.83 },
  { uid: 'seed_009', displayName: 'ShanghaiS', score: 1840, streak: 3, cpm: 42, accuracy: 0.81 },
  { uid: 'seed_010', displayName: 'TeaTyper', score: 1340, streak: 2, cpm: 35, accuracy: 0.78 },
]

async function seed() {
  console.log('Seeding leaderboard (typeLeaderboard/sentences/hsk1/scores)...')
  for (const entry of SEED_ENTRIES) {
    const { uid, ...data } = entry
    await db.doc(`typeLeaderboard/sentences/hsk1/scores/${uid}`).set({
        ...data,
        uid,
        hskLevel: 1,
        achievedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      })
    console.log(`  ✓ ${entry.displayName} — ${entry.score.toLocaleString()}`)
  }
  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
