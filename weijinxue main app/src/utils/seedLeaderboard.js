import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

/** TEMP: one-off client seed — remove after entries appear in Firestore. */
export async function seedLeaderboard() {
  const entries = [
    { uid: 'seed_001', displayName: 'Huajin', score: 8240, streak: 18, cpm: 112, accuracy: 0.97 },
    { uid: 'seed_002', displayName: 'HanMei', score: 6890, streak: 14, cpm: 98, accuracy: 0.95 },
    { uid: 'seed_003', displayName: 'ZhaoWei', score: 5730, streak: 11, cpm: 87, accuracy: 0.93 },
    { uid: 'seed_004', displayName: 'XiaoLu', score: 4420, streak: 9, cpm: 74, accuracy: 0.91 },
    { uid: 'seed_005', displayName: 'Tiger', score: 3980, streak: 8, cpm: 68, accuracy: 0.89 },
    { uid: 'seed_006', displayName: 'PandaTypist', score: 3210, streak: 6, cpm: 61, accuracy: 0.87 },
    { uid: 'seed_007', displayName: 'BeijingBob', score: 2760, streak: 5, cpm: 55, accuracy: 0.85 },
    { uid: 'seed_008', displayName: 'NoodlePro', score: 2190, streak: 4, cpm: 48, accuracy: 0.83 },
    { uid: 'seed_009', displayName: 'ShanghaiS', score: 1840, streak: 3, cpm: 42, accuracy: 0.81 },
    { uid: 'seed_010', displayName: 'TeaTyper', score: 1340, streak: 2, cpm: 35, accuracy: 0.78 },
  ]
  for (const e of entries) {
    await setDoc(doc(db, 'typeLeaderboard', 'sentences', 'hsk1', 'scores', e.uid), { ...e, hskLevel: 1 })
    console.log('✓', e.displayName)
  }
  console.log('Seed complete — all 10 entries written to typeLeaderboard/sentences/hsk1/scores.')
}
